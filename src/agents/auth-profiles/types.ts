import type { OAuthCredentials } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../../config/config.js";
import type { SecretRef } from "../../config/types.secrets.js";

export type ApiKeyCredential = {
  type: "api_key";
  provider: string;
  key?: string;
  keyRef?: SecretRef;
  email?: string;
  /** Optional provider-specific metadata (e.g., account IDs, gateway IDs). */
  metadata?: Record<string, string>;
};

export type TokenCredential = {
  /**
   * Static bearer-style token (often OAuth access token / PAT).
   * Not refreshable by OpenClaw (unlike `type: "oauth"`).
   */
  type: "token";
  provider: string;
  token: string;
  tokenRef?: SecretRef;
  /** Optional expiry timestamp (ms since epoch). */
  expires?: number;
  email?: string;
};

export type OAuthCredential = OAuthCredentials & {
  type: "oauth";
  provider: string;
  clientId?: string;
  email?: string;
};

export type AuthProfileCredential = ApiKeyCredential | TokenCredential | OAuthCredential;

export type AuthProfileFailureReason =
  | "auth"
  | "auth_permanent"
  | "format"
  | "rate_limit"
  | "billing"
  | "timeout"
  | "model_not_found"
  | "session_expired"
  | "unknown";

/** Per-profile usage statistics for round-robin and cooldown tracking */
export type ProfileUsageStats = {
  lastUsed?: number;
  cooldownUntil?: number;
  disabledUntil?: number;
  disabledReason?: AuthProfileFailureReason;
  errorCount?: number;
  failureCounts?: Partial<Record<AuthProfileFailureReason, number>>;
  lastFailureAt?: number;

  // Load balancing: quota tracking
  quotaUsedToday?: number; // API calls made today
  quotaLimitDaily?: number; // Max daily API calls (from config)
  tokenInputUsedToday?: number; // Input tokens used today
  tokenOutputUsedToday?: number; // Output tokens used today
  tokenLimitDaily?: number; // Max daily tokens (from config)
  costToday?: number; // Cost in dollars (calculated)
  lastQuotaResetDate?: string; // Date of last daily quota reset (YYYY-MM-DD)

  // Load balancing: rate limit tracking (from API response headers)
  rateLimitRemaining?: number; // Remaining requests from API headers
  rateLimitReset?: number; // When limit resets (timestamp ms)
  rpm?: number; // Requests per minute (from headers)
  tpm?: number; // Tokens per minute (from headers)
};

export type AuthProfileStore = {
  version: number;
  profiles: Record<string, AuthProfileCredential>;
  /**
   * Optional per-agent preferred profile order overrides.
   * This lets you lock/override auth rotation for a specific agent without
   * changing the global config.
   */
  order?: Record<string, string[]>;
  lastGood?: Record<string, string>;
  /** Usage statistics per profile for round-robin rotation */
  usageStats?: Record<string, ProfileUsageStats>;
};

export type AuthProfileIdRepairResult = {
  config: OpenClawConfig;
  changes: string[];
  migrated: boolean;
  fromProfileId?: string;
  toProfileId?: string;
};
