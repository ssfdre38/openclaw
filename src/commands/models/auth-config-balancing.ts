import { select as clackSelect, text as clackText, confirm as clackConfirm } from "@clack/prompts";
import { loadValidConfigOrThrow, updateConfig } from "./shared.js";
import { stylePromptMessage } from "../../terminal/prompt-style.js";
import chalk from "chalk";

const select = (params: Parameters<typeof clackSelect>[0]) =>
  clackSelect({
    ...params,
    message: stylePromptMessage(params.message),
  });

const text = (params: Parameters<typeof clackText>[0]) =>
  clackText({
    ...params,
    message: stylePromptMessage(params.message),
  });

const confirm = (params: Parameters<typeof clackConfirm>[0]) =>
  clackConfirm({
    ...params,
    message: stylePromptMessage(params.message),
  });

/**
 * Interactive wizard for configuring load balancing.
 */
export async function modelsAuthConfigBalancingCommand(): Promise<void> {
  const config = loadValidConfigOrThrow();

  console.log();
  console.log(chalk.bold("Load Balancing Configuration Wizard"));
  console.log();
  console.log(
    chalk.dim(
      "This wizard will help you configure multi-account load balancing for OpenClaw.",
    ),
  );
  console.log();

  // Step 1: Enable load balancing
  const currentlyEnabled = config.auth?.loadBalancing?.enabled ?? false;

  console.log(chalk.bold("Step 1: Enable Load Balancing"));
  console.log(
    chalk.dim(`Currently: ${currentlyEnabled ? chalk.green("Enabled") : chalk.red("Disabled")}`),
  );
  console.log();

  const enableLb = await confirm({
    message: "Enable load balancing?",
    initialValue: currentlyEnabled,
  });

  if (typeof enableLb === "symbol") {
    console.log(chalk.yellow("Configuration cancelled"));
    return;
  }

  if (!enableLb) {
    console.log();
    console.log(chalk.yellow("Load balancing will remain disabled"));
    console.log(
      chalk.dim("You can enable it later with: openclaw config set auth.loadBalancing.enabled true"),
    );
    return;
  }

  // Step 2: Select strategy
  console.log();
  console.log(chalk.bold("Step 2: Selection Strategy"));
  console.log();

  const currentStrategy = config.auth?.loadBalancing?.strategy ?? "round-robin";

  const strategy = await select({
    message: "Choose a load balancing strategy:",
    initialValue: currentStrategy,
    options: [
      {
        value: "round-robin",
        label: "Round Robin",
        hint: "Cycle through profiles evenly (default, simplest)",
      },
      {
        value: "weighted",
        label: "Weighted",
        hint: "Distribute based on profile weights (70% A, 30% B)",
      },
      {
        value: "quota-aware",
        label: "Quota Aware",
        hint: "Prefer profiles with most quota remaining (recommended)",
      },
      {
        value: "cost-optimized",
        label: "Cost Optimized",
        hint: "Prefer cheaper profiles when available",
      },
    ],
  });

  if (typeof strategy === "symbol") {
    console.log(chalk.yellow("Configuration cancelled"));
    return;
  }

  // Step 3: Quota tracking
  console.log();
  console.log(chalk.bold("Step 3: Quota Tracking"));
  console.log();

  const enableQuotaTracking = await confirm({
    message: "Enable quota tracking?",
    initialValue: config.auth?.loadBalancing?.quotaTracking !== false,
  });

  if (typeof enableQuotaTracking === "symbol") {
    console.log(chalk.yellow("Configuration cancelled"));
    return;
  }

  // Step 4: Rate limit parsing
  console.log();
  console.log(chalk.bold("Step 4: Rate Limit Parsing"));
  console.log();

  const parseRateLimits = await confirm({
    message: "Parse rate limit headers from API responses?",
    initialValue: config.auth?.loadBalancing?.parseRateLimitHeaders !== false,
  });

  if (typeof parseRateLimits === "symbol") {
    console.log(chalk.yellow("Configuration cancelled"));
    return;
  }

  // Step 5: Daily quota reset time
  console.log();
  console.log(chalk.bold("Step 5: Daily Quota Reset"));
  console.log();

  const currentResetTime = config.auth?.loadBalancing?.dailyQuotaResetTime ?? "00:00";

  const resetTime = await text({
    message: "Daily quota reset time (HH:MM UTC)",
    placeholder: currentResetTime,
    validate: (value) => {
      if (!value) return undefined;
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(value)) {
        return "Invalid time format. Use HH:MM (e.g., 00:00, 14:30)";
      }
      return undefined;
    },
  });

  if (typeof resetTime === "symbol") {
    console.log(chalk.yellow("Configuration cancelled"));
    return;
  }

  // Step 6: Fallback behavior
  console.log();
  console.log(chalk.bold("Step 6: Fallback Behavior"));
  console.log();

  const fallbackToRoundRobin = await confirm({
    message: "Fall back to round-robin if load balancing fails?",
    initialValue: config.auth?.loadBalancing?.fallbackToRoundRobin !== false,
  });

  if (typeof fallbackToRoundRobin === "symbol") {
    console.log(chalk.yellow("Configuration cancelled"));
    return;
  }

  // Summary and confirmation
  console.log();
  console.log(chalk.bold("Configuration Summary:"));
  console.log();
  console.log(`  Enabled:                ${chalk.cyan(String(enableLb))}`);
  console.log(`  Strategy:               ${chalk.cyan(strategy)}`);
  console.log(`  Quota Tracking:         ${chalk.cyan(String(enableQuotaTracking))}`);
  console.log(`  Parse Rate Limits:      ${chalk.cyan(String(parseRateLimits))}`);
  console.log(`  Daily Reset Time:       ${chalk.cyan(resetTime || currentResetTime)} UTC`);
  console.log(`  Fallback to Round Robin: ${chalk.cyan(String(fallbackToRoundRobin))}`);
  console.log();

  const confirmSave = await confirm({
    message: "Save this configuration?",
    initialValue: true,
  });

  if (typeof confirmSave === "symbol" || !confirmSave) {
    console.log(chalk.yellow("Configuration cancelled"));
    return;
  }

  // Apply configuration
  await updateConfig((cfg) => {
    if (!cfg.auth) {
      cfg.auth = {};
    }
    cfg.auth.loadBalancing = {
      enabled: enableLb,
      strategy: strategy as "round-robin" | "weighted" | "quota-aware" | "cost-optimized",
      quotaTracking: enableQuotaTracking,
      parseRateLimitHeaders: parseRateLimits,
      dailyQuotaResetTime: resetTime || currentResetTime,
      fallbackToRoundRobin: fallbackToRoundRobin,
    };
  });

  console.log();
  console.log(chalk.green("✓ Load balancing configuration saved"));
  console.log();

  // Next steps
  console.log(chalk.bold("Next Steps:"));
  console.log();
  console.log("1. Configure your auth profiles:");
  console.log(chalk.dim("   openclaw models auth list"));
  console.log(chalk.dim("   openclaw models auth configure <profileId>"));
  console.log();
  console.log("2. Set profile weights, priorities, and limits:");
  console.log(chalk.dim("   openclaw models auth configure <profileId> --weight 70 --priority 8"));
  console.log();
  console.log("3. Monitor usage:");
  console.log(chalk.dim("   openclaw models auth quota"));
  console.log();
  console.log("4. Restart the gateway to apply changes:");
  console.log(chalk.dim("   openclaw gateway restart"));
  console.log();
}
