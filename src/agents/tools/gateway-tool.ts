import { Type } from "@sinclair/typebox";
import { isRestartEnabled } from "../../config/commands.js";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveConfigSnapshotHash } from "../../config/io.js";
import { extractDeliveryInfo } from "../../config/sessions.js";
import {
  formatDoctorNonInteractiveHint,
  type RestartSentinelPayload,
  writeRestartSentinel,
} from "../../infra/restart-sentinel.js";
import { scheduleGatewaySigusr1Restart } from "../../infra/restart.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";
import { callGatewayTool, readGatewayCallOptions } from "./gateway.js";
import { loadAgentSleepState, saveAgentSleepState } from "../sleep-state.js";
import { resolveAgentIdFromSessionKey } from "../agent-scope.js";
import { getGateway } from "../../discord/monitor/gateway-registry.js";

const log = createSubsystemLogger("gateway-tool");

const DEFAULT_UPDATE_TIMEOUT_MS = 20 * 60_000;

function resolveBaseHashFromSnapshot(snapshot: unknown): string | undefined {
  if (!snapshot || typeof snapshot !== "object") {
    return undefined;
  }
  const hashValue = (snapshot as { hash?: unknown }).hash;
  const rawValue = (snapshot as { raw?: unknown }).raw;
  const hash = resolveConfigSnapshotHash({
    hash: typeof hashValue === "string" ? hashValue : undefined,
    raw: typeof rawValue === "string" ? rawValue : undefined,
  });
  return hash ?? undefined;
}

const GATEWAY_ACTIONS = [
  "restart",
  "config.get",
  "config.schema",
  "config.apply",
  "config.patch",
  "update.run",
  "agent.sleep",
  "agent.wake",
] as const;

// NOTE: Using a flattened object schema instead of Type.Union([Type.Object(...), ...])
// because Claude API on Vertex AI rejects nested anyOf schemas as invalid JSON Schema.
// The discriminator (action) determines which properties are relevant; runtime validates.
const GatewayToolSchema = Type.Object({
  action: stringEnum(GATEWAY_ACTIONS),
  // restart
  delayMs: Type.Optional(Type.Number()),
  reason: Type.Optional(Type.String()),
  // config.get, config.schema, config.apply, update.run
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
  // config.apply, config.patch
  raw: Type.Optional(Type.String()),
  baseHash: Type.Optional(Type.String()),
  // config.apply, config.patch, update.run
  sessionKey: Type.Optional(Type.String()),
  note: Type.Optional(Type.String()),
  restartDelayMs: Type.Optional(Type.Number()),
  // agent.sleep, agent.wake
  status: Type.Optional(Type.String()),
  activityType: Type.Optional(Type.String()),
  activityName: Type.Optional(Type.String()),
  activityState: Type.Optional(Type.String()),
  activityUrl: Type.Optional(Type.String()),
});
// NOTE: We intentionally avoid top-level `allOf`/`anyOf`/`oneOf` conditionals here:
// - OpenAI rejects tool schemas that include these keywords at the *top-level*.
// - Claude/Vertex has other JSON Schema quirks.
// Conditional requirements (like `raw` for config.apply) are enforced at runtime.

