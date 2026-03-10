export type AuthProfileConfig = {
  provider: string;
  /**
   * Credential type expected in auth-profiles.json for this profile id.
   * - api_key: static provider API key
   * - oauth: refreshable OAuth credentials (access+refresh+expires)
   * - token: static bearer-style token (optionally expiring; no refresh)
   */
  mode: "api_key" | "oauth" | "token";
  email?: string;

  // Load balancing configuration
  /** Weight for weighted distribution (0-100). Default: 100. Higher = more requests. */
  weight?: number;
  /** Priority level (1-10). Default: 5. Higher = prefer this profile. */
  priority?: number;
  /** Enable/disable this profile manually. Default: true. */
  enabled?: boolean;
  /** Max API calls per day for this profile. No limit if not set. */
  dailyApiCallLimit?: number;
  /** Max tokens (input + output) per day for this profile. No limit if not set. */
  dailyTokenLimit?: number;
  /** Manual rate limit: requests per minute. No limit if not set. */
  rpmLimit?: number;
  /** Manual rate limit: tokens per minute. No limit if not set. */
  tpmLimit?: number;
  /** Cooldown multiplier (0.5 = half backoff, 2.0 = double backoff). Default: 1.0. */
  cooldownMultiplier?: number;
};

export type LoadBalancingStrategy = "round-robin" | "weighted" | "quota-aware" | "cost-optimized";

export type LoadBalancingConfig = {
  /** Enable intelligent load balancing. Default: false (uses round-robin). */
  enabled?: boolean;
  /** Selection strategy. Default: "round-robin". */
  strategy?: LoadBalancingStrategy;
  /** Track quota usage against configured limits. Default: true when enabled. */
  quotaTracking?: boolean;
  /** Parse rate limit headers from API responses. Default: true when enabled. */
  parseRateLimitHeaders?: boolean;
  /** Time to reset daily quota counters (HH:MM format, UTC). Default: "00:00". */
  dailyQuotaResetTime?: string;
  /** Fall back to round-robin if quota data unavailable. Default: true. */
  fallbackToRoundRobin?: boolean;
};

export type AuthConfig = {
  profiles?: Record<string, AuthProfileConfig>;
  order?: Record<string, string[]>;
  cooldowns?: {
    /** Default billing backoff (hours). Default: 5. */
    billingBackoffHours?: number;
    /** Optional per-provider billing backoff (hours). */
    billingBackoffHoursByProvider?: Record<string, number>;
    /** Billing backoff cap (hours). Default: 24. */
    billingMaxHours?: number;
    /**
     * Failure window for backoff counters (hours). If no failures occur within
     * this window, counters reset. Default: 24.
     */
    failureWindowHours?: number;
  };
  /** Load balancing configuration for intelligent profile selection. */
  loadBalancing?: LoadBalancingConfig;
};
