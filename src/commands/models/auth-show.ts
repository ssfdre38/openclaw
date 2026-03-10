import { loadAuthProfileStore } from "../../agents/auth-profiles/store.js";
import { getProfileHealthScore, getProfileApiCallQuotaRemaining, getProfileTokenQuotaRemaining } from "../../agents/auth-profiles/quota-check.js";
import { loadValidConfigOrThrow } from "./shared.js";
import chalk from "chalk";

/**
 * Show detailed information about a specific auth profile.
 */
export async function modelsAuthShowCommand(opts: { profileId: string }): Promise<void> {
  const config = loadValidConfigOrThrow();
  const store = await loadAuthProfileStore();

  const cred = store.profiles[opts.profileId];
  if (!cred) {
    console.log(chalk.red(`Profile not found: ${opts.profileId}`));
    console.log();
    console.log(chalk.dim("Available profiles:"));
    const profiles = Object.keys(store.profiles).sort();
    profiles.forEach((id) => console.log(chalk.dim(`  - ${id}`)));
    return;
  }

  const profileConfig = config.auth?.profiles?.[opts.profileId];
  const stats = store.usageStats?.[opts.profileId];
  const healthScore = getProfileHealthScore(config, store, opts.profileId);
  const quotaRemaining = getProfileApiCallQuotaRemaining(config, store, opts.profileId);
  const tokenRemaining = getProfileTokenQuotaRemaining(config, store, opts.profileId);

  // Header
  console.log();
  console.log(chalk.bold.cyan(opts.profileId));
  console.log("=".repeat(opts.profileId.length + 10));
  console.log();

  // Basic Info
  console.log(chalk.bold("Basic Information:"));
  console.log(`  Provider:  ${chalk.white(cred.provider)}`);
  console.log(`  Type:      ${formatCredentialType(cred.type)}`);
  console.log(`  Email:     ${cred.email ? chalk.white(cred.email) : chalk.dim("Not set")}`);
  console.log(`  Enabled:   ${profileConfig?.enabled !== false ? chalk.green("Yes") : chalk.red("No")}`);
  console.log();

  // Credentials (masked)
  console.log(chalk.bold("Credentials:"));
  if (cred.type === "api_key") {
    const masked = cred.key ? `${cred.key.slice(0, 8)}...${cred.key.slice(-4)}` : chalk.dim("Not set");
    console.log(`  API Key:   ${masked}`);
  } else if (cred.type === "token") {
    const masked = cred.token ? `${cred.token.slice(0, 8)}...${cred.token.slice(-4)}` : chalk.dim("Not set");
    console.log(`  Token:     ${masked}`);
    if (cred.expires) {
      const expiryDate = new Date(cred.expires);
      const isExpired = Date.now() >= cred.expires;
      console.log(`  Expires:   ${isExpired ? chalk.red(expiryDate.toISOString()) : chalk.yellow(expiryDate.toISOString())}`);
    }
  } else if (cred.type === "oauth") {
    console.log(`  OAuth:     ${cred.access ? chalk.green("Active") : chalk.red("Expired")}`);
    console.log(`  Refresh:   ${cred.refresh ? chalk.green("Available") : chalk.red("Not available")}`);
  }
  console.log();

  // Load Balancing Config
  console.log(chalk.bold("Load Balancing Configuration:"));
  console.log(`  Weight:              ${profileConfig?.weight ?? chalk.dim("100 (default)")}`);
  console.log(`  Priority:            ${profileConfig?.priority ?? chalk.dim("5 (default)")}`);
  console.log(`  Daily API Limit:     ${profileConfig?.dailyApiCallLimit ?? chalk.dim("Unlimited")}`);
  console.log(`  Daily Token Limit:   ${profileConfig?.dailyTokenLimit ?? chalk.dim("Unlimited")}`);
  console.log(`  RPM Limit:           ${profileConfig?.rpmLimit ?? chalk.dim("Not set")}`);
  console.log(`  TPM Limit:           ${profileConfig?.tpmLimit ?? chalk.dim("Not set")}`);
  console.log(`  Cooldown Multiplier: ${profileConfig?.cooldownMultiplier ?? chalk.dim("1.0 (default)")}`);
  console.log();

  // Usage Stats
  console.log(chalk.bold("Usage Statistics (Today):"));
  console.log(`  API Calls:      ${stats?.quotaUsedToday ?? 0}${quotaRemaining !== null ? ` / ${profileConfig?.dailyApiCallLimit} (${quotaRemaining} remaining)` : ""}`);
  console.log(`  Input Tokens:   ${(stats?.tokenInputUsedToday ?? 0).toLocaleString()}`);
  console.log(`  Output Tokens:  ${(stats?.tokenOutputUsedToday ?? 0).toLocaleString()}`);
  const totalTokens = (stats?.tokenInputUsedToday ?? 0) + (stats?.tokenOutputUsedToday ?? 0);
  console.log(`  Total Tokens:   ${totalTokens.toLocaleString()}${tokenRemaining !== null ? ` / ${profileConfig?.dailyTokenLimit?.toLocaleString()} (${tokenRemaining.toLocaleString()} remaining)` : ""}`);
  console.log(`  Cost Today:     ${stats?.costToday ? `$${stats.costToday.toFixed(4)}` : chalk.dim("Not tracked")}`);
  console.log(`  Last Used:      ${stats?.lastUsed ? new Date(stats.lastUsed).toLocaleString() : chalk.dim("Never")}`);
  console.log(`  Last Reset:     ${stats?.lastQuotaResetDate ?? chalk.dim("Never")}`);
  console.log();

  // Health Status
  console.log(chalk.bold("Health Status:"));
  const isInCooldown = healthScore < 0;
  if (isInCooldown) {
    console.log(`  Status:         ${chalk.red("In Cooldown")}`);
    const cooldownUntil = stats?.cooldownUntil ?? stats?.disabledUntil;
    if (cooldownUntil) {
      const until = new Date(cooldownUntil);
      const minutesLeft = Math.ceil((cooldownUntil - Date.now()) / 60000);
      console.log(`  Cooldown Until: ${chalk.yellow(until.toLocaleString())} (${minutesLeft} minutes)`);
    }
    if (stats?.disabledReason) {
      console.log(`  Reason:         ${chalk.red(stats.disabledReason)}`);
    }
  } else {
    console.log(`  Status:         ${chalk.green("Active")}`);
    console.log(`  Health Score:   ${formatHealthScore(healthScore)}/100`);
  }
  
  if (stats?.rateLimitRemaining !== undefined) {
    console.log(`  Rate Limit:     ${stats.rateLimitRemaining} requests remaining`);
  }
  if (stats?.rateLimitReset) {
    const resetTime = new Date(stats.rateLimitReset);
    console.log(`  Limit Resets:   ${resetTime.toLocaleString()}`);
  }
  if (stats?.rpm) {
    console.log(`  RPM Limit:      ${stats.rpm} requests/minute`);
  }
  if (stats?.tpm) {
    console.log(`  TPM Limit:      ${stats.tpm.toLocaleString()} tokens/minute`);
  }
  console.log();

  // Error History
  if (stats?.errorCount && stats.errorCount > 0) {
    console.log(chalk.bold("Error History:"));
    console.log(`  Total Errors:   ${chalk.red(stats.errorCount.toString())}`);
    if (stats.failureCounts) {
      const failures = Object.entries(stats.failureCounts)
        .filter(([, count]) => count && count > 0)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
      
      if (failures.length > 0) {
        console.log(`  By Type:`);
        failures.forEach(([reason, count]) => {
          console.log(`    ${reason}: ${count}`);
        });
      }
    }
    if (stats.lastFailureAt) {
      console.log(`  Last Failure:   ${new Date(stats.lastFailureAt).toLocaleString()}`);
    }
    console.log();
  }
}

function formatCredentialType(type: string): string {
  switch (type) {
    case "oauth":
      return chalk.green("OAuth");
    case "token":
      return chalk.yellow("Token");
    case "api_key":
      return chalk.blue("API Key");
    default:
      return chalk.dim(type);
  }
}

function formatHealthScore(score: number): string {
  if (score >= 80) {
    return chalk.green(score.toFixed(1));
  } else if (score >= 50) {
    return chalk.yellow(score.toFixed(1));
  } else {
    return chalk.red(score.toFixed(1));
  }
}
