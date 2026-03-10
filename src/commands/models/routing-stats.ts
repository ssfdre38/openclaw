/**
 * CLI: openclaw models routing stats
 * Display routing metrics and cost savings dashboard.
 */

import chalk from "chalk";
import type { Runtime } from "../../runtime.js";
import { getRoutingMetricsSummary, getRecentRoutingDecisions } from "../../agents/routing-metrics.js";

interface StatsOptions {
  hours?: number;
  recent?: number;
  json?: boolean;
}

export async function modelsRoutingStatsCommand(
  runtime: Runtime,
  options: StatsOptions = {},
) {
  const summary = getRoutingMetricsSummary({
    sinceHours: options.hours,
  });

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  // Visual dashboard
  console.log(chalk.bold("\n📊 Complexity Routing Statistics\n"));

  // Time period
  if (options.hours) {
    console.log(chalk.dim(`Period: Last ${options.hours} hours\n`));
  } else {
    console.log(chalk.dim(`Period: All time\n`));
  }

  // Total requests
  console.log(
    chalk.bold("Total Requests: ") + chalk.cyan(summary.totalRequests.toString()),
  );

  if (summary.totalRequests === 0) {
    console.log(chalk.yellow("\n⚠ No routing data yet"));
    console.log(
      chalk.dim(
        "\nStart using OpenClaw with complexity routing enabled to see statistics.",
      ),
    );
    return;
  }

  // Complexity distribution
  console.log(chalk.bold("\n🎯 Complexity Distribution:\n"));

  const total = summary.totalRequests;
  const complexities: Array<{
    key: keyof typeof summary.byComplexity;
    label: string;
    icon: string;
    color: (s: string) => string;
  }> = [
    { key: "simple", label: "Simple", icon: "🟢", color: chalk.green },
    { key: "moderate", label: "Moderate", icon: "🟡", color: chalk.yellow },
    { key: "complex", label: "Complex", icon: "🔴", color: chalk.red },
  ];

  for (const complexity of complexities) {
    const count = summary.byComplexity[complexity.key];
    const percent = ((count / total) * 100).toFixed(1);
    const barLength = Math.round((count / total) * 20);
    const bar = "▓".repeat(barLength).padEnd(20, "░");

    console.log(
      `  ${complexity.icon} ${complexity.label.padEnd(10)} ` +
        complexity.color(`${count.toString().padStart(4)} `) +
        chalk.dim(`(${percent}%) `) +
        complexity.color(bar),
    );
  }

  // Cost savings
  console.log(chalk.bold("\n💰 Cost Savings:\n"));

  const savings = summary.totalCostSavings;
  const avgCost = summary.averageCostPerRequest;

  console.log(
    chalk.dim("  Total saved:    ") +
      chalk.green(`$${savings.toFixed(4)}`),
  );
  console.log(
    chalk.dim("  Avg per request: ") +
      chalk.yellow(`$${avgCost.toFixed(6)}`),
  );

  const freeRequestCount =
    summary.byComplexity.simple + summary.byComplexity.moderate;
  const freePercent = ((freeRequestCount / total) * 100).toFixed(1);

  console.log(
    chalk.dim("  Free requests:   ") +
      chalk.cyan(`${freeRequestCount} (${freePercent}%)`),
  );

  // Model usage
  console.log(chalk.bold("\n🤖 Model Usage:\n"));

  const sortedModels = Object.entries(summary.modelUsageCount).sort(
    ([, a], [, b]) => b - a,
  );

  for (const [model, count] of sortedModels.slice(0, 10)) {
    const percent = ((count / total) * 100).toFixed(1);
    const barLength = Math.round((count / total) * 15);
    const bar = "▓".repeat(barLength);

    console.log(
      chalk.dim("  " + model.padEnd(45)) +
        chalk.cyan(`${count.toString().padStart(4)} `) +
        chalk.dim(`(${percent}%) `) +
        chalk.gray(bar),
    );
  }

  // Recent decisions
  if (options.recent) {
    const recent = getRecentRoutingDecisions(options.recent);

    console.log(chalk.bold(`\n📝 Recent Decisions (last ${options.recent}):\n`));

    for (const entry of recent.reverse()) {
      const icon = {
        simple: "🟢",
        moderate: "🟡",
        complex: "🔴",
      }[entry.complexity];

      const time = new Date(entry.timestamp).toLocaleTimeString();
      const cost = entry.estimatedCost
        ? `$${entry.estimatedCost.toFixed(4)}`
        : "free";

      console.log(
        chalk.dim(time) +
          ` ${icon} ${entry.complexity.padEnd(8)} ` +
          chalk.cyan(entry.modelUsed.padEnd(40)) +
          chalk.yellow(cost.padStart(10)),
      );
    }
  }

  // Tips
  console.log(chalk.bold("\n💡 Tips:\n"));
  console.log(
    chalk.dim("  • Use ") +
      chalk.cyan("--hours 24") +
      chalk.dim(" to see last 24 hours"),
  );
  console.log(
    chalk.dim("  • Use ") +
      chalk.cyan("--recent 50") +
      chalk.dim(" to see recent decisions"),
  );
  console.log(
    chalk.dim("  • Use ") +
      chalk.cyan("--json") +
      chalk.dim(" for machine-readable output"),
  );

  console.log();
}
