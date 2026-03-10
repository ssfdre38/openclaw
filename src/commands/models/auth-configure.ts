import { confirm as clackConfirm, text as clackText } from "@clack/prompts";
import { loadAuthProfileStore, updateAuthProfileStoreWithLock } from "../../agents/auth-profiles/store.js";
import { loadValidConfigOrThrow, updateConfig } from "./shared.js";
import { stylePromptHint, stylePromptMessage } from "../../terminal/prompt-style.js";
import chalk from "chalk";

const confirm = (params: Parameters<typeof clackConfirm>[0]) =>
  clackConfirm({
    ...params,
    message: stylePromptMessage(params.message),
  });

const text = (params: Parameters<typeof clackText>[0]) =>
  clackText({
    ...params,
    message: stylePromptMessage(params.message),
  });

/**
 * Configure load balancing settings for an auth profile.
 */
export async function modelsAuthConfigureCommand(opts: {
  profileId: string;
  weight?: number;
  priority?: number;
  dailyLimit?: number;
  tokenLimit?: number;
  enabled?: boolean;
  interactive?: boolean;
}): Promise<void> {
  const config = loadValidConfigOrThrow();
  const store = await loadAuthProfileStore();

  // Validate profile exists
  const cred = store.profiles[opts.profileId];
  if (!cred) {
    console.log(chalk.red(`Profile not found: ${opts.profileId}`));
    console.log();
    console.log(chalk.dim("Available profiles:"));
    const profiles = Object.keys(store.profiles).sort();
    profiles.forEach((id) => console.log(chalk.dim(`  - ${id}`)));
    return;
  }

  // Interactive mode
  if (opts.interactive || (!opts.weight && !opts.priority && !opts.dailyLimit && !opts.tokenLimit && opts.enabled === undefined)) {
    await runInteractiveConfigure(opts.profileId, config);
    return;
  }

  // Direct configuration mode
  const currentConfig = config.auth?.profiles?.[opts.profileId] ?? {};
  const updates: Record<string, unknown> = {};

  if (opts.weight !== undefined) {
    if (opts.weight < 0 || opts.weight > 100) {
      throw new Error("Weight must be between 0 and 100");
    }
    updates.weight = opts.weight;
  }

  if (opts.priority !== undefined) {
    if (opts.priority < 1 || opts.priority > 10) {
      throw new Error("Priority must be between 1 and 10");
    }
    updates.priority = opts.priority;
  }

  if (opts.dailyLimit !== undefined) {
    if (opts.dailyLimit < 0) {
      throw new Error("Daily limit must be non-negative");
    }
    updates.dailyApiCallLimit = opts.dailyLimit;
  }

  if (opts.tokenLimit !== undefined) {
    if (opts.tokenLimit < 0) {
      throw new Error("Token limit must be non-negative");
    }
    updates.dailyTokenLimit = opts.tokenLimit;
  }

  if (opts.enabled !== undefined) {
    updates.enabled = opts.enabled;
  }

  // Apply updates
  const newConfig = {
    ...currentConfig,
    ...updates,
  };

  await updateConfig((cfg) => {
    if (!cfg.auth) {
      cfg.auth = {};
    }
    if (!cfg.auth.profiles) {
      cfg.auth.profiles = {};
    }
    cfg.auth.profiles[opts.profileId] = {
      provider: cred.provider,
      mode: cred.type as "api_key" | "oauth" | "token",
      ...newConfig,
    };
  });

  console.log();
  console.log(chalk.green(`✓ Configuration updated for ${opts.profileId}`));
  console.log();
  console.log(chalk.bold("Current settings:"));
  Object.entries(updates).forEach(([key, value]) => {
    console.log(`  ${key}: ${chalk.cyan(String(value))}`);
  });
  console.log();
}

async function runInteractiveConfigure(profileId: string, config: any) {
  const store = await loadAuthProfileStore();
  const cred = store.profiles[profileId];
  const currentConfig = config.auth?.profiles?.[profileId] ?? {};

  console.log();
  console.log(chalk.bold(`Configure ${profileId}`));
  console.log();

  const weight = await text({
    message: "Weight (0-100, higher = more requests)",
    placeholder: String(currentConfig.weight ?? 100),
    validate: (value) => {
      if (!value) return undefined;
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0 || num > 100) {
        return "Weight must be between 0 and 100";
      }
      return undefined;
    },
  });

  if (typeof weight === "symbol") {
    console.log(chalk.yellow("Configuration cancelled"));
    return;
  }

  const priority = await text({
    message: "Priority (1-10, higher = prefer first)",
    placeholder: String(currentConfig.priority ?? 5),
    validate: (value) => {
      if (!value) return undefined;
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1 || num > 10) {
        return "Priority must be between 1 and 10";
      }
      return undefined;
    },
  });

  if (typeof priority === "symbol") {
    console.log(chalk.yellow("Configuration cancelled"));
    return;
  }

  const dailyLimit = await text({
    message: "Daily API call limit (0 = unlimited)",
    placeholder: String(currentConfig.dailyApiCallLimit ?? 0),
    validate: (value) => {
      if (!value) return undefined;
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) {
        return "Daily limit must be non-negative";
      }
      return undefined;
    },
  });

  if (typeof dailyLimit === "symbol") {
    console.log(chalk.yellow("Configuration cancelled"));
    return;
  }

  const tokenLimit = await text({
    message: "Daily token limit (0 = unlimited)",
    placeholder: String(currentConfig.dailyTokenLimit ?? 0),
    validate: (value) => {
      if (!value) return undefined;
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) {
        return "Token limit must be non-negative";
      }
      return undefined;
    },
  });

  if (typeof tokenLimit === "symbol") {
    console.log(chalk.yellow("Configuration cancelled"));
    return;
  }

  const enabled = await confirm({
    message: "Enable this profile?",
    initialValue: currentConfig.enabled !== false,
  });

  if (typeof enabled === "symbol") {
    console.log(chalk.yellow("Configuration cancelled"));
    return;
  }

  // Build new config
  const newConfig: any = {
    provider: cred.provider,
    mode: cred.type,
  };

  if (weight && weight.trim()) {
    newConfig.weight = parseInt(weight, 10);
  }
  if (priority && priority.trim()) {
    newConfig.priority = parseInt(priority, 10);
  }
  if (dailyLimit && dailyLimit.trim()) {
    const limit = parseInt(dailyLimit, 10);
    if (limit > 0) {
      newConfig.dailyApiCallLimit = limit;
    }
  }
  if (tokenLimit && tokenLimit.trim()) {
    const limit = parseInt(tokenLimit, 10);
    if (limit > 0) {
      newConfig.dailyTokenLimit = limit;
    }
  }
  newConfig.enabled = Boolean(enabled);

  // Apply updates
  await updateConfig((cfg) => {
    if (!cfg.auth) {
      cfg.auth = {};
    }
    if (!cfg.auth.profiles) {
      cfg.auth.profiles = {};
    }
    cfg.auth.profiles[profileId] = newConfig;
  });

  console.log();
  console.log(chalk.green(`✓ Configuration saved for ${profileId}`));
  console.log();
}
