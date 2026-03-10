/**
 * Model selection with complexity routing integration.
 * Wraps resolveAgentEffectiveModelPrimary with optional complexity-based routing.
 */

import type { OpenClawConfig } from "../config/config.js";
import { resolveAgentEffectiveModelPrimary } from "./agent-scope.js";
import { selectModelWithComplexityRouting } from "./complexity-router.js";
import { recordRoutingMetrics } from "./routing-metrics.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("model-routing");

export interface ModelSelectionContext {
  agentId: string;
  prompt: string;
  conversationLength?: number;
  hasFileContext?: boolean;
  sessionCost?: number;
  requestedTools?: string[];
}

/**
 * Resolve model with optional complexity routing.
 * If routing is enabled and selects a model, returns that.
 * Otherwise falls back to standard agent model resolution.
 */
export function resolveModelWithRouting(
  cfg: OpenClawConfig,
  context: ModelSelectionContext,
): string | undefined {
  // Try complexity routing first
  const routingDecision = selectModelWithComplexityRouting(cfg, context.prompt, {
    agentId: context.agentId,
    conversationLength: context.conversationLength,
    hasFileContext: context.hasFileContext,
    sessionCost: context.sessionCost,
  });

  if (routingDecision) {
    const modelRef = `${routingDecision.provider}/${routingDecision.model}`;
    log.debug("Routing selected model:", {
      model: modelRef,
      complexity: routingDecision.complexity,
      score: routingDecision.classification.score,
      reason: routingDecision.reason,
    });

    // Record metrics
    recordRoutingMetrics(routingDecision, context.prompt.length);

    return modelRef;
  }

  // Fall back to standard model resolution
  const standardModel = resolveAgentEffectiveModelPrimary(cfg, context.agentId);
  if (standardModel) {
    log.debug("Using standard model resolution:", { model: standardModel });
  }
  return standardModel;
}

/**
 * Helper to build context from available information.
 */
export function buildModelSelectionContext(params: {
  agentId: string;
  prompt: string;
  conversationHistory?: unknown[];
  fileContext?: boolean;
  sessionCost?: number;
  tools?: string[];
}): ModelSelectionContext {
  return {
    agentId: params.agentId,
    prompt: params.prompt,
    conversationLength: params.conversationHistory?.length ?? 0,
    hasFileContext: params.fileContext ?? false,
    sessionCost: params.sessionCost ?? 0,
    requestedTools: params.tools,
  };
}