export function createGatewayTool(opts?: {
  agentSessionKey?: string;
  config?: OpenClawConfig;
}): AnyAgentTool {
  return {
    label: "Gateway",
    name: "gateway",
    ownerOnly: true,
    description:
      "Restart, apply config, update the gateway, or manage agent sleep state. " +
      "Use config.patch for safe partial config updates (merges with existing). " +
      "Use config.apply only when replacing entire config. Both trigger restart after writing. " +
      "Use agent.sleep to enter a resting state with custom Discord status. " +
      "Use agent.wake to return to active state. " +
      "Always pass a human-readable completion message via the `note` parameter for restart/config operations.",
    parameters: GatewayToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      if (action === "restart") {
        if (!isRestartEnabled(opts?.config)) {
          throw new Error("Gateway restart is disabled (commands.restart=false).");
        }
        const sessionKey =
          typeof params.sessionKey === "string" && params.sessionKey.trim()
            ? params.sessionKey.trim()
            : opts?.agentSessionKey?.trim() || undefined;
        const delayMs =
          typeof params.delayMs === "number" && Number.isFinite(params.delayMs)
            ? Math.floor(params.delayMs)
            : undefined;
        const reason =
          typeof params.reason === "string" && params.reason.trim()
            ? params.reason.trim().slice(0, 200)
            : undefined;
        const note =
          typeof params.note === "string" && params.note.trim() ? params.note.trim() : undefined;
        // Extract channel + threadId for routing after restart
        // Supports both :thread: (most channels) and :topic: (Telegram)
        const { deliveryContext, threadId } = extractDeliveryInfo(sessionKey);
        const payload: RestartSentinelPayload = {
          kind: "restart",
          status: "ok",
          ts: Date.now(),
          sessionKey,
          deliveryContext,
          threadId,
          message: note ?? reason ?? null,
          doctorHint: formatDoctorNonInteractiveHint(),
          stats: {
            mode: "gateway.restart",
            reason,
          },
        };
        try {
          await writeRestartSentinel(payload);
        } catch {
          // ignore: sentinel is best-effort
        }
        log.info(
          `gateway tool: restart requested (delayMs=${delayMs ?? "default"}, reason=${reason ?? "none"})`,
        );
        const scheduled = scheduleGatewaySigusr1Restart({
          delayMs,
          reason,
        });
        return jsonResult(scheduled);
      }

      const gatewayOpts = readGatewayCallOptions(params);

      const resolveGatewayWriteMeta = (): {
        sessionKey: string | undefined;
        note: string | undefined;
        restartDelayMs: number | undefined;
      } => {
        const sessionKey =
          typeof params.sessionKey === "string" && params.sessionKey.trim()
            ? params.sessionKey.trim()
            : opts?.agentSessionKey?.trim() || undefined;
        const note =
          typeof params.note === "string" && params.note.trim() ? params.note.trim() : undefined;
        const restartDelayMs =
          typeof params.restartDelayMs === "number" && Number.isFinite(params.restartDelayMs)
            ? Math.floor(params.restartDelayMs)
            : undefined;
        return { sessionKey, note, restartDelayMs };
      };

      const resolveConfigWriteParams = async (): Promise<{
        raw: string;
        baseHash: string;
        sessionKey: string | undefined;
        note: string | undefined;
        restartDelayMs: number | undefined;
      }> => {
        const raw = readStringParam(params, "raw", { required: true });
        let baseHash = readStringParam(params, "baseHash");
        if (!baseHash) {
          const snapshot = await callGatewayTool("config.get", gatewayOpts, {});
          baseHash = resolveBaseHashFromSnapshot(snapshot);
        }
        if (!baseHash) {
          throw new Error("Missing baseHash from config snapshot.");
        }
        return { raw, baseHash, ...resolveGatewayWriteMeta() };
      };

      if (action === "config.get") {
        const result = await callGatewayTool("config.get", gatewayOpts, {});
        return jsonResult({ ok: true, result });
      }
      if (action === "config.schema") {
        const result = await callGatewayTool("config.schema", gatewayOpts, {});
        return jsonResult({ ok: true, result });
      }
      if (action === "config.apply") {
        const { raw, baseHash, sessionKey, note, restartDelayMs } =
          await resolveConfigWriteParams();
        const result = await callGatewayTool("config.apply", gatewayOpts, {
          raw,
          baseHash,
          sessionKey,
          note,
          restartDelayMs,
        });
        return jsonResult({ ok: true, result });
      }
      if (action === "config.patch") {
        const { raw, baseHash, sessionKey, note, restartDelayMs } =
          await resolveConfigWriteParams();
        const result = await callGatewayTool("config.patch", gatewayOpts, {
          raw,
          baseHash,
          sessionKey,
          note,
          restartDelayMs,
        });
        return jsonResult({ ok: true, result });
      }
      if (action === "update.run") {
        const { sessionKey, note, restartDelayMs } = resolveGatewayWriteMeta();
        const updateTimeoutMs = gatewayOpts.timeoutMs ?? DEFAULT_UPDATE_TIMEOUT_MS;
        const updateGatewayOpts = {
          ...gatewayOpts,
          timeoutMs: updateTimeoutMs,
        };
        const result = await callGatewayTool("update.run", updateGatewayOpts, {
          sessionKey,
          note,
          restartDelayMs,
          timeoutMs: updateTimeoutMs,
        });
        return jsonResult({ ok: true, result });
      }

      if (action === "agent.sleep" || action === "agent.wake") {
        const sessionKey = opts?.agentSessionKey?.trim();
        const agentId = sessionKey ? resolveAgentIdFromSessionKey(sessionKey) : "main";
        
        if (action === "agent.sleep") {
          const reason = readStringParam(params, "reason");
          const status = readStringParam(params, "status") || "dnd";
          const activityType = readStringParam(params, "activityType");
          const activityName = readStringParam(params, "activityName");
          const activityState = readStringParam(params, "activityState");
          const activityUrl = readStringParam(params, "activityUrl");

          // Save sleep state
          await saveAgentSleepState(agentId, {
            sleeping: true,
            reason,
            sleepStartTime: Date.now(),
            activityState,
            status: status as "online" | "dnd" | "idle" | "invisible",
          });

          // Update Discord presence if we have a gateway connection
          try {
            const gateway = getGateway();
            if (gateway && gateway.isConnected) {
              const presenceData = {
                since: null,
                activities: activityState || activityName
                  ? [
                      {
                        type: activityType === "playing"
                          ? 0
                          : activityType === "streaming"
                            ? 1
                            : activityType === "listening"
                              ? 2
                              : activityType === "watching"
                                ? 3
                                : activityType === "competing"
                                  ? 5
                                  : 4,
                        name: activityName || "Custom Status",
                        state: activityState,
                        ...(activityUrl ? { url: activityUrl } : {}),
                      },
                    ]
                  : [],
                status: status as "online" | "dnd" | "idle" | "invisible",
                afk: false,
              };
              gateway.updatePresence(presenceData);
              log.info(`Agent ${agentId} entering sleep state with Discord status: ${status}`);
            }
          } catch (error) {
            log.warn(`Failed to update Discord presence for sleep: ${error}`);
          }

          return jsonResult({
            ok: true,
            message: "Entering sleep state. Will return NO_REPLY to incoming messages until wake.",
            agentId,
            sleeping: true,
            reason,
          });
        }

        if (action === "agent.wake") {
          const status = readStringParam(params, "status") || "online";
          const activityType = readStringParam(params, "activityType");
          const activityName = readStringParam(params, "activityName");
          const activityState = readStringParam(params, "activityState");
          const activityUrl = readStringParam(params, "activityUrl");

          // Load current state to get sleep duration
          const currentState = await loadAgentSleepState(agentId);
          const sleepDurationMs = currentState.sleepStartTime
            ? Date.now() - currentState.sleepStartTime
            : 0;

          // Clear sleep state
          await saveAgentSleepState(agentId, {
            sleeping: false,
          });

          // Update Discord presence if we have a gateway connection
          try {
            const gateway = getGateway();
            if (gateway && gateway.isConnected) {
              const presenceData = {
                since: null,
                activities: activityState || activityName
                  ? [
                      {
                        type: activityType === "playing"
                          ? 0
                          : activityType === "streaming"
                            ? 1
                            : activityType === "listening"
                              ? 2
                              : activityType === "watching"
                                ? 3
                                : activityType === "competing"
                                  ? 5
                                  : 4,
                        name: activityName || "Custom Status",
                        state: activityState,
                        ...(activityUrl ? { url: activityUrl } : {}),
                      },
                    ]
                  : [],
                status: status as "online" | "dnd" | "idle" | "invisible",
                afk: false,
              };
              gateway.updatePresence(presenceData);
              log.info(`Agent ${agentId} waking up with Discord status: ${status}`);
            }
          } catch (error) {
            log.warn(`Failed to update Discord presence for wake: ${error}`);
          }

          return jsonResult({
            ok: true,
            message: "Waking up. Will now respond to incoming messages.",
            agentId,
            sleeping: false,
            sleepDurationMs,
          });
        }
      }

      throw new Error(`Unknown action: ${action}`);
    },
  };
}
