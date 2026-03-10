import { loadAuthProfileStore } from "../../agents/auth-profiles/store.js";
import { loadValidConfigOrThrow, updateConfig } from "./shared.js";
import chalk from "chalk";

/**
 * Enable or disable an auth profile.
 */
export async function modelsAuthEnableCommand(opts: { profileId: string }): Promise<void> {
  await toggleProfile(opts.profileId, true);
}

export async function modelsAuthDisableCommand(opts: { profileId: string }): Promise<void> {
  await toggleProfile(opts.profileId, false);
}

async function toggleProfile(profileId: string, enable: boolean): Promise<void> {
  const config = loadValidConfigOrThrow();
  const store = await loadAuthProfileStore();

  // Validate profile exists
  const cred = store.profiles[profileId];
  if (!cred) {
    console.log(chalk.red(`Profile not found: ${profileId}`));
    console.log();
    console.log(chalk.dim("Available profiles:"));
    const profiles = Object.keys(store.profiles).sort();
    profiles.forEach((id) => console.log(chalk.dim(`  - ${id}`)));
    return;
  }

  // Check current status
  const currentConfig = config.auth?.profiles?.[profileId];
  const currentlyEnabled = currentConfig?.enabled !== false;

  if (currentlyEnabled === enable) {
    console.log();
    console.log(
      chalk.yellow(
        `Profile ${profileId} is already ${enable ? "enabled" : "disabled"}`,
      ),
    );
    console.log();
    return;
  }

  // Update config
  await updateConfig((cfg) => {
    if (!cfg.auth) {
      cfg.auth = {};
    }
    if (!cfg.auth.profiles) {
      cfg.auth.profiles = {};
    }
    if (!cfg.auth.profiles[profileId]) {
      cfg.auth.profiles[profileId] = {
        provider: cred.provider,
        mode: cred.type as "api_key" | "oauth" | "token",
      };
    }
    cfg.auth.profiles[profileId].enabled = enable;
  });

  console.log();
  console.log(
    chalk.green(
      `✓ Profile ${profileId} ${enable ? "enabled" : "disabled"}`,
    ),
  );
  console.log();

  // Show current status
  console.log(chalk.bold("Profile Status:"));
  console.log(`  Provider:  ${chalk.cyan(cred.provider)}`);
  console.log(`  Type:      ${chalk.cyan(cred.type)}`);
  console.log(`  Enabled:   ${enable ? chalk.green("Yes") : chalk.red("No")}`);
  console.log();

  if (!enable) {
    console.log(chalk.dim("This profile will not be used for API calls."));
    console.log(
      chalk.dim(
        `To re-enable: openclaw models auth enable ${profileId}`,
      ),
    );
    console.log();
  }
}
