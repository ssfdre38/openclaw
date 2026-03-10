/**
 * CLI: openclaw models routing status
 * Display current complexity routing configuration.
 */

import chalk from "chalk";
import type { Runtime } from "../../runtime.js";
import { loadConfig } from "../../config/config.js";

export async function modelsRoutingStatusCommand(runtime: Runtime) {
  const config = await loadConfig(runtime);
  const routing = config.agents?.defaults?.complexityRouting;

  if (!routing) {
    console.log(chalk.yellow("⚠ Complexity routing not configured"));
    console.log(
      chalk.dim(
        "\nRun: " + chalk.cyan("openclaw models routing configure") + " to set it up",
      ),
    );
    return;
  }

  console.log(chalk.bold("\n🎯 Complexity Routing Status\n"));

  // Enabled status
  console.log(
    chalk.bold("Status: ") +
      (routing.enabled ? chalk.green("✓ Enabled") : chalk.red("✗ Disabled")),
  );

  // Strategy
  if (routing.strategy) {
    const strategyLabels = {
      "cost-optimized": "💰 Cost-optimized (prioritize free models)",
      "quality-first": "⭐ Quality-first (prioritize best models)",
      "quota-aware": "📊 Quota-aware (distribute across quotas)",
    };
    console.log(
      chalk.bold("Strategy: ") +
        (strategyLabels[routing.strategy] || routing.strategy),
    );
  }

  // Model assignments
  console.log(chalk.bold("\nModel Assignments:\n"));

  const complexities: Array<keyof typeof routing.models> = [
    "simple",
    "moderate",
    "complex",
  ];

  for (const complexity of complexities) {
    const modelConfig = routing.models?.[complexity];
    if (!modelConfig) continue;

    const icon = {
      simple: "🟢",
      moderate: "🟡",
      complex: "🔴",
    }[complexity];

    console.log(chalk.bold(`  ${icon} ${complexity.toUpperCase()}`));

    if (typeof modelConfig === "string") {
      console.log(chalk.dim("    Primary: ") + chalk.cyan(modelConfig));
    } else {
      console.log(chalk.dim("    Primary: ") + chalk.cyan(modelConfig.primary));
      if (modelConfig.fallbacks && modelConfig.fallbacks.length > 0) {
        console.log(
          chalk.dim("    Fallbacks: ") +
            chalk.gray(modelConfig.fallbacks.join(", ")),
        );
      }
    }
  }

  // Thresholds
  if (routing.thresholds) {
    console.log(chalk.bold("\nComplexity Thresholds:\n"));
    console.log(
      chalk.dim("  Simple → Moderate: ") +
        chalk.yellow(routing.thresholds.simple ?? 30),
    );
    console.log(
      chalk.dim("  Moderate → Complex: ") +
        chalk.yellow(routing.thresholds.moderate ?? 60),
    );
  }

  // Cost control
  if (routing.costControl?.enabled) {
    console.log(chalk.bold("\n💵 Cost Control:\n"));

    if (routing.costControl.maxCostPerSession) {
      console.log(
        chalk.dim("  Max per session: ") +
          chalk.yellow(`$${routing.costControl.maxCostPerSession.toFixed(4)}`),
      );
    }

    if (routing.costControl.maxCostPerRequest) {
      console.log(
        chalk.dim("  Max per request: ") +
          chalk.yellow(`$${routing.costControl.maxCostPerRequest.toFixed(4)}`),
      );
    }

    console.log(
      chalk.dim("  Fallback: ") +
        chalk.cyan(routing.costControl.fallbackToFree ? "Free models" : "Disabled"),
    );
  }

  // Examples
  console.log(chalk.bold("\n📝 Example Tasks:\n"));
  console.log(chalk.dim("  Simple:   ") + chalk.white('"What is OpenClaw?"'));
  console.log(
    chalk.dim("  Moderate: ") + chalk.white('"Debug this error message"'),
  );
  console.log(
    chalk.dim("  Complex:  ") + chalk.white('"Implement OAuth2 authentication"'),
  );

  console.log(
    chalk.dim("\nTest classification: ") +
      chalk.cyan("openclaw models routing classify <prompt>"),
  );
  console.log();
}
