import { confirm as clackConfirm } from "@clack/prompts";
import { loadAuthProfileStore, updateAuthProfileStoreWithLock } from "../../agents/auth-profiles/store.js";
import { loadValidConfigOrThrow, updateConfig } from "./shared.js";
import { stylePromptMessage } from "../../terminal/prompt-style.js";
import chalk from "chalk";

const confirm = (params: Parameters<typeof clackConfirm>[0]) =>
  clackConfirm({
    ...params,
    message: stylePromptMessage(params.message),
  });

/**
 * Remove an auth profile (credentials and config).
 */
export async function modelsAuthRemoveCommand(opts: {
  profileId: string;
  yes?: boolean;
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
    if (profiles.length === 0) {
      console.log(chalk.dim("  (no profiles)"));
    } else {
      profiles.forEach((id) => console.log(chalk.dim(`  - ${id}`)));
    }
    return;
  }

  console.log();
  console.log(chalk.bold(`Remove profile: ${chalk.cyan(opts.profileId)}`));
  console.log();

  // Show what will be deleted
  console.log(chalk.dim("Profile details:"));
  console.log(`  Provider:  ${cred.provider}`);
  console.log(`  Type:      ${cred.type}`);
  if (cred.email) {
    console.log(`  Email:     ${cred.email}`);
  }
  console.log();

  // Check if profile is used in any agent orders
  const agentOrders = store.agentOrders?.[cred.provider] ?? {};
  const usedByAgents = Object.entries(agentOrders)
    .filter(([_, order]) => order.includes(opts.profileId))
    .map(([agent]) => agent);

  if (usedByAgents.length > 0) {
    console.log(chalk.yellow("⚠ Warning: This profile is used in agent order overrides:"));
    usedByAgents.forEach((agent) => console.log(chalk.yellow(`  - Agent: ${agent}`)));
    console.log(chalk.dim("  These orders will still reference the removed profile (may cause errors)"));
    console.log();
  }

  // Check if profile has usage stats
  const stats = store.usageStats?.[opts.profileId];
  if (stats && (stats.quotaUsedToday ?? 0) > 0) {
    console.log(chalk.yellow("⚠ Profile has usage today:"));
    console.log(`  API Calls: ${stats.quotaUsedToday}`);
    if (stats.tokenInputUsedToday || stats.tokenOutputUsedToday) {
      console.log(
        `  Tokens:    ${(stats.tokenInputUsedToday ?? 0) + (stats.tokenOutputUsedToday ?? 0)}`,
      );
    }
    if (stats.costToday) {
      console.log(`  Cost:      $${stats.costToday.toFixed(4)}`);
    }
    console.log();
  }

  console.log(chalk.bold("This will remove:"));
  console.log("  ✓ Credentials from auth-profiles.json");
  console.log("  ✓ Configuration from openclaw.json");
  console.log("  ✓ Usage statistics");
  console.log();

  // Confirm deletion
  if (!opts.yes) {
    const confirmed = await confirm({
      message: `Delete profile ${opts.profileId}?`,
      initialValue: false,
    });

    if (typeof confirmed === "symbol" || !confirmed) {
      console.log(chalk.yellow("Removal cancelled"));
      return;
    }
  }

  // Remove from store (credentials and usage stats)
  const storeUpdated = await updateAuthProfileStoreWithLock({
    updater: (s) => {
      // Remove credentials
      if (s.profiles[opts.profileId]) {
        delete s.profiles[opts.profileId];
      }

      // Remove usage stats
      if (s.usageStats?.[opts.profileId]) {
        delete s.usageStats[opts.profileId];
      }

      return true; // Changed
    },
  });

  if (!storeUpdated) {
    console.log(chalk.red("Failed to update auth-profiles.json"));
    return;
  }

  // Remove from config
  await updateConfig((cfg) => {
    if (cfg.auth?.profiles?.[opts.profileId]) {
      delete cfg.auth.profiles[opts.profileId];
    }
  });

  console.log();
  console.log(chalk.green(`✓ Profile removed: ${opts.profileId}`));
  console.log();

  if (usedByAgents.length > 0) {
    console.log(chalk.yellow("Next steps:"));
    console.log(chalk.yellow("  Update agent orders that reference this profile:"));
    usedByAgents.forEach((agent) => {
      console.log(
        chalk.dim(`    openclaw models auth order clear --provider ${cred.provider} --agent ${agent}`),
      );
    });
    console.log();
  }
}
