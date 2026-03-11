/**
 * Task complexity classifier using hybrid approach:
 * - Keywords (simple vs complex indicators)
 * - Prompt length
 * - Context (files, tools, conversation)
 * - Code/attachment presence
 */

import type {
  TaskComplexity,
  ClassificationContext,
  ClassificationResult,
  ClassificationThresholds,
} from "./complexity-routing.types.js";

/**
 * Default classification thresholds.
 */
export const DEFAULT_THRESHOLDS: Required<ClassificationThresholds> = {
  simpleLengthMax: 200, // Very short prompts (< 200 chars)
  moderateLengthMax: 1000, // Medium prompts (200-1000 chars)
  simpleScoreMax: 30, // Score below 30 = simple
  complexScoreMin: 60, // Score 60+ = complex
};

/**
 * Keywords that indicate simple tasks.
 */
const SIMPLE_KEYWORDS = [
  // Questions
  "what is",
  "what are",
  "who is",
  "where is",
  "when is",
  "why is",
  "how do i",
  "how does",
  "can you",
  "could you",

  // Explanations
  "explain",
  "describe",
  "define",
  "tell me",
  "show me",

  // Gratitude/affirmation (specific greetings removed as they appear in code examples)
  "thanks",
  "thank you",

  // Simple queries
  "list",
  "summarize",
  "compare",
];

/**
 * Keywords that indicate moderate complexity tasks.
 */
const MODERATE_KEYWORDS = [
  // Analysis
  "analyze",
  "review",
  "evaluate",
  "assess",
  "check",
  "examine",

  // Documentation
  "document",
  "draft",
  "compose",

  // Code reading
  "understand",
  "trace",
  "follow",
  "walk through",
];

/**
 * Keywords that indicate complex tasks.
 */
const COMPLEX_KEYWORDS = [
  // Code generation
  "implement",
  "create",
  "build",
  "generate",
  "write",
  "develop",
  "add",

  // Code modification
  "refactor",
  "rewrite",
  "restructure",
  "reorganize",
  "migrate",
  "convert",
  "update",
  "modify",
  "change",

  // Debugging
  "debug",
  "fix",
  "solve",
  "resolve",
  "repair",
  "correct",

  // Architecture
  "design",
  "architect",
  "plan",
  "structure",

  // Optimization
  "optimize",
  "improve",
  "enhance",
  "upgrade",
];

/**
 * Tools that indicate editing/modification (complex).
 */
const EDIT_TOOLS = ["edit", "create", "powershell", "bash", "sql", "write_powershell"];

/**
 * Tools that indicate reading/viewing (moderate).
 */
const READ_TOOLS = ["view", "grep", "glob", "list_powershell", "read_powershell"];

/**
 * Classify task complexity using hybrid approach.
 */
