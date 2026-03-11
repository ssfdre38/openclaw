/**
 * Configuration types for task complexity-based model routing.
 */

/**
 * Task complexity levels.
 */
export type TaskComplexity = "simple" | "moderate" | "complex";

/**
 * Routing strategy for task complexity.
 */
export type ComplexityRoutingStrategy =
  | "hybrid" // Keywords + length + context + tools (recommended)
  | "keyword" // Keywords only
  | "length" // Prompt length only
  | "manual"; // Manual classification only

/**
 * Cost control settings.
 */
export type CostControlConfig = {
  /** Enable cost control */
  enabled?: boolean;
  /** Maximum cost per session in USD */
  maxCostPerSession?: number;
  /** Prefer local/free models when possible */
  preferLocal?: boolean;
  /** Warn when approaching cost limit */
  warnThreshold?: number; // 0.0-1.0 (e.g., 0.8 = warn at 80%)
};

/**
 * Classification thresholds.
 */
export type ClassificationThresholds = {
  /** Max prompt length for "simple" classification */
  simpleLengthMax?: number;
  /** Max prompt length for "moderate" classification */
  moderateLengthMax?: number;
  /** Max score for "simple" classification (0-100) */
  simpleScoreMax?: number;
  /** Min score for "complex" classification (0-100) */
  complexScoreMin?: number;
};

/**
 * Complexity routing configuration.
 */
export type ComplexityRoutingConfig = {
  /** Enable complexity-based routing */
  enabled?: boolean;

  /** Routing strategy */
  strategy?: ComplexityRoutingStrategy;

  /** Model assignments by complexity level */
  models?: {
    simple?: string | { primary: string; fallbacks?: string[] };
    moderate?: string | { primary: string; fallbacks?: string[] };
    complex?: string | { primary: string; fallbacks?: string[] };
  };

  /** Fallback models if primary fails (legacy format, use object format in models instead) */
  fallbacks?: {
    simple?: string[];
    moderate?: string[];
    complex?: string[];
  };

  /** Classification thresholds */
  thresholds?: ClassificationThresholds;

  /** Cost control settings */
  costControl?: CostControlConfig;

  /** Force complex classification for these tools */
  forceComplexTools?: string[];

  /** Force simple classification for these keywords */
  forceSimpleKeywords?: string[];

  /** Enable detailed logging */
  logDecisions?: boolean;
};

/**
 * Classification context (input to classifier).
 */
export type ClassificationContext = {
  /** User prompt */
  prompt: string;

  /** Conversation length (number of messages) */
  conversationLength?: number;

  /** Has file context (viewing/editing files) */
  hasFileContext?: boolean;

  /** Requested tools (edit, create, view, etc.) */
  requestedTools?: string[];

  /** Has code blocks in prompt */
  hasCodeBlocks?: boolean;

  /** Has images or attachments */
  hasAttachments?: boolean;

  /** Session cost so far */
  sessionCost?: number;

  /** Force specific complexity (manual override) */
  forceComplexity?: TaskComplexity;
};

/**
 * Classification result (output from classifier).
 */
export type ClassificationResult = {
  /** Classified complexity level */
  complexity: TaskComplexity;

  /** Confidence score (0-100) */
  confidence: number;

  /** Raw classification score (before thresholds) */
  score: number;

  /** Breakdown of scoring */
  breakdown: {
    keywordScore: number;
    contextScore: number;
    toolScore: number;
  };

  /** Reason for classification */
  reason: string;

  /** Recommended model */
  recommendedModel?: string;

  /** Estimated cost (if available) */
  estimatedCost?: number;
};

/**
 * Routing decision (output from router).
 */
export type RoutingDecision = {
  /** Selected model */
  model: string;

  /** Provider */
  provider: string;

  /** Complexity level */
  complexity: TaskComplexity;

  /** Classification result */
  classification: ClassificationResult;

  /** Fallback models (in order) */
  fallbacks: string[];

  /** Reason for selection */
  reason: string;

  /** Cost estimate */
  estimatedCost?: number;

  /** Was cost control applied? */
  costControlApplied?: boolean;
};

/**
 * Routing metrics (for observability).
 */
export type RoutingMetrics = {
  /** Total requests routed */
  totalRequests: number;

  /** Requests by complexity */
  byComplexity: {
    simple: number;
    moderate: number;
    complex: number;
  };

  /** Cost by complexity */
  costByComplexity: {
    simple: number;
    moderate: number;
    complex: number;
  };

  /** Total cost */
  totalCost: number;

  /** Estimated savings vs all-cloud */
  estimatedSavings: number;

  /** Average latency by complexity (ms) */
  avgLatencyByComplexity?: {
    simple: number;
    moderate: number;
    complex: number;
  };

  /** Fallback rate (% of requests that used fallback) */
  fallbackRate?: number;
};
