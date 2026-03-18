import { createSubsystemLogger } from "../logging/subsystem.js";
import { parseBooleanValue } from "../utils/boolean.js";

const log = createSubsystemLogger("env");
const loggedEnv = new Set<string>();

type AcceptedEnvOption = {
  key: string;
  description: string;
  value?: string;
  redact?: boolean;
};

function formatEnvValue(value: string, redact?: boolean): string {
  if (redact) {
    return "<redacted>";
  }
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 160) {
    return singleLine;
  }
  return `${singleLine.slice(0, 160)}…`;
}

export function logAcceptedEnvOption(option: AcceptedEnvOption): void {
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return;
  }
  if (loggedEnv.has(option.key)) {
    return;
  }
  const rawValue = option.value ?? process.env[option.key];
  if (!rawValue || !rawValue.trim()) {
    return;
  }
  loggedEnv.add(option.key);
  log.info(`env: ${option.key}=${formatEnvValue(rawValue, option.redact)} (${option.description})`);
}

export function normalizeZaiEnv(): void {
  if (!process.env.ZAI_API_KEY?.trim() && process.env.Z_AI_API_KEY?.trim()) {
    process.env.ZAI_API_KEY = process.env.Z_AI_API_KEY;
  }
}

export function isTruthyEnvValue(value?: string): boolean {
  return parseBooleanValue(value) === true;
}

export function normalizeEnv(): void {
  normalizeZaiEnv();
}

/**
 * Get a required environment variable, throwing an error if it's not set or empty.
 * Use this to validate critical environment variables at startup.
 * @param key - Environment variable name
 * @param description - Human-readable description for error message
 * @returns The environment variable value
 * @throws Error if the variable is not set or is empty
 */
export function getRequiredEnv(key: string, description?: string): string {
  const value = process.env[key];
  if (!value || !value.trim()) {
    const message = description 
      ? `Required environment variable ${key} is not set. ${description}`
      : `Required environment variable ${key} is not set`;
    throw new Error(message);
  }
  return value.trim();
}

/**
 * Get an optional environment variable with a default value.
 * @param key - Environment variable name
 * @param defaultValue - Default value if env var is not set
 * @returns The environment variable value or default
 */
export function getEnvOrDefault(key: string, defaultValue: string): string {
  const value = process.env[key];
  return (value && value.trim()) || defaultValue;
}
