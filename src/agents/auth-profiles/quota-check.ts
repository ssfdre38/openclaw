import type { OpenClawConfig } from "../../config/config.js";
import type { AuthProfileStore, ProfileUsageStats } from "./types.js";
import { saveAuthProfileStore, updateAuthProfileStoreWithLock } from "./store.js";

/**
 * Check if a profile has exceeded its daily API call quota.
 */
export function isProfileAboveApiCallQuota(
  config: OpenClawConfig,
  store: AuthProfileStore,
  profileId: string,
): boolean {
  const profileConfig = config.auth?.profiles?.[profileId];
  const stats = store.usageStats?.[profileId];

  if (!profileConfig?.dailyApiCallLimit || !stats) {
    return false; // No limit configured or no stats
  }

  const quotaUsed = stats.quotaUsedToday ?? 0;
  return quotaUsed >= profileConfig.dailyApiCallLimit;
}

/**
 * Check if a profile has exceeded its daily token quota.
 */
export function isProfileAboveTokenQuota(
  config: OpenClawConfig,
  store: AuthProfileStore,
  profileId: string,
): boolean {
  const profileConfig = config.auth?.profiles?.[profileId];
  const stats = store.usageStats?.[profileId];

  if (!profileConfig?.dailyTokenLimit || !stats) {
    return false; // No limit configured or no stats
  }

  const tokensUsed = (stats.tokenInputUsedToday ?? 0) + (stats.tokenOutputUsedToday ?? 0);
  return tokensUsed >= profileConfig.dailyTokenLimit;
}

/**
 * Check if a profile has exceeded any of its configured quotas.
 */
export function isProfileAboveQuota(
  config: OpenClawConfig,
  store: AuthProfileStore,
  profileId: string,
): boolean {
  return (
    isProfileAboveApiCallQuota(config, store, profileId) ||
    isProfileAboveTokenQuota(config, store, profileId)
  );
}

/**
 * Get the remaining API call quota for a profile.
 * Returns null if no limit configured or no stats available.
 */
export function getProfileApiCallQuotaRemaining(
  config: OpenClawConfig,
  store: AuthProfileStore,
  profileId: string,
): number | null {
  const profileConfig = config.auth?.profiles?.[profileId];
  const stats = store.usageStats?.[profileId];

  if (!profileConfig?.dailyApiCallLimit || !stats) {
    return null;
  }

  const quotaUsed = stats.quotaUsedToday ?? 0;
  const remaining = profileConfig.dailyApiCallLimit - quotaUsed;
  return Math.max(0, remaining);
}

/**
 * Get the remaining token quota for a profile.
 * Returns null if no limit configured or no stats available.
 */
export function getProfileTokenQuotaRemaining(
  config: OpenClawConfig,
  store: AuthProfileStore,
  profileId: string,
): number | null {
  const profileConfig = config.auth?.profiles?.[profileId];
  const stats = store.usageStats?.[profileId];

  if (!profileConfig?.dailyTokenLimit || !stats) {
    return null;
  }

  const tokensUsed = (stats.tokenInputUsedToday ?? 0) + (stats.tokenOutputUsedToday ?? 0);
  const remaining = profileConfig.dailyTokenLimit - tokensUsed;
  return Math.max(0, remaining);
}

/**
 * Calculate a health score for a profile based on available quota and rate limits.
 * Returns a score from 0-100 (higher is healthier).
 * Returns -1000 if profile is in cooldown (should be excluded).
 */
export function getProfileHealthScore(
  config: OpenClawConfig,
  store: AuthProfileStore,
  profileId: string,
): number {
  const profileConfig = config.auth?.profiles?.[profileId];
  const stats = store.usageStats?.[profileId];

  // Check if profile is disabled
  if (profileConfig?.enabled === false) {
    return -1000;
  }

  // Check if profile is in cooldown
  const unusableUntil =
    stats?.cooldownUntil && Date.now() < stats.cooldownUntil
      ? stats.cooldownUntil
      : stats?.disabledUntil && Date.now() < stats.disabledUntil
        ? stats.disabledUntil
        : null;

  if (unusableUntil) {
    return -1000; // Exclude from selection
  }

  let score = 100;

  // 1. Quota availability penalty (0-40 points)
  if (profileConfig?.dailyApiCallLimit && stats) {
    const quotaUsed = (stats.quotaUsedToday ?? 0) / profileConfig.dailyApiCallLimit;
    score -= quotaUsed * 40; // Lose points as quota fills up
  }

  // 2. Token availability penalty (0-30 points)
  if (profileConfig?.dailyTokenLimit && stats) {
    const tokensUsed =
      ((stats.tokenInputUsedToday ?? 0) + (stats.tokenOutputUsedToday ?? 0)) /
      profileConfig.dailyTokenLimit;
    score -= tokensUsed * 30;
  }

  // 3. Rate limit proximity penalty (0-20 points)
  if (stats?.rateLimitRemaining !== undefined) {
    if (stats.rateLimitRemaining < 5) {
      score -= 20; // Very close to limit
    } else if (stats.rateLimitRemaining < 20) {
      score -= 10; // Getting close to limit
    }
  }

  // 4. Priority boost (±10 points)
  const priority = profileConfig?.priority ?? 5;
  score += priority * 2 - 10; // Maps 1→-8, 5→0, 10→+10

  return Math.max(0, score);
}

/**
 * Reset daily quota counters for a profile.
 * This should be called once per day per profile (typically at midnight UTC).
 */
export async function resetProfileDailyQuota(profileId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  await updateAuthProfileStoreWithLock({
    updater: (store) => {
      if (!store.usageStats) {
        store.usageStats = {};
      }
      if (!store.usageStats[profileId]) {
        store.usageStats[profileId] = {};
      }

      const stats = store.usageStats[profileId]!;

      // Only reset if we haven't already reset today
      if (stats.lastQuotaResetDate === today) {
        return false; // No changes needed
      }

      stats.quotaUsedToday = 0;
      stats.tokenInputUsedToday = 0;
      stats.tokenOutputUsedToday = 0;
      stats.costToday = 0;
      stats.lastQuotaResetDate = today;

      return true; // Changes made
    },
  });
}

/**
 * Reset daily quota counters for all profiles.
 * This should be called once per day (typically at midnight UTC).
 */
export async function resetAllProfilesDailyQuota(
  config: OpenClawConfig,
): Promise<{ resetCount: number }> {
  const profileIds = Object.keys(config.auth?.profiles ?? {});
  let resetCount = 0;

  for (const profileId of profileIds) {
    await resetProfileDailyQuota(profileId);
    resetCount++;
  }

  return { resetCount };
}
