/**
 * Cost and performance metadata for common models.
 * Used for task complexity routing and cost optimization.
 */

import type { ModelCatalogEntry, ModelPerformanceTier, ModelProviderType } from "./model-catalog.js";

/**
 * Cost metadata for common models (as of 2026).
 * Prices are in USD per 1000 tokens.
 */
export const MODEL_COST_DATABASE: Record<string, Partial<ModelCatalogEntry>> = {
  // GitHub Copilot (Anthropic Claude models)
  "claude-sonnet-4.5": {
    performanceTier: "quality",
    providerType: "cloud",
    cost: {
      inputCostPer1k: 0.003, // $3 per 1M input tokens
      outputCostPer1k: 0.015, // $15 per 1M output tokens
    },
    speedScore: 70,
    qualityScore: 95,
  },
  "claude-sonnet-4.6": {
    performanceTier: "quality",
    providerType: "cloud",
    cost: {
      inputCostPer1k: 0.003,
      outputCostPer1k: 0.015,
    },
    speedScore: 70,
    qualityScore: 95,
  },
  "claude-haiku-4.5": {
    performanceTier: "fast",
    providerType: "cloud",
    cost: {
      inputCostPer1k: 0.00025, // $0.25 per 1M input tokens
      outputCostPer1k: 0.00125, // $1.25 per 1M output tokens
    },
    speedScore: 95,
    qualityScore: 75,
  },
  "claude-opus-4.6": {
    performanceTier: "quality",
    providerType: "cloud",
    cost: {
      inputCostPer1k: 0.015, // $15 per 1M input tokens
      outputCostPer1k: 0.075, // $75 per 1M output tokens
    },
    speedScore: 50,
    qualityScore: 98,
  },

  // GitHub Copilot (OpenAI GPT models)
  "gpt-5.4": {
    performanceTier: "quality",
    providerType: "cloud",
    cost: {
      inputCostPer1k: 0.0025,
      outputCostPer1k: 0.01,
    },
    speedScore: 75,
    qualityScore: 92,
  },
  "gpt-5.3-codex": {
    performanceTier: "quality",
    providerType: "cloud",
    cost: {
      inputCostPer1k: 0.002,
      outputCostPer1k: 0.008,
    },
    speedScore: 80,
    qualityScore: 90,
  },
  "gpt-5.2-codex": {
    performanceTier: "balanced",
    providerType: "cloud",
    cost: {
      inputCostPer1k: 0.0015,
      outputCostPer1k: 0.006,
    },
    speedScore: 85,
    qualityScore: 85,
  },
  "gpt-5-mini": {
    performanceTier: "fast",
    providerType: "cloud",
    cost: {
      inputCostPer1k: 0.00015,
      outputCostPer1k: 0.0006,
    },
    speedScore: 95,
    qualityScore: 70,
  },
  "gpt-4.1": {
    performanceTier: "balanced",
    providerType: "cloud",
    cost: {
      inputCostPer1k: 0.001,
      outputCostPer1k: 0.003,
    },
    speedScore: 85,
    qualityScore: 88,
  },

  // Ollama models (local, free)
  "qwen3-coder:14b": {
    performanceTier: "fast",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 90,
    qualityScore: 80,
  },
  "qwen3-coder:32b": {
    performanceTier: "balanced",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 75,
    qualityScore: 88,
  },
  "qwen3-coder:72b": {
    performanceTier: "quality",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 60,
    qualityScore: 93,
  },
  "qwen3:14b-instruct": {
    performanceTier: "fast",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 90,
    qualityScore: 78,
  },
  "qwen3:72b-instruct": {
    performanceTier: "quality",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 60,
    qualityScore: 92,
  },
  "glm-4.7-flash": {
    performanceTier: "fast",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 92,
    qualityScore: 82,
  },
  "glm-4.7": {
    performanceTier: "balanced",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 75,
    qualityScore: 90,
  },
  "deepseek-r1:32b": {
    performanceTier: "balanced",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 78,
    qualityScore: 86,
  },
  "deepseek-coder-v2:16b": {
    performanceTier: "fast",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 88,
    qualityScore: 84,
  },
  "llama3.3:70b": {
    performanceTier: "quality",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 65,
    qualityScore: 90,
  },
  "llama3.1:8b": {
    performanceTier: "fast",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 95,
    qualityScore: 72,
  },
  "gemma2:9b": {
    performanceTier: "fast",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 93,
    qualityScore: 74,
  },
  "phi3.5:3.8b": {
    performanceTier: "fast",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 98,
    qualityScore: 65,
  },
  "gpt-oss:20b": {
    performanceTier: "balanced",
    providerType: "local",
    cost: {
      inputCostPer1k: 0,
      outputCostPer1k: 0,
    },
    speedScore: 80,
    qualityScore: 85,
  },
};

/**
 * Enrich a model catalog entry with cost and performance metadata.
 */
export function enrichModelWithCostMetadata(entry: ModelCatalogEntry): ModelCatalogEntry {
  const modelId = entry.id.toLowerCase();
  const costData = MODEL_COST_DATABASE[modelId];

  if (!costData) {
    // Default: assume cloud provider if not in database
    return {
      ...entry,
      providerType: entry.provider === "ollama" ? "local" : "cloud",
      performanceTier: "balanced",
      speedScore: 70,
      qualityScore: 70,
    };
  }

  return {
    ...entry,
    ...costData,
  };
}

/**
 * Get estimated cost for a request.
 */
export function estimateRequestCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const costData = MODEL_COST_DATABASE[modelId.toLowerCase()];

  if (!costData?.cost) {
    return 0;
  }

  const inputCost = (costData.cost.inputCostPer1k ?? 0) * (inputTokens / 1000);
  const outputCost = (costData.cost.outputCostPer1k ?? 0) * (outputTokens / 1000);

  return inputCost + outputCost;
}

/**
 * Compare two models by cost (for sorting).
 */
export function compareModelsByCost(a: string, b: string): number {
  const costA = MODEL_COST_DATABASE[a.toLowerCase()]?.cost;
  const costB = MODEL_COST_DATABASE[b.toLowerCase()]?.cost;

  if (!costA && !costB) return 0;
  if (!costA) return 1; // a more expensive (unknown)
  if (!costB) return -1; // b more expensive (unknown)

  const avgCostA = ((costA.inputCostPer1k ?? 0) + (costA.outputCostPer1k ?? 0)) / 2;
  const avgCostB = ((costB.inputCostPer1k ?? 0) + (costB.outputCostPer1k ?? 0)) / 2;

  return avgCostA - avgCostB;
}

/**
 * Check if a model is free (local).
 */
export function isModelFree(modelId: string): boolean {
  const costData = MODEL_COST_DATABASE[modelId.toLowerCase()];
  return (
    costData?.providerType === "local" ||
    (costData?.cost?.inputCostPer1k === 0 && costData?.cost?.outputCostPer1k === 0)
  );
}
