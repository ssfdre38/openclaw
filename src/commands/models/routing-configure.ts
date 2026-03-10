/**
 * CLI: openclaw models routing configure
 * Interactive wizard to set up complexity-based routing.
 */

import * as clack from "@clack/prompts";
import chalk from "chalk";
import type { Runtime } from "../../runtime.js";
import { loadValidConfigOrThrow, updateConfig } from "./shared.js";
import type { ComplexityRoutingConfig } from "../../config/types.complexity-routing.js";

interface ConfigureOptions {
  enable?: boolean;
  disable?: boolean;
}

export async function modelsRoutingConfigureCommand(
  runtime: Runtime,
  options: ConfigureOptions,
) {
  clack.intro(chalk.bold("Complexity Routing Configuration"));

  // Quick enable/disable flags
  if (options.enable) {
    await updateConfig((config) => {
      if (!config.agents?.defaults) {
        config.agents = { defaults: {} };
      }
      if (!config.agents.defaults.complexityRouting) {
        config.agents.defaults.complexityRouting = {
          enabled: true,
          strategy: "cost-optimized",
          models: {
            simple: { primary: "ollama/qwen3.5:latest" },
            moderate: { primary: "ollama/qwen3-coder:latest" },
            complex: { primary: "github-copilot/claude-sonnet-4.5" },
          },
        };
      } else {
        config.agents.defaults.complexityRouting.enabled = true;
      }
    });
    clack.outro(chalk.green("✓ Complexity routing enabled"));
    return;
  }

  if (options.disable) {
    await updateConfig((config) => {
      if (config.agents?.defaults?.complexityRouting) {
        config.agents.defaults.complexityRouting.enabled = false;
      }
    });
    clack.outro(chalk.green("✓ Complexity routing disabled"));
    return;
  }

  // Interactive wizard
  const enabled = await clack.confirm({
    message: "Enable complexity-based routing?",
    initialValue: true,
  });

  if (clack.isCancel(enabled) || !enabled) {
    clack.cancel("Configuration cancelled");
    return;
  }

  const strategy = await clack.select({
    message: "Choose routing strategy:",
    options: [
      {
        value: "cost-optimized",
        label: "Cost-optimized",
        hint: "Prioritize free models, fallback to paid",
      },
      {
        value: "quality-first",
        label: "Quality-first",
        hint: "Prioritize best models for task complexity",
      },
      {
        value: "quota-aware",
        label: "Quota-aware",
        hint: "Distribute load across API quotas",
      },
    ],
    initialValue: "cost-optimized",
  });

  if (clack.isCancel(strategy)) {
    clack.cancel("Configuration cancelled");
    return;
  }

  const simpleModel = await clack.text({
    message: "Model for simple tasks (chat, questions):",
    placeholder: "ollama/qwen3.5:latest",
    initialValue: "ollama/qwen3.5:latest",
    validate: (val) => (val ? undefined : "Model required"),
  });

  if (clack.isCancel(simpleModel)) {
    clack.cancel("Configuration cancelled");
    return;
  }

  const moderateModel = await clack.text({
    message: "Model for moderate tasks (analysis, debugging):",
    placeholder: "ollama/qwen3-coder:latest",
    initialValue: "ollama/qwen3-coder:latest",
    validate: (val) => (val ? undefined : "Model required"),
  });

  if (clack.isCancel(moderateModel)) {
    clack.cancel("Configuration cancelled");
    return;
  }

  const complexModel = await clack.text({
    message: "Model for complex tasks (code generation, refactoring):",
    placeholder: "github-copilot/claude-sonnet-4.5",
    initialValue: "github-copilot/claude-sonnet-4.5",
    validate: (val) => (val ? undefined : "Model required"),
  });

  if (clack.isCancel(complexModel)) {
    clack.cancel("Configuration cancelled");
    return;
  }

  const costControl = await clack.confirm({
    message: "Enable cost control limits?",
    initialValue: false,
  });

  if (clack.isCancel(costControl)) {
    clack.cancel("Configuration cancelled");
    return;
  }

  let costControlConfig: ComplexityRoutingConfig["costControl"] | undefined;

  if (costControl) {
    const sessionLimit = await clack.text({
      message: "Max cost per session (USD, 0 = unlimited):",
      placeholder: "0",
      initialValue: "0",
      validate: (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 ? undefined : "Must be a number >= 0";
      },
    });

    if (clack.isCancel(sessionLimit)) {
      clack.cancel("Configuration cancelled");
      return;
    }

    const requestLimit = await clack.text({
      message: "Max cost per request (USD, 0 = unlimited):",
      placeholder: "0",
      initialValue: "0",
      validate: (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 ? undefined : "Must be a number >= 0";
      },
    });

    if (clack.isCancel(requestLimit)) {
      clack.cancel("Configuration cancelled");
      return;
    }

    costControlConfig = {
      enabled: true,
      maxCostPerSession: parseFloat(sessionLimit as string) || undefined,
      maxCostPerRequest: parseFloat(requestLimit as string) || undefined,
    };
  }

  const spinner = clack.spinner();
  spinner.start("Updating configuration...");

  await updateConfig((config) => {
    if (!config.agents?.defaults) {
      config.agents = { defaults: {} };
    }

    config.agents.defaults.complexityRouting = {
      enabled: true,
      strategy: strategy as "cost-optimized" | "quality-first" | "quota-aware",
      models: {
        simple: { primary: simpleModel as string },
        moderate: { primary: moderateModel as string },
        complex: { primary: complexModel as string },
      },
      costControl: costControlConfig,
    };
  });

  spinner.stop("Configuration updated");

  clack.outro(
    chalk.green("✓ Complexity routing configured") +
      "\n\n" +
      chalk.dim("Test it with: ") +
      chalk.cyan("openclaw models routing classify <prompt>") +
      "\n" +
      chalk.dim("View status: ") +
      chalk.cyan("openclaw models routing status"),
  );
}
