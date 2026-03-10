/**
 * Complexity-based model router.
 * Automatically selects models based on task complexity to optimize cost and performance.
 */

import type { OpenClawConfig } from "../config/config.js";
import type { ModelRef } from "./model-selection.js";
import { normalizeProviderId } from "./model-selection.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  type TaskComplexity,
  type ClassificationContext,
  type ClassificationResult,
  type RoutingDecision,
  type ComplexityRoutingConfig,
} from "./complexity-routing.types.js";
import {
  classifyTaskComplexity,
  buildClassificationContext,
  DEFAULT_THRESHOLDS,
} from "./task-classifier.js";
import { enrichModelWithCostMetadata, estimateRequestCost } from "./model-cost-catalog.js";

const log = createSubsystemLogger("complexity-router");

/**
 * Check if complexity routing is enabled in config.
 */
export function isComplexityRoutingEnabled(config: OpenClawConfig, agentId?: string): boolean {
  // Check agent defaults for routing config
  const agentDefaults = config.agents?.defaults;
  return agentDefaults?.complexityRouting?.enabled === true;
}

/**
 * Get complexity routing config for an agent.
 */
export function getComplexityRoutingConfig(
  config: OpenClawConfig,
  agentId: string = "main",
): ComplexityRoutingConfig | undefined {
  // Get from agent defaults
  const agentDefaults = config.agents?.defaults;
  return agentDefaults?.complexityRouting;
}

/**
 * Select model based on task complexity.
 */
export function selectModelByComplexity(
  context: ClassificationContext,
  routingConfig: ComplexityRoutingConfig,
  config: OpenClawConfig,
): RoutingDecision | null {
  try {
    // Classify the task
    const classification = classifyTaskComplexity(
      context,
      routingConfig.thresholds ?? DEFAULT_THRESHOLDS,
    );

    if (routingConfig.logDecisions) {
      log.info(
        `Task classified as ${classification.complexity} (score: ${classification.score}, confidence: ${classification.confidence}%)`,
      );
      log.debug("Classification breakdown:", classification.breakdown);
    }

    // Get model for complexity level
    const modelId = routingConfig.models?.[classification.complexity];
    if (!modelId) {
      log.warn(`No model configured for complexity: ${classification.complexity}`);
      return null;
    }

    // Parse model ref (provider:model or just model)
    const { provider, model } = parseModelRef(modelId);

    // Get fallbacks
    const fallbacks = routingConfig.fallbacks?.[classification.complexity] ?? [];

    // Cost control check
    let costControlApplied = false;
    if (routingConfig.costControl?.enabled) {
      const sessionCost = context.sessionCost ?? 0;
      const maxCost = routingConfig.costControl.maxCostPerSession ?? Infinity;

      if (sessionCost >= maxCost) {
        log.warn(
          `Session cost limit reached ($${sessionCost.toFixed(2)} >= $${maxCost.toFixed(2)}), forcing local model`,
        );
        costControlApplied = true;

        // Force local/free model
        const localModel = findLocalModel(routingConfig);
        if (localModel) {
          const { provider: localProvider, model: localModelName } = parseModelRef(localModel);
          return {
            model: localModelName,
            provider: localProvider,
            complexity: classification.complexity,
            classification,
            fallbacks: [],
            reason: "Cost limit reached, forced local model",
            estimatedCost: 0,
            costControlApplied: true,
          };
        }
      }
    }

    // Build decision
    const decision: RoutingDecision = {
      model,
      provider,
      complexity: classification.complexity,
      classification,
      fallbacks: fallbacks.map((f) => parseModelRef(f).model),
      reason: classification.reason,
      estimatedCost: classification.estimatedCost,
      costControlApplied,
    };

    if (routingConfig.logDecisions) {
      log.info(`Selected model: ${provider}:${model} (${classification.complexity})`);
      if (fallbacks.length > 0) {
        log.debug(`Fallbacks: ${fallbacks.join(", ")}`);
      }
    }

    return decision;
  } catch (error) {
    log.error("Error in complexity routing:", { error });
    return null;
  }
}

/**
 * Parse model reference (provider:model or just model).
 */
