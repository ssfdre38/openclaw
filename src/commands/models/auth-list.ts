import { loadAuthProfileStore } from "../../agents/auth-profiles/store.js";
import type { AuthProfileStore } from "../../agents/auth-profiles/types.js";
import { getProfileHealthScore } from "../../agents/auth-profiles/quota-check.js";
import type { OpenClawConfig } from "../../config/config.js";
import { normalizeProviderIdForAuth } from "../../agents/model-selection.js";
import { loadValidConfigOrThrow } from "./shared.js";
import chalk from "chalk";

/**
 * List all auth profiles with status, quota, and health information.
 */
export async function modelsAuthListCommand(opts: {
  provider?: string;
  json?: boolean;
}): Promise<void> {
  const config = loadValidConfigOrThrow();
  const store = await loadAuthProfileStore();

  // Filter by provider if specified
  const allProfiles = Object.keys(store.profiles);
  const filtered = opts.provider
    ? allProfiles.filter((id) => {
        const cred = store.profiles[id];
        return cred && normalizeProviderIdForAuth(cred.provider) === normalizeProviderIdForAuth(opts.provider!);
      })
    : allProfiles;

  if (filtered.length === 0) {
    if (opts.provider) {
      console.log(chalk.yellow(`No profiles found for provider: ${opts.provider}`));
    } else {
      console.log(chalk.yellow("No auth profiles found."));
      console.log(chalk.dim("\nAdd a profile with: openclaw models auth paste-token --provider <name>"));
    }
    return;
  }

  if (opts.json) {
    const profiles = filtered.map((id) => formatProfileJson(id, config, store));
    console.log(JSON.stringify(profiles, null, 2));
    return;
  }

  // Table header
  console.log();
  console.log(chalk.bold("Auth Profiles:"));
  console.log();
  console.log(
    [
      chalk.bold("Profile ID"),
      chalk.bold("Provider"),
      chalk.bold("Type"),
      chalk.bold("Enabled"),
      chalk.bold("Health"),
      chalk.bold("Quota Today"),
      chalk.bold("Status"),
    ].join(" │ "),
  );
  console.log("─".repeat(120));

  // Table rows
  for (const profileId of filtered.sort()) {
    const row = formatProfileRow(profileId, config, store);
    console.log(row);
  }

  console.log();
  console.log(chalk.dim(`Total: ${filtered.length} profile(s)`));
  console.log();
}

function formatProfileRow(profileId: string, config: OpenClawConfig, store: AuthProfileStore): string {
  const cred = store.profiles[profileId];
  const profileConfig = config.auth?.profiles?.[profileId];
  const stats = store.usageStats?.[profileId];

  if (!cred) {
    return [
      chalk.red(profileId),
      chalk.dim("—"),
      chalk.dim("—"),
      chalk.dim("—"),
      chalk.dim("—"),
      chalk.dim("—"),
      chalk.red("Missing"),
    ].join(" │ ");
  }

  const provider = cred.provider;
  const type = cred.type;
  const enabled = profileConfig?.enabled !== false;
  const healthScore = getProfileHealthScore(config, store, profileId);
  const isInCooldown = healthScore < 0;
  const quotaUsed = stats?.quotaUsedToday ?? 0;
  const quotaLimit = profileConfig?.dailyApiCallLimit;

  // Format columns
  const idCol = enabled ? chalk.cyan(profileId) : chalk.dim(profileId);
  const providerCol = chalk.white(provider);
  const typeCol = type === "oauth" ? chalk.green("OAuth") : type === "token" ? chalk.yellow("Token") : chalk.blue("API Key");
  const enabledCol = enabled ? chalk.green("Yes") : chalk.red("No");
  
  let healthCol: string;
  if (!enabled) {
    healthCol = chalk.dim("—");
  } else if (isInCooldown) {
    healthCol = chalk.red("Cooldown");
  } else if (healthScore >= 80) {
    healthCol = chalk.green(healthScore.toFixed(0));
  } else if (healthScore >= 50) {
    healthCol = chalk.yellow(healthScore.toFixed(0));
  } else {
    healthCol = chalk.red(healthScore.toFixed(0));
  }

  const quotaCol = quotaLimit
    ? `${quotaUsed}/${quotaLimit}`
    : quotaUsed > 0
      ? quotaUsed.toString()
      : chalk.dim("—");

  let statusCol: string;
  if (!enabled) {
    statusCol = chalk.dim("Disabled");
  } else if (isInCooldown) {
    const cooldownUntil = stats?.cooldownUntil ?? stats?.disabledUntil;
    const minutesLeft = cooldownUntil ? Math.ceil((cooldownUntil - Date.now()) / 60000) : 0;
    statusCol = chalk.red(`Cooldown (${minutesLeft}m)`);
  } else if (quotaLimit && quotaUsed >= quotaLimit) {
    statusCol = chalk.red("Quota exceeded");
  } else if (quotaLimit && quotaUsed / quotaLimit > 0.8) {
    statusCol = chalk.yellow("Near limit");
  } else {
    statusCol = chalk.green("Active");
  }

  return [idCol, providerCol, typeCol, enabledCol, healthCol, quotaCol, statusCol].join(" │ ");
}

function formatProfileJson(profileId: string, config: OpenClawConfig, store: AuthProfileStore) {
  const cred = store.profiles[profileId];
  const profileConfig = config.auth?.profiles?.[profileId];
  const stats = store.usageStats?.[profileId];

  if (!cred) {
    return {
      profileId,
      error: "Profile not found in store",
    };
  }

  const healthScore = getProfileHealthScore(config, store, profileId);

  return {
    profileId,
    provider: cred.provider,
    type: cred.type,
    email: cred.email,
    enabled: profileConfig?.enabled !== false,
    config: {
      weight: profileConfig?.weight,
      priority: profileConfig?.priority,
      dailyApiCallLimit: profileConfig?.dailyApiCallLimit,
      dailyTokenLimit: profileConfig?.dailyTokenLimit,
      rpmLimit: profileConfig?.rpmLimit,
      tpmLimit: profileConfig?.tpmLimit,
    },
    usage: {
      quotaUsedToday: stats?.quotaUsedToday ?? 0,
      tokenInputUsedToday: stats?.tokenInputUsedToday ?? 0,
      tokenOutputUsedToday: stats?.tokenOutputUsedToday ?? 0,
      costToday: stats?.costToday ?? 0,
      lastUsed: stats?.lastUsed,
      lastQuotaResetDate: stats?.lastQuotaResetDate,
    },
    health: {
      score: healthScore,
      inCooldown: healthScore < 0,
      cooldownUntil: stats?.cooldownUntil,
      disabledUntil: stats?.disabledUntil,
      rateLimitRemaining: stats?.rateLimitRemaining,
    },
  };
}