export function classifyTaskComplexity(
  context: ClassificationContext,
  thresholds: ClassificationThresholds = DEFAULT_THRESHOLDS,
): ClassificationResult {
  // Apply thresholds with defaults
  const finalThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...thresholds,
  };

  // Check for forced complexity
  if (context.forceComplexity) {
    return {
      complexity: context.forceComplexity,
      confidence: 100,
      score: context.forceComplexity === "complex" ? 100 : context.forceComplexity === "simple" ? 0 : 50,
      breakdown: {
        keywordScore: 0,
        contextScore: 0,
        toolScore: 0,
      },
      reason: "Forced classification (manual override)",
    };
  }

  const prompt = context.prompt.toLowerCase();

  // 1. KEYWORD ANALYSIS (0-50 points) - increased max for better discrimination
  let keywordScore = 5; // Start very low

  // Simple keywords reduce score significantly
  const hasSimpleKeyword = SIMPLE_KEYWORDS.some((kw) => prompt.includes(kw));
  if (hasSimpleKeyword) {
    keywordScore = 0; // Simple keywords override everything
  }

  // Count complex keywords for better scoring
  const complexKeywordCount = COMPLEX_KEYWORDS.filter((kw) => prompt.includes(kw)).length;
  const moderateKeywordCount = MODERATE_KEYWORDS.filter((kw) => prompt.includes(kw)).length;

  if (!hasSimpleKeyword) {
    if (complexKeywordCount > 0) {
      // Complex keywords: 20 points base + 10 per additional
      keywordScore = 20 + Math.min(30, (complexKeywordCount - 1) * 10);
    } else if (moderateKeywordCount > 0) {
      // Moderate keywords: 10 points base + 5 per additional
      keywordScore = 10 + Math.min(10, (moderateKeywordCount - 1) * 5);
    }
  }

  // 2. LENGTH ANALYSIS - REMOVED
  // Message length doesn't indicate complexity. A short "refactor auth" is complex,
  // while a long explanation can be simple. Focus on WHAT is being asked, not HOW MUCH text.

  // 3. CONTEXT ANALYSIS (0-25 points)
  let contextScore = 0;

  if (context.hasFileContext) {
    contextScore += 10; // Working with files = more complex
  }

  // Conversation length removed: message #50 isn't inherently more complex than message #5
  // Users may have long conversations with simple messages or short conversations with complex ones

  // Reduced from +10 to +5: code blocks in conversational context aren't always complex tasks
  if (context.hasCodeBlocks) {
    contextScore += 5; // Code in prompt = moderately complex
  }

  // 4. TOOL USAGE (0-20 points)
  let toolScore = 0;
  const tools = context.requestedTools ?? [];

  if (tools.some((t) => EDIT_TOOLS.includes(t))) {
    toolScore += 20; // Editing requires precision
  } else if (tools.some((t) => READ_TOOLS.includes(t))) {
    toolScore += 10; // Reading is moderate
  }

  // 5. ATTACHMENTS (bonus points)
  if (context.hasAttachments) {
    contextScore += 5; // Images/files = more complex
  }

  // Total score (now max 95: keywords 50 + context 20 + tools 20 + attachments 5)
  const totalScore = keywordScore + contextScore + toolScore;

  // Classify based on score
  let complexity: TaskComplexity;
  let confidence: number;
  let reason: string;

  if (totalScore < finalThresholds.simpleScoreMax) {
    complexity = "simple";
    // Confidence increases as score decreases from threshold
    const distance = finalThresholds.simpleScoreMax - totalScore;
    confidence = Math.min(100, Math.max(50, distance * 3)); // 50-100% confidence
    reason = "Low score indicates simple task (chat, questions, definitions)";
  } else if (totalScore < finalThresholds.complexScoreMin) {
    complexity = "moderate";
    confidence = 70; // Moderate is less certain (middle ground)
    reason = "Medium score indicates moderate complexity (analysis, documentation)";
  } else {
    complexity = "complex";
    // Confidence increases with score above threshold
    const distance = totalScore - finalThresholds.complexScoreMin;
    confidence = Math.min(100, Math.max(70, 70 + distance)); // 70-100% confidence
    reason = "High score indicates complex task (coding, debugging, architecture)";
  }

  return {
    complexity,
    confidence,
    score: totalScore,
    breakdown: {
      keywordScore,
      contextScore,
      toolScore,
    },
    reason,
  };
}

/**
 * Detect if prompt contains code blocks.
 */
export function hasCodeBlocks(prompt: string): boolean {
  return /```[\s\S]*?```/.test(prompt) || /`[^`\n]+`/.test(prompt);
}

/**
 * Extract requested tools from prompt (if available).
 * This is a heuristic - actual tool detection happens during agent execution.
 */
export function detectLikelyTools(prompt: string): string[] {
  const tools: string[] = [];
  const lowerPrompt = prompt.toLowerCase();

  if (
    lowerPrompt.includes("edit") ||
    lowerPrompt.includes("change") ||
    lowerPrompt.includes("modify") ||
    lowerPrompt.includes("update")
  ) {
    tools.push("edit");
  }

  if (
    lowerPrompt.includes("create") ||
    lowerPrompt.includes("add file") ||
    lowerPrompt.includes("new file")
  ) {
    tools.push("create");
  }

  if (lowerPrompt.includes("view") || lowerPrompt.includes("show me") || lowerPrompt.includes("read")) {
    tools.push("view");
  }

  if (lowerPrompt.includes("search") || lowerPrompt.includes("find") || lowerPrompt.includes("grep")) {
    tools.push("grep");
  }

  if (lowerPrompt.includes("run") || lowerPrompt.includes("execute") || lowerPrompt.includes("command")) {
    tools.push("powershell");
  }

  return tools;
}

/**
 * Build classification context from prompt and session info.
 */
export function buildClassificationContext(
  prompt: string,
  options: {
    conversationLength?: number;
    hasFileContext?: boolean;
    sessionCost?: number;
    forceComplexity?: TaskComplexity;
  } = {},
): ClassificationContext {
  return {
    prompt,
    conversationLength: options.conversationLength,
    hasFileContext: options.hasFileContext,
    requestedTools: detectLikelyTools(prompt),
    hasCodeBlocks: hasCodeBlocks(prompt),
    hasAttachments: false, // Would be set by caller if images/files attached
    sessionCost: options.sessionCost,
    forceComplexity: options.forceComplexity,
  };
}