function parseModelRef(modelRef: string): { provider: string; model: string } {
  const colonIndex = modelRef.indexOf(":");
  if (colonIndex > 0) {
    const provider = modelRef.substring(0, colonIndex);
    const model = modelRef.substring(colonIndex + 1);
    return { provider: normalizeProviderId(provider), model };
  }

  // No provider specified, try to infer
  if (modelRef.startsWith("claude-")) {
    return { provider: "anthropic", model: modelRef };
  }
  if (modelRef.startsWith("gpt-")) {
    return { provider: "openai", model: modelRef };
  }
  if (modelRef.startsWith("gemini-")) {
    return { provider: "google", model: modelRef };
  }

  // Default to ollama if no provider
  return { provider: "ollama", model: modelRef };
}

/**
 * Find a local/free model in routing config.
 */
function findLocalModel(routingConfig: ComplexityRoutingConfig): string | undefined {
  // Check simple model first
  const simpleModel = routingConfig.models?.simple;
  if (simpleModel && (simpleModel.includes("ollama:") || !simpleModel.includes(":"))) {
    return simpleModel;
  }

  // Check fallbacks
  const simpleFallbacks = routingConfig.fallbacks?.simple ?? [];
  for (const fallback of simpleFallbacks) {
    if (fallback.includes("ollama:") || !fallback.includes(":")) {
      return fallback;
    }
  }

  return undefined;
}

/**
 * Build classification context from user prompt and session data.
 */
export function buildRoutingContext(
  prompt: string,
  options: {
    conversationLength?: number;
    hasFileContext?: boolean;
    sessionCost?: number;
    forceComplexity?: TaskComplexity;
  } = {},
): ClassificationContext {
  return buildClassificationContext(prompt, options);
}

/**
 * Check if a tool name forces complex classification.
 */
export function isForceComplexTool(
  tool: string,
  routingConfig: ComplexityRoutingConfig,
): boolean {
  const forceTools = routingConfig.forceComplexTools ?? [];
  return forceTools.includes(tool);
}

/**
 * Check if a keyword forces simple classification.
 */
export function isForceSimpleKeyword(
  prompt: string,
  routingConfig: ComplexityRoutingConfig,
): boolean {
  const forceKeywords = routingConfig.forceSimpleKeywords ?? [];
  const lowerPrompt = prompt.toLowerCase();
  return forceKeywords.some((kw) => lowerPrompt.includes(kw.toLowerCase()));
}

/**
 * Log routing decision for observability.
 */
export function logRoutingDecision(
  decision: RoutingDecision,
  context: ClassificationContext,
): void {
  log.info("Routing decision:", {
    model: `${decision.provider}:${decision.model}`,
    complexity: decision.complexity,
    score: decision.classification.score,
    confidence: decision.classification.confidence,
    promptLength: context.prompt.length,
    hasFileContext: context.hasFileContext,
    toolsDetected: context.requestedTools?.length ?? 0,
    estimatedCost: decision.estimatedCost?.toFixed(4) ?? "unknown",
    reason: decision.reason,
  });
}

/**
 * Main entry point: Select model with complexity routing.
 * Returns null if routing is disabled or fails (caller should use fallback).
 */
export function selectModelWithComplexityRouting(
  config: OpenClawConfig,
  prompt: string,
  options: {
    agentId?: string;
    conversationLength?: number;
    hasFileContext?: boolean;
    sessionCost?: number;
    forceComplexity?: TaskComplexity;
  } = {},
): RoutingDecision | null {
  const agentId = options.agentId ?? "main";

  // Check if routing is enabled
  if (!isComplexityRoutingEnabled(config, agentId)) {
    return null;
  }

  const routingConfig = getComplexityRoutingConfig(config, agentId);
  if (!routingConfig) {
    return null;
  }

  // Build context
  const context = buildRoutingContext(prompt, {
    conversationLength: options.conversationLength,
    hasFileContext: options.hasFileContext,
    sessionCost: options.sessionCost,
    forceComplexity: options.forceComplexity,
  });

  // Select model
  const decision = selectModelByComplexity(context, routingConfig, config);

  // Log decision
  if (decision && routingConfig.logDecisions) {
    logRoutingDecision(decision, context);
  }

  return decision;
}
