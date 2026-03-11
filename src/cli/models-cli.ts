import type { Command } from "commander";
import {
  githubCopilotLoginCommand,
  modelsAliasesAddCommand,
  modelsAliasesListCommand,
  modelsAliasesRemoveCommand,
  modelsAuthAddCommand,
  modelsAuthLoginCommand,
  modelsAuthOrderClearCommand,
  modelsAuthOrderGetCommand,
  modelsAuthOrderSetCommand,
  modelsAuthPasteTokenCommand,
  modelsAuthSetupTokenCommand,
  modelsFallbacksAddCommand,
  modelsFallbacksClearCommand,
  modelsFallbacksListCommand,
  modelsFallbacksRemoveCommand,
  modelsImageFallbacksAddCommand,
  modelsImageFallbacksClearCommand,
  modelsImageFallbacksListCommand,
  modelsImageFallbacksRemoveCommand,
  modelsListCommand,
  modelsScanCommand,
  modelsSetCommand,
  modelsSetImageCommand,
  modelsStatusCommand,
} from "../commands/models.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { resolveOptionFromCommand, runCommandWithRuntime } from "./cli-utils.js";

function runModelsCommand(action: () => Promise<void>) {
  return runCommandWithRuntime(defaultRuntime, action);
}

export function registerModelsCli(program: Command) {
  const models = program
    .command("models")
    .description("Model discovery, scanning, and configuration")
    .option("--status-json", "Output JSON (alias for `models status --json`)", false)
    .option("--status-plain", "Plain output (alias for `models status --plain`)", false)
    .option(
      "--agent <id>",
      "Agent id to inspect (overrides OPENCLAW_AGENT_DIR/PI_CODING_AGENT_DIR)",
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/models", "docs.openclaw.ai/cli/models")}\n`,
    );

  models
    .command("list")
    .description("List models (configured by default)")
    .option("--all", "Show full model catalog", false)
    .option("--local", "Filter to local models", false)
    .option("--provider <name>", "Filter by provider")
    .option("--json", "Output JSON", false)
    .option("--plain", "Plain line output", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsListCommand(opts, defaultRuntime);
      });
    });

  models
    .command("status")
    .description("Show configured model state")
    .option("--json", "Output JSON", false)
    .option("--plain", "Plain output", false)
    .option(
      "--check",
      "Exit non-zero if auth is expiring/expired (1=expired/missing, 2=expiring)",
      false,
    )
    .option("--probe", "Probe configured provider auth (live)", false)
    .option("--probe-provider <name>", "Only probe a single provider")
    .option(
      "--probe-profile <id>",
      "Only probe specific auth profile ids (repeat or comma-separated)",
      (value, previous) => {
        const next = Array.isArray(previous) ? previous : previous ? [previous] : [];
        next.push(value);
        return next;
      },
    )
    .option("--probe-timeout <ms>", "Per-probe timeout in ms")
    .option("--probe-concurrency <n>", "Concurrent probes")
    .option("--probe-max-tokens <n>", "Probe max tokens (best-effort)")
    .option(
      "--agent <id>",
      "Agent id to inspect (overrides OPENCLAW_AGENT_DIR/PI_CODING_AGENT_DIR)",
    )
    .action(async (opts, command) => {
      const agent =
        resolveOptionFromCommand<string>(command, "agent") ?? (opts.agent as string | undefined);
      await runModelsCommand(async () => {
        await modelsStatusCommand(
          {
            json: Boolean(opts.json),
            plain: Boolean(opts.plain),
            check: Boolean(opts.check),
            probe: Boolean(opts.probe),
            probeProvider: opts.probeProvider as string | undefined,
            probeProfile: opts.probeProfile as string | string[] | undefined,
            probeTimeout: opts.probeTimeout as string | undefined,
            probeConcurrency: opts.probeConcurrency as string | undefined,
            probeMaxTokens: opts.probeMaxTokens as string | undefined,
            agent,
          },
          defaultRuntime,
        );
      });
    });

  models
    .command("set")
    .description("Set the default model")
    .argument("<model>", "Model id or alias")
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsSetCommand(model, defaultRuntime);
      });
    });

  models
    .command("set-image")
    .description("Set the image model")
    .argument("<model>", "Model id or alias")
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsSetImageCommand(model, defaultRuntime);
      });
    });

  const aliases = models.command("aliases").description("Manage model aliases");

  aliases
    .command("list")
    .description("List model aliases")
    .option("--json", "Output JSON", false)
    .option("--plain", "Plain output", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsAliasesListCommand(opts, defaultRuntime);
      });
    });

  aliases
    .command("add")
    .description("Add or update a model alias")
    .argument("<alias>", "Alias name")
    .argument("<model>", "Model id or alias")
    .action(async (alias: string, model: string) => {
      await runModelsCommand(async () => {
        await modelsAliasesAddCommand(alias, model, defaultRuntime);
      });
    });

  aliases
    .command("remove")
    .description("Remove a model alias")
    .argument("<alias>", "Alias name")
    .action(async (alias: string) => {
      await runModelsCommand(async () => {
        await modelsAliasesRemoveCommand(alias, defaultRuntime);
      });
    });

  const fallbacks = models.command("fallbacks").description("Manage model fallback list");

  fallbacks
    .command("list")
    .description("List fallback models")
    .option("--json", "Output JSON", false)
    .option("--plain", "Plain output", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsFallbacksListCommand(opts, defaultRuntime);
      });
    });

  fallbacks
    .command("add")
    .description("Add a fallback model")
    .argument("<model>", "Model id or alias")
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsFallbacksAddCommand(model, defaultRuntime);
      });
    });

  fallbacks
    .command("remove")
    .description("Remove a fallback model")
    .argument("<model>", "Model id or alias")
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsFallbacksRemoveCommand(model, defaultRuntime);
      });
    });

  fallbacks
    .command("clear")
    .description("Clear all fallback models")
    .action(async () => {
      await runModelsCommand(async () => {
        await modelsFallbacksClearCommand(defaultRuntime);
      });
    });

  const imageFallbacks = models
    .command("image-fallbacks")
    .description("Manage image model fallback list");

  imageFallbacks
    .command("list")
    .description("List image fallback models")
    .option("--json", "Output JSON", false)
    .option("--plain", "Plain output", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsImageFallbacksListCommand(opts, defaultRuntime);
      });
    });

  imageFallbacks
    .command("add")
    .description("Add an image fallback model")
    .argument("<model>", "Model id or alias")
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsImageFallbacksAddCommand(model, defaultRuntime);
      });
    });

  imageFallbacks
    .command("remove")
    .description("Remove an image fallback model")
    .argument("<model>", "Model id or alias")
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsImageFallbacksRemoveCommand(model, defaultRuntime);
      });
    });

  imageFallbacks
    .command("clear")
    .description("Clear all image fallback models")
    .action(async () => {
      await runModelsCommand(async () => {
        await modelsImageFallbacksClearCommand(defaultRuntime);
      });
    });

  models
    .command("scan")
    .description("Scan OpenRouter free models for tools + images")
    .option("--min-params <b>", "Minimum parameter size (billions)")
    .option("--max-age-days <days>", "Skip models older than N days")
    .option("--provider <name>", "Filter by provider prefix")
    .option("--max-candidates <n>", "Max fallback candidates", "6")
    .option("--timeout <ms>", "Per-probe timeout in ms")
    .option("--concurrency <n>", "Probe concurrency")
    .option("--no-probe", "Skip live probes; list free candidates only")
    .option("--yes", "Accept defaults without prompting", false)
    .option("--no-input", "Disable prompts (use defaults)")
    .option("--set-default", "Set agents.defaults.model to the first selection", false)
    .option("--set-image", "Set agents.defaults.imageModel to the first image selection", false)
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsScanCommand(opts, defaultRuntime);
      });
    });

  models.action(async (opts) => {
    await runModelsCommand(async () => {
      await modelsStatusCommand(
        {
          json: Boolean(opts?.statusJson),
          plain: Boolean(opts?.statusPlain),
          agent: opts?.agent as string | undefined,
        },
        defaultRuntime,
      );
    });
  });

  const auth = models.command("auth").description("Manage model auth profiles");
  auth.option("--agent <id>", "Agent id for auth order get/set/clear");
  auth.action(() => {
    auth.help();
  });

  auth
    .command("add")
    .description("Interactive auth helper (setup-token or paste token)")
    .action(async () => {
      await runModelsCommand(async () => {
        await modelsAuthAddCommand({}, defaultRuntime);
      });
    });

  auth
    .command("login")
    .description("Run a provider plugin auth flow (OAuth/API key)")
    .option("--provider <id>", "Provider id registered by a plugin")
    .option("--method <id>", "Provider auth method id")
    .option("--set-default", "Apply the provider's default model recommendation", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsAuthLoginCommand(
          {
            provider: opts.provider as string | undefined,
            method: opts.method as string | undefined,
            setDefault: Boolean(opts.setDefault),
          },
          defaultRuntime,
        );
      });
    });

  auth
    .command("setup-token")
    .description("Run a provider CLI to create/sync a token (TTY required)")
    .option("--provider <name>", "Provider id (default: anthropic)")
    .option("--yes", "Skip confirmation", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsAuthSetupTokenCommand(
          {
            provider: opts.provider as string | undefined,
            yes: Boolean(opts.yes),
          },
          defaultRuntime,
        );
      });
    });

  auth
    .command("paste-token")
    .description("Paste a token into auth-profiles.json and update config")
    .requiredOption("--provider <name>", "Provider id (e.g. anthropic)")
    .option("--profile-id <id>", "Auth profile id (default: <provider>:manual)")
    .option(
      "--expires-in <duration>",
      "Optional expiry duration (e.g. 365d, 12h). Stored as absolute expiresAt.",
    )
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsAuthPasteTokenCommand(
          {
            provider: opts.provider as string | undefined,
            profileId: opts.profileId as string | undefined,
            expiresIn: opts.expiresIn as string | undefined,
          },
          defaultRuntime,
        );
      });
    });

  auth
    .command("login-github-copilot")
    .description("Login to GitHub Copilot via GitHub device flow (TTY required)")
    .option("--profile-id <id>", "Auth profile id (default: github-copilot:github)")
    .option("--yes", "Overwrite existing profile without prompting", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await githubCopilotLoginCommand(
          {
            profileId: opts.profileId as string | undefined,
            yes: Boolean(opts.yes),
          },
          defaultRuntime,
        );
      });
    });

  const order = auth.command("order").description("Manage per-agent auth profile order overrides");

  order
    .command("get")
    .description("Show per-agent auth order override (from auth-profiles.json)")
    .requiredOption("--provider <name>", "Provider id (e.g. anthropic)")
    .option("--agent <id>", "Agent id (default: configured default agent)")
    .option("--json", "Output JSON", false)
    .action(async (opts, command) => {
      const agent =
        resolveOptionFromCommand<string>(command, "agent") ?? (opts.agent as string | undefined);
      await runModelsCommand(async () => {
        await modelsAuthOrderGetCommand(
          {
            provider: opts.provider as string,
            agent,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  order
    .command("set")
    .description("Set per-agent auth order override (locks rotation to this list)")
    .requiredOption("--provider <name>", "Provider id (e.g. anthropic)")
    .option("--agent <id>", "Agent id (default: configured default agent)")
    .argument("<profileIds...>", "Auth profile ids (e.g. anthropic:default)")
    .action(async (profileIds: string[], opts, command) => {
      const agent =
        resolveOptionFromCommand<string>(command, "agent") ?? (opts.agent as string | undefined);
      await runModelsCommand(async () => {
        await modelsAuthOrderSetCommand(
          {
            provider: opts.provider as string,
            agent,
            order: profileIds,
          },
          defaultRuntime,
        );
      });
    });

  order
    .command("clear")
    .description("Clear per-agent auth order override (fall back to config/round-robin)")
    .requiredOption("--provider <name>", "Provider id (e.g. anthropic)")
    .option("--agent <id>", "Agent id (default: configured default agent)")
    .action(async (opts, command) => {
      const agent =
        resolveOptionFromCommand<string>(command, "agent") ?? (opts.agent as string | undefined);
      await runModelsCommand(async () => {
        await modelsAuthOrderClearCommand(
          {
            provider: opts.provider as string,
            agent,
          },
          defaultRuntime,
        );
      });
    });

  // Load balancing management commands
  auth
    .command("list")
    .description("List all auth profiles with status and quota info")
    .option("--provider <name>", "Filter by provider id")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        const { modelsAuthListCommand } = await import("../commands/models/auth-list.js");
        await modelsAuthListCommand({
          provider: opts.provider as string | undefined,
          json: Boolean(opts.json),
        });
      });
    });

  auth
    .command("show")
    .description("Show detailed information for a specific auth profile")
    .argument("<profileId>", "Profile id (e.g. anthropic:main)")
    .action(async (profileId: string) => {
      await runModelsCommand(async () => {
        const { modelsAuthShowCommand } = await import("../commands/models/auth-show.js");
        await modelsAuthShowCommand({ profileId });
      });
    });

  auth
    .command("configure")
    .description("Configure load balancing settings for an auth profile")
    .argument("<profileId>", "Profile id (e.g. anthropic:main)")
    .option("--weight <n>", "Weight 0-100 (for weighted distribution)")
    .option("--priority <n>", "Priority 1-10 (higher = prefer first)")
    .option("--daily-limit <n>", "Daily API call limit")
    .option("--token-limit <n>", "Daily token limit (input + output)")
    .option("--enabled <bool>", "Enable/disable profile")
    .option("--interactive", "Interactive configuration mode", false)
    .action(async (profileId: string, opts) => {
      await runModelsCommand(async () => {
        const { modelsAuthConfigureCommand } = await import("../commands/models/auth-configure.js");
        await modelsAuthConfigureCommand({
          profileId,
          weight: opts.weight ? parseInt(opts.weight, 10) : undefined,
          priority: opts.priority ? parseInt(opts.priority, 10) : undefined,
          dailyLimit: opts.dailyLimit ? parseInt(opts.dailyLimit, 10) : undefined,
          tokenLimit: opts.tokenLimit ? parseInt(opts.tokenLimit, 10) : undefined,
          enabled: opts.enabled !== undefined ? opts.enabled === "true" : undefined,
          interactive: Boolean(opts.interactive),
        });
      });
    });

  auth
    .command("quota")
    .description("Display quota usage for auth profiles")
    .option("--profile-id <id>", "Show quota for specific profile only")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        const { modelsAuthQuotaCommand } = await import("../commands/models/auth-quota.js");
        await modelsAuthQuotaCommand({
          profileId: opts.profileId as string | undefined,
          json: Boolean(opts.json),
        });
      });
    });

  auth
    .command("test")
    .description("Test an auth profile by validating credentials")
    .argument("<profileId>", "Profile id to test (e.g. anthropic:main)")
    .action(async (profileId: string) => {
      await runModelsCommand(async () => {
        const { modelsAuthTestCommand } = await import("../commands/models/auth-test.js");
        await modelsAuthTestCommand({ profileId });
      });
    });

  auth
    .command("remove")
    .description("Remove an auth profile (credentials and config)")
    .argument("<profileId>", "Profile id to remove (e.g. anthropic:old)")
    .option("--yes", "Skip confirmation prompt", false)
    .action(async (profileId: string, opts) => {
      await runModelsCommand(async () => {
        const { modelsAuthRemoveCommand } = await import("../commands/models/auth-remove.js");
        await modelsAuthRemoveCommand({
          profileId,
          yes: Boolean(opts.yes),
        });
      });
    });

  auth
    .command("enable")
    .description("Enable an auth profile")
    .argument("<profileId>", "Profile id to enable")
    .action(async (profileId: string) => {
      await runModelsCommand(async () => {
        const { modelsAuthEnableCommand } = await import("../commands/models/auth-enable-disable.js");
        await modelsAuthEnableCommand({ profileId });
      });
    });

  auth
    .command("disable")
    .description("Disable an auth profile")
    .argument("<profileId>", "Profile id to disable")
    .action(async (profileId: string) => {
      await runModelsCommand(async () => {
        const { modelsAuthDisableCommand } = await import("../commands/models/auth-enable-disable.js");
        await modelsAuthDisableCommand({ profileId });
      });
    });

  auth
    .command("rate-limits")
    .description("Display rate limit information from API headers")
    .option("--provider <name>", "Filter by provider")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        const { modelsAuthRateLimitsCommand } = await import("../commands/models/auth-rate-limits.js");
        await modelsAuthRateLimitsCommand({
          provider: opts.provider as string | undefined,
          json: Boolean(opts.json),
        });
      });
    });

  auth
    .command("config-balancing")
    .description("Interactive wizard for configuring load balancing")
    .action(async () => {
      await runModelsCommand(async () => {
        const { modelsAuthConfigBalancingCommand } = await import("../commands/models/auth-config-balancing.js");
        await modelsAuthConfigBalancingCommand();
      });
    });

  // --- Complexity Routing Commands ---
  const routing = models.command("routing").description("Complexity-based model routing");

  routing
    .command("configure")
    .description("Configure complexity-based routing (interactive wizard)")
    .option("--enable", "Enable routing with defaults", false)
    .option("--disable", "Disable routing", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        const { modelsRoutingConfigureCommand } = await import("../commands/models/routing-configure.js");
        await modelsRoutingConfigureCommand(defaultRuntime, {
          enable: Boolean(opts.enable),
          disable: Boolean(opts.disable),
        });
      });
    });

  routing
    .command("status")
    .description("Show current complexity routing configuration")
    .action(async () => {
      await runModelsCommand(async () => {
        const { modelsRoutingStatusCommand } = await import("../commands/models/routing-status.js");
        await modelsRoutingStatusCommand(defaultRuntime);
      });
    });

  routing
    .command("classify")
    .description("Test task complexity classification")
    .argument("<prompt>", "Prompt to classify")
    .option("--json", "Output JSON", false)
    .option("--verbose", "Show detailed score breakdown", false)
    .action(async (prompt: string, opts) => {
      await runModelsCommand(async () => {
        const { modelsRoutingClassifyCommand } = await import("../commands/models/routing-classify.js");
        await modelsRoutingClassifyCommand(defaultRuntime, prompt, {
          json: Boolean(opts.json),
          verbose: Boolean(opts.verbose),
        });
      });
    });

  routing
    .command("stats")
    .description("Show routing metrics and cost savings")
    .option("--hours <n>", "Show stats for last N hours", (val) => parseInt(val, 10))
    .option("--recent <n>", "Show N most recent decisions", (val) => parseInt(val, 10))
    .option("--verbose", "Show detailed score breakdown", false)
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        const { modelsRoutingStatsCommand } = await import("../commands/models/routing-stats.js");
        await modelsRoutingStatsCommand(defaultRuntime, {
          hours: opts.hours as number | undefined,
          recent: opts.recent as number | undefined,
          verbose: Boolean(opts.verbose),
          json: Boolean(opts.json),
        });
      });
    });
}
