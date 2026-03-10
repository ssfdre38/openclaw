import { loadAuthProfileStore } from "../../agents/auth-profiles/store.js";
import { loadValidConfigOrThrow } from "./shared.js";
import chalk from "chalk";

/**
 * Display rate limit information from API headers.
 */
export async function modelsAuthRateLimitsCommand(opts: {
  provider?: string;
  json?: boolean;
}): Promise<void> {
  const config = loadValidConfigOrThrow();
  const store = await loadAuthProfileStore();

  // Filter profiles by provider if specified
  const allProfiles = Object.keys(store.profiles).sort();
  const profileIds = opts.provider
    ? allProfiles.filter((id) => store.profiles[id].provider === opts.provider)
    : allProfiles;

  if (profileIds.length === 0) {
    if (opts.provider) {
      console.log(chalk.yellow(`No profiles found for provider: ${opts.provider}`));
    } else {
      console.log(chalk.yellow("No profiles found"));
    }
    return;
  }

  if (opts.json) {
    const data = profileIds.map((id) => formatRateLimitJson(id, store));
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Display rate limits table
  console.log();
  console.log(chalk.bold("Rate Limits (from API headers):"));
  console.log();

  for (const profileId of profileIds) {
    displayRateLimitForProfile(profileId, config, store);
  }

  console.log();
  console.log(chalk.dim("Note: Rate limits are populated after making API calls."));
  console.log(chalk.dim("Profiles that haven't been used yet will show 'Not available'."));
  console.log();
}

function displayRateLimitForProfile(profileId: string, config: any, store: any) {
  const cred = store.profiles[profileId];
  const stats = store.usageStats?.[profileId];

  if (!cred) {
    return;
  }

  const hasRateLimits =
    stats?.rateLimitRemaining !== undefined ||
    stats?.rpm !== undefined ||
    stats?.tpm !== undefined;

  console.log(chalk.bold.cyan(profileId));
  console.log(chalk.dim(`  Provider: ${cred.provider}`));
  console.log();

  if (!hasRateLimits) {
    console.log(chalk.dim("  Rate limits: Not available"));
    console.log(chalk.dim("  (Make an API call to populate rate limit data)"));
    console.log();
    return;
  }

  // Requests remaining
  if (stats.rateLimitRemaining !== undefined) {
    const color = stats.rateLimitRemaining < 10 ? chalk.red : chalk.green;
    console.log(chalk.bold("  Requests:"));
    console.log(`    Remaining: ${color(formatNumber(stats.rateLimitRemaining))}`);
  }

  // RPM (Requests per minute)
  if (stats.rpm !== undefined) {
    console.log(`    RPM Limit: ${chalk.cyan(formatNumber(stats.rpm))}`);
    if (stats.rateLimitRemaining !== undefined) {
      const percentUsed = ((stats.rpm - stats.rateLimitRemaining) / stats.rpm) * 100;
      console.log(`    Usage:     ${formatPercentage(percentUsed)}`);
    }
  }

  console.log();

  // TPM (Tokens per minute)
  if (stats.tpm !== undefined) {
    console.log(chalk.bold("  Tokens:"));
    console.log(`    TPM Limit: ${chalk.cyan(formatNumber(stats.tpm))}`);
    console.log();
  }

  // Reset time
  if (stats.rateLimitReset) {
    const now = Date.now();
    const resetTime = new Date(stats.rateLimitReset);
    const minutesUntil = Math.ceil((stats.rateLimitReset - now) / 60000);
    const secondsUntil = Math.ceil((stats.rateLimitReset - now) / 1000);

    console.log(chalk.bold("  Reset:"));
    if (minutesUntil > 0) {
      console.log(`    In:   ${chalk.yellow(`${minutesUntil} minute${minutesUntil !== 1 ? "s" : ""}`)}`);
    } else if (secondsUntil > 0) {
      console.log(`    In:   ${chalk.yellow(`${secondsUntil} second${secondsUntil !== 1 ? "s" : ""}`)}`);
    } else {
      console.log(`    In:   ${chalk.green("Now (will reset on next API call)")}`);
    }
    console.log(`    Time: ${chalk.dim(resetTime.toLocaleString())}`);
    console.log();
  }

  // Last used
  if (stats?.lastUsed) {
    const lastUsedDate = new Date(stats.lastUsed);
    const minutesAgo = Math.floor((Date.now() - stats.lastUsed) / 60000);
    console.log(chalk.bold("  Last Used:"));
    console.log(`    ${lastUsedDate.toLocaleString()} ${chalk.dim(`(${minutesAgo}m ago)`)}`);
    console.log();
  }

  // Cooldown status
  const isInCooldown =
    (stats?.cooldownUntil && Date.now() < stats.cooldownUntil) ||
    (stats?.disabledUntil && Date.now() < stats.disabledUntil);

  if (isInCooldown) {
    const until = stats?.cooldownUntil ?? stats?.disabledUntil;
    const minutesLeft = Math.ceil((until! - Date.now()) / 60000);
    console.log(chalk.bold("  Status:"));
    console.log(`    ${chalk.yellow(`In cooldown (${minutesLeft} minutes remaining)`)}`);
    console.log();
  }
}

function formatRateLimitJson(profileId: string, store: any) {
  const cred = store.profiles[profileId];
  const stats = store.usageStats?.[profileId];

  return {
    profileId,
    provider: cred?.provider,
    rateLimits: {
      requestsRemaining: stats?.rateLimitRemaining ?? null,
      rpm: stats?.rpm ?? null,
      tpm: stats?.tpm ?? null,
      resetTimestamp: stats?.rateLimitReset ?? null,
      resetIn: stats?.rateLimitReset
        ? Math.ceil((stats.rateLimitReset - Date.now()) / 1000)
        : null,
    },
    lastUsed: stats?.lastUsed ?? null,
    cooldown: {
      active:
        (stats?.cooldownUntil && Date.now() < stats.cooldownUntil) ||
        (stats?.disabledUntil && Date.now() < stats.disabledUntil),
      until: stats?.cooldownUntil ?? stats?.disabledUntil ?? null,
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
