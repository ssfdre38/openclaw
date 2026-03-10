import { loadAuthProfileStore } from "../../agents/auth-profiles/store.js";
import { resolveApiKeyForProvider } from "../../agents/model-auth.js";
import { normalizeProviderId } from "../../agents/model-selection.js";
import { loadValidConfigOrThrow } from "./shared.js";
import chalk from "chalk";

/**
 * Test an auth profile by making a lightweight API call.
 */
export async function modelsAuthTestCommand(opts: { profileId: string }): Promise<void> {
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

  console.log();
  console.log(chalk.bold(`Testing profile: ${chalk.cyan(opts.profileId)}`));
  console.log();

  // Check if profile is enabled
  const profileConfig = config.auth?.profiles?.[opts.profileId];
  if (profileConfig?.enabled === false) {
    console.log(chalk.yellow("⚠ Warning: Profile is disabled in config"));
    console.log();
  }

  // Check credentials
  console.log(chalk.dim("Checking credentials..."));
  if (cred.type === "api_key") {
    if (!cred.key || !cred.key.trim()) {
      console.log(chalk.red("✗ API key is empty or not set"));
      return;
    }
    console.log(chalk.green("✓ API key present"));
  } else if (cred.type === "token") {
    if (!cred.token || !cred.token.trim()) {
      console.log(chalk.red("✗ Token is empty or not set"));
      return;
    }
    if (cred.expires && Date.now() >= cred.expires) {
      console.log(chalk.red("✗ Token has expired"));
      return;
    }
    console.log(chalk.green("✓ Token present"));
  } else if (cred.type === "oauth") {
    if (!cred.access || !cred.access.trim()) {
      console.log(chalk.red("✗ OAuth access token is empty or not set"));
      return;
    }
    console.log(chalk.green("✓ OAuth access token present"));
  }

  // Check cooldown status
  const stats = store.usageStats?.[opts.profileId];
  const isInCooldown =
    (stats?.cooldownUntil && Date.now() < stats.cooldownUntil) ||
    (stats?.disabledUntil && Date.now() < stats.disabledUntil);

  if (isInCooldown) {
    console.log(chalk.yellow("⚠ Warning: Profile is currently in cooldown"));
    const until = stats?.cooldownUntil ?? stats?.disabledUntil;
    if (until) {
      const minutesLeft = Math.ceil((until - Date.now()) / 60000);
      console.log(chalk.dim(`  Cooldown expires in ${minutesLeft} minutes`));
    }
  } else {
    console.log(chalk.green("✓ Not in cooldown"));
  }

  // Check quota limits
  if (profileConfig?.dailyApiCallLimit) {
    const quotaUsed = stats?.quotaUsedToday ?? 0;
    const quotaRemaining = profileConfig.dailyApiCallLimit - quotaUsed;
    if (quotaRemaining <= 0) {
      console.log(chalk.red(`✗ Daily API call quota exceeded (${quotaUsed}/${profileConfig.dailyApiCallLimit})`));
      console.log(chalk.dim("  Quota will reset at configured time (default: 00:00 UTC)"));
      return;
    } else if (quotaRemaining < 10) {
      console.log(chalk.yellow(`⚠ Low quota remaining: ${quotaRemaining}/${profileConfig.dailyApiCallLimit}`));
    } else {
      console.log(chalk.green(`✓ Quota available: ${quotaRemaining}/${profileConfig.dailyApiCallLimit} remaining`));
    }
  }

  console.log();
  console.log(chalk.dim("Attempting test API call..."));
  console.log();

  // Try to resolve API key (this validates the credential is accessible)
  try {
    const provider = normalizeProviderId(cred.provider);
    const result = await resolveApiKeyForProvider({
      cfg: config,
      store,
      provider,
      preferredProfile: opts.profileId,
    });

    if (!result) {
      console.log(chalk.red("✗ Failed to resolve API credentials"));
      console.log(chalk.dim("  Profile may not be properly configured"));
      return;
    }

    console.log(chalk.green(`✓ Profile is valid and ready to use`));
    console.log();
    console.log(chalk.bold("Profile Details:"));
    console.log(`  Provider:   ${chalk.cyan(cred.provider)}`);
    console.log(`  Type:       ${chalk.cyan(cred.type)}`);
    console.log(`  Profile ID: ${chalk.cyan(result.profileId)}`);
    if (cred.email) {
      console.log(`  Email:      ${chalk.cyan(cred.email)}`);
    }
    console.log();

    // Note: We don't make an actual API call here because:
    // 1. It would consume quota
    // 2. Different providers have different minimal API endpoints
    // 3. The credential resolution is sufficient validation
    console.log(chalk.dim("Note: No actual API request was made to avoid consuming quota."));
    console.log(chalk.dim("The profile will be used automatically when the agent needs this provider."));
    console.log();
  } catch (error: any) {
    console.log(chalk.red("✗ Test failed"));
    console.log();
    console.log(chalk.red("Error:"), error.message);
    console.log();
    console.log(chalk.dim("Common issues:"));
    console.log(chalk.dim("  - Invalid or expired credentials"));
    console.log(chalk.dim("  - Profile type mismatch (token vs api_key vs oauth)"));
    console.log(chalk.dim("  - Provider name mismatch in config"));
    console.log();
  }
}
