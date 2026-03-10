import { loadAuthProfileStore } from "../../agents/auth-profiles/store.js";
import { loadValidConfigOrThrow } from "./shared.js";
import chalk from "chalk";

/**
 * Display quota usage for auth profiles.
 */
export async function modelsAuthQuotaCommand(opts: {
  profileId?: string;
  json?: boolean;
}): Promise<void> {
  const config = loadValidConfigOrThrow();
  const store = await loadAuthProfileStore();

  // Filter profiles
  const profileIds = opts.profileId
    ? [opts.profileId]
    : Object.keys(store.profiles).sort();

  if (profileIds.length === 0) {
    console.log(chalk.yellow("No profiles found"));
    return;
  }

  // Check if profile exists
  if (opts.profileId && !store.profiles[opts.profileId]) {
    console.log(chalk.red(`Profile not found: ${opts.profileId}`));
    return;
  }

  if (opts.json) {
    const data = profileIds.map((id) => formatQuotaJson(id, config, store));
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Display quota table
  console.log();
  console.log(chalk.bold("Profile Quota Usage:"));
  console.log();

  for (const profileId of profileIds) {
    displayQuotaForProfile(profileId, config, store);
  }

  console.log();
}

function displayQuotaForProfile(profileId: string, config: any, store: any) {
  const cred = store.profiles[profileId];
  const profileConfig = config.auth?.profiles?.[profileId];
  const stats = store.usageStats?.[profileId];

  if (!cred) {
    console.log(chalk.red(`${profileId}: Profile not found`));
    return;
  }

  console.log(chalk.bold.cyan(profileId));
  console.log();

  // API Calls
  const quotaUsed = stats?.quotaUsedToday ?? 0;
  const quotaLimit = profileConfig?.dailyApiCallLimit;
  const quotaPercent = quotaLimit ? (quotaUsed / quotaLimit) * 100 : 0;

  console.log(chalk.bold("  API Calls:"));
  console.log(`    Today:     ${formatNumber(quotaUsed)}`);
  if (quotaLimit) {
    console.log(`    Limit:     ${formatNumber(quotaLimit)}`);
    console.log(`    Remaining: ${formatNumber(Math.max(0, quotaLimit - quotaUsed))}`);
    console.log(`    Usage:     ${formatPercentage(quotaPercent)}`);
  } else {
    console.log(`    Limit:     ${chalk.dim("Unlimited")}`);
  }
  console.log();

  // Tokens
  const tokenInputUsed = stats?.tokenInputUsedToday ?? 0;
  const tokenOutputUsed = stats?.tokenOutputUsedToday ?? 0;
  const tokenTotalUsed = tokenInputUsed + tokenOutputUsed;
  const tokenLimit = profileConfig?.dailyTokenLimit;
  const tokenPercent = tokenLimit ? (tokenTotalUsed / tokenLimit) * 100 : 0;

  console.log(chalk.bold("  Tokens:"));
  console.log(`    Input:     ${formatNumber(tokenInputUsed)}`);
  console.log(`    Output:    ${formatNumber(tokenOutputUsed)}`);
  console.log(`    Total:     ${formatNumber(tokenTotalUsed)}`);
  if (tokenLimit) {
    console.log(`    Limit:     ${formatNumber(tokenLimit)}`);
    console.log(`    Remaining: ${formatNumber(Math.max(0, tokenLimit - tokenTotalUsed))}`);
    console.log(`    Usage:     ${formatPercentage(tokenPercent)}`);
  } else {
    console.log(`    Limit:     ${chalk.dim("Unlimited")}`);
  }
  console.log();

  // Cost
  const cost = stats?.costToday ?? 0;
  if (cost > 0) {
    console.log(chalk.bold("  Cost:"));
    console.log(`    Today:     ${chalk.yellow(`$${cost.toFixed(4)}`)}`);
    console.log();
  }

  // Reset Info
  const lastReset = stats?.lastQuotaResetDate;
  const nextReset = config.auth?.loadBalancing?.dailyQuotaResetTime ?? "00:00";

  console.log(chalk.bold("  Reset Schedule:"));
  console.log(`    Last Reset:  ${lastReset ?? chalk.dim("Never")}`);
  console.log(`    Next Reset:  ${chalk.cyan(nextReset)} UTC`);
  console.log();

  // Rate Limits (from API headers)
  if (stats?.rateLimitRemaining !== undefined) {
    console.log(chalk.bold("  Rate Limits (from API):"));
    console.log(`    Requests:    ${formatNumber(stats.rateLimitRemaining)} remaining`);
    if (stats.rpm) {
      console.log(`    RPM Limit:   ${formatNumber(stats.rpm)}`);
    }
    if (stats.tpm) {
      console.log(`    TPM Limit:   ${formatNumber(stats.tpm)}`);
    }
    if (stats.rateLimitReset) {
      const resetTime = new Date(stats.rateLimitReset);
      const minutesUntil = Math.ceil((stats.rateLimitReset - Date.now()) / 60000);
      console.log(`    Resets in:   ${minutesUntil} minutes (${resetTime.toLocaleTimeString()})`);
    }
    console.log();
  }
}

function formatQuotaJson(profileId: string, config: any, store: any) {
  const profileConfig = config.auth?.profiles?.[profileId];
  const stats = store.usageStats?.[profileId];

  return {
    profileId,
    apiCalls: {
      used: stats?.quotaUsedToday ?? 0,
      limit: profileConfig?.dailyApiCallLimit ?? null,
      remaining: profileConfig?.dailyApiCallLimit
        ? Math.max(0, profileConfig.dailyApiCallLimit - (stats?.quotaUsedToday ?? 0))
        : null,
    },
    tokens: {
      input: stats?.tokenInputUsedToday ?? 0,
      output: stats?.tokenOutputUsedToday ?? 0,
      total: (stats?.tokenInputUsedToday ?? 0) + (stats?.tokenOutputUsedToday ?? 0),
      limit: profileConfig?.dailyTokenLimit ?? null,
      remaining: profileConfig?.dailyTokenLimit
        ? Math.max(
            0,
            profileConfig.dailyTokenLimit -
              ((stats?.tokenInputUsedToday ?? 0) + (stats?.tokenOutputUsedToday ?? 0)),
          )
        : null,
    },
    cost: {
      today: stats?.costToday ?? 0,
    },
    reset: {
      lastResetDate: stats?.lastQuotaResetDate ?? null,
      nextResetTime: config.auth?.loadBalancing?.dailyQuotaResetTime ?? "00:00",
    },
    rateLimits: {
      requestsRemaining: stats?.rateLimitRemaining ?? null,
      rpm: stats?.rpm ?? null,
      tpm: stats?.tpm ?? null,
      resetTimestamp: stats?.rateLimitReset ?? null,
    },
  };
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatPercentage(percent: number): string {
  if (percent >= 90) {
    return chalk.red(`${percent.toFixed(1)}%`);
  } else if (percent >= 75) {
    return chalk.yellow(`${percent.toFixed(1)}%`);
  } else {
    return chalk.green(`${percent.toFixed(1)}%`);
  }
}
