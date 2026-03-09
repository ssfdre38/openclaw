import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { danger } from "../globals.js";
import { resolveStateDir } from "../config/paths.js";

const log = createSubsystemLogger("agent-sleep-state");

export type AgentSleepState = {
  sleeping: boolean;
  reason?: string;
  sleepStartTime?: number;
  activityState?: string;
  status?: "online" | "dnd" | "idle" | "invisible";
};

function resolveSleepStateFilePath(agentId: string): string {
  const stateDir = resolveStateDir();
  return path.join(stateDir, "agents", agentId, "sleep-state.json");
}

/**
 * Load sleep state for an agent.
 * Returns default awake state if file doesn't exist or is invalid.
 */
export async function loadAgentSleepState(agentId: string): Promise<AgentSleepState> {
  const filePath = resolveSleepStateFilePath(agentId);
  
  if (!existsSync(filePath)) {
    return { sleeping: false };
  }

  try {
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as unknown;
    
    if (typeof data !== "object" || data === null) {
      log.warn(`Invalid sleep state file for agent ${agentId}, using default`);
      return { sleeping: false };
    }

    const state = data as Record<string, unknown>;
    return {
      sleeping: Boolean(state.sleeping),
      reason: typeof state.reason === "string" ? state.reason : undefined,
      sleepStartTime: typeof state.sleepStartTime === "number" ? state.sleepStartTime : undefined,
      activityState: typeof state.activityState === "string" ? state.activityState : undefined,
      status:
        typeof state.status === "string" &&
        ["online", "dnd", "idle", "invisible"].includes(state.status)
          ? (state.status as AgentSleepState["status"])
          : undefined,
    };
  } catch (error: unknown) {
    if (danger()) {
      log.error(`Failed to load sleep state for agent ${agentId}:`, error as Record<string, unknown>);
    }
    return { sleeping: false };
  }
}

/**
 * Save sleep state for an agent.
 */
export async function saveAgentSleepState(
  agentId: string,
  state: AgentSleepState,
): Promise<void> {
  const filePath = resolveSleepStateFilePath(agentId);
  const dir = path.dirname(filePath);

  try {
    // Ensure directory exists
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const raw = JSON.stringify(state, null, 2);
    await writeFile(filePath, raw, "utf-8");
    
    if (danger()) {
      log.info(`Saved sleep state for agent ${agentId}: sleeping=${state.sleeping}`);
    }
  } catch (error: unknown) {
    log.error(`Failed to save sleep state for agent ${agentId}:`, error as Record<string, unknown>);
    throw error;
  }
}

/**
 * Check if an agent is currently sleeping.
 * Non-blocking, synchronous check using cached state.
 */
export function isAgentSleeping(agentId: string): boolean {
  const filePath = resolveSleepStateFilePath(agentId);
  
  if (!existsSync(filePath)) {
    return false;
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as unknown;
    
    if (typeof data === "object" && data !== null) {
      const state = data as Record<string, unknown>;
      return Boolean(state.sleeping);
    }
  } catch {
    // Ignore errors, default to awake
  }
  
  return false;
}
