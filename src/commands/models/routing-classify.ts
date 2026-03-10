/**
 * CLI: openclaw models routing classify
 * Test task classification with a prompt.
 */

import chalk from "chalk";
import type { Runtime } from "../../runtime.js";
import { classifyTaskComplexity } from "../../agents/task-classifier.js";
import type { ClassificationContext } from "../../agents/complexity-routing.types.js";

interface ClassifyOptions {
  json?: boolean;
  verbose?: boolean;
}

export async function modelsRoutingClassifyCommand(
  runtime: Runtime,
  prompt: string,
  options: ClassifyOptions,
) {
  if (!prompt || prompt.trim().length === 0) {
    console.error(chalk.red("Error: Prompt required"));
    console.log(chalk.dim("\nUsage: ") + chalk.cyan("openclaw models routing classify <prompt>"));
    process.exit(1);
  }

  // Build minimal context
  const context: ClassificationContext = {
    prompt,
    conversationLength: 1,
    hasFileContext: false,
    requestedTools: [],
  };

  const result = classifyTaskComplexity(context);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Visual output
  console.log(chalk.bold("\n🎯 Task Classification\n"));

  // Complexity with visual indicator
  const complexityBar = {
    simple: chalk.green("▓▓▓░░░░░░░"),
    moderate: chalk.yellow("▓▓▓▓▓▓░░░░"),
    complex: chalk.red("▓▓▓▓▓▓▓▓▓▓"),
  }[result.complexity];

  const complexityIcon = {
    simple: "🟢",
    moderate: "🟡",
    complex: "🔴",
  }[result.complexity];

  console.log(
    chalk.bold("Complexity: ") +
      `${complexityIcon} ${chalk.bold(result.complexity.toUpperCase())} ` +
      complexityBar,
  );
  console.log(chalk.dim("Score: ") + chalk.yellow(result.score.toFixed(1)) + chalk.dim("/100"));

  // Confidence
  if (result.confidence !== undefined) {
    const confidencePercent = (result.confidence * 100).toFixed(0);
    const confidenceBarLength = Math.min(Math.round(result.confidence * 10), 10);
    const confidenceBar =
      result.confidence >= 0.8
        ? chalk.green("▓".repeat(confidenceBarLength))
        : result.confidence >= 0.5
          ? chalk.yellow("▓".repeat(confidenceBarLength))
          : chalk.red("▓".repeat(confidenceBarLength));
    console.log(
      chalk.dim("Confidence: ") +
        chalk.white(confidencePercent + "% ") +
        confidenceBar,
    );
  }

  // Score breakdown (verbose mode)
  if (options.verbose && result.factors) {
    console.log(chalk.bold("\n📊 Score Breakdown:\n"));

    const factors = [
      { name: "Keywords", value: result.factors.keywordScore, max: 30 },
      { name: "Length", value: result.factors.lengthScore, max: 25 },
      { name: "Context", value: result.factors.contextScore, max: 25 },
      { name: "Tools", value: result.factors.toolScore, max: 20 },
    ];

    for (const factor of factors) {
      const percent = ((factor.value / factor.max) * 100).toFixed(0);
      const bar = "▓".repeat(Math.round((factor.value / factor.max) * 10));
      console.log(
        chalk.dim(`  ${factor.name.padEnd(10)}: `) +
          chalk.yellow(`${factor.value.toFixed(1)}`.padStart(5)) +
          chalk.dim(`/${factor.max} `) +
          chalk.gray(`(${percent}%) ${bar}`),
      );
    }
  }

  // Reasoning
  if (result.reasoning) {
    console.log(chalk.bold("\n💭 Reasoning:\n"));
    console.log(chalk.dim("  " + result.reasoning));
  }

  // Recommended model
  console.log(chalk.bold("\n🤖 Recommended Model Type:\n"));

  const recommendations = {
    simple: {
      type: "Fast, local models",
      examples: ["ollama/qwen3.5:latest", "ollama/llama3.3", "ollama/phi3.5"],
      cost: "Free (local)",
    },
    moderate: {
      type: "Capable coding models",
      examples: [
        "ollama/qwen3-coder:32b",
        "github-copilot/claude-haiku-4.5",
        "ollama/deepseek-r1",
      ],
      cost: "Free/Low cost",
    },
    complex: {
      type: "Premium frontier models",
      examples: [
        "github-copilot/claude-sonnet-4.5",
        "github-copilot/gpt-5.2",
        "github-copilot/claude-opus-4.5",
      ],
      cost: "Premium ($0.003-0.075/1k tokens)",
    },
  }[result.complexity];

  console.log(chalk.dim("  Type: ") + chalk.cyan(recommendations.type));
  console.log(
    chalk.dim("  Examples: ") +
      chalk.gray(recommendations.examples.slice(0, 2).join(", ")),
  );
  console.log(chalk.dim("  Cost: ") + chalk.yellow(recommendations.cost));

  // Prompt preview
  console.log(chalk.bold("\n📝 Prompt:\n"));
  const preview = prompt.length > 200 ? prompt.slice(0, 200) + "..." : prompt;
  console.log(chalk.dim("  " + preview.replace(/\n/g, "\n  ")));

  console.log();
}
