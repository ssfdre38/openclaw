import type { OpenClawConfig } from "../../config/config.js";
import type { LoadBalancingStrategy } from "../../config/types.auth.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { getProfileHealthScore, isProfileAboveQuota } from "./quota-check.js";
import type { AuthProfileStore } from "./types.js";

const logger = createSubsystemLogger("auth-profiles/load-balancer");

/**
 * Select a profile using round-robin strategy (current default behavior).
 * Sorts by lastUsed timestamp, oldest first.
 */
export function selectProfileRoundRobin(
  profileIds: string[],
  store: AuthProfileStore,
): string[] {
  const stats = store.usageStats ?? {};
  
  return profileIds.slice().sort((a, b) => {
    const aLastUsed = stats[a]?.lastUsed ?? 0;
    const bLastUsed = stats[b]?.lastUsed ?? 0;
    return aLastUsed - bLastUsed; // Oldest first
  });
}

/**
 * Select a profile using weighted distribution.
 * Profiles with higher weights get proportionally more requests.
 */
export function selectProfileWeighted(
  profileIds: string[],
  config: OpenClawConfig,
  store: AuthProfileStore,
): string[] {
  const profiles = config.auth?.profiles ?? {};
  
  // Calculate weights (default 100 if not specified)
  const weights = profileIds.map((id) => ({
    id,
    weight: profiles[id]?.weight ?? 100,
  }));
  
  // Sort by weight descending, then by lastUsed for tie-breaking
  const stats = store.usageStats ?? {};
  return weights.sort((a, b) => {
    if (a.weight !== b.weight) {
      return b.weight - a.weight; // Higher weight first
    }
    // Tie-break with round-robin
    const aLastUsed = stats[a.id]?.lastUsed ?? 0;
    const bLastUsed = stats[b.id]?.lastUsed ?? 0;
    return aLastUsed - bLastUsed;
  }).map((w) => w.id);
}

/**
 * Select a profile using quota-aware strategy.
 * Sorts by health score (higher = healthier = more available capacity).
 */
export function selectProfileQuotaAware(
  profileIds: string[],
  config: OpenClawConfig,
  store: AuthProfileStore,
): string[] {
  const healthScores = profileIds.map((id) => ({
    id,
    score: getProfileHealthScore(config, store, id),
  }));
  
  // Sort by health score descending (healthiest first)
  return healthScores
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score; // Higher score first
      }
      // Tie-break with round-robin
      const stats = store.usageStats ?? {};
      const aLastUsed = stats[a.id]?.lastUsed ?? 0;
      const bLastUsed = stats[b.id]?.lastUsed ?? 0;
      return aLastUsed - bLastUsed;
    })
    .map((h) => h.id);
}

/**
 * Select a profile using cost-optimization strategy.
 * Prefers profiles with lower cost today, but respects health scores.
 */
export function selectProfileCostOptimized(
  profileIds: string[],
  config: OpenClawConfig,
  store: AuthProfileStore,
): string[] {
  const stats = store.usageStats ?? {};
  
  const costScores = profileIds.map((id) => {
    const profileStats = stats[id];
    const costToday = profileStats?.costToday ?? 0;
    const healthScore = getProfileHealthScore(config, store, id);
    
    return {
      id,
      costToday,
      healthScore,
    };
  });
  
  // Sort by cost ascending (cheaper first), but only among healthy profiles
  // Unhealthy profiles (score < 0) go to the end
  return costScores
    .sort((a, b) => {
      // Unhealthy profiles go to end
      if (a.healthScore < 0 && b.healthScore >= 0) return 1;
      if (a.healthScore >= 0 && b.healthScore < 0) return -1;
      if (a.healthScore < 0 && b.healthScore < 0) return 0;
      
      // Among healthy profiles, prefer lower cost
      if (a.costToday !== b.costToday) {
        return a.costToday - b.costToday; // Lower cost first
      }
      
      // Tie-break with health score
      return b.healthScore - a.healthScore;
    })
    .map((c) => c.id);
}

/**
 * Filter out profiles that should be excluded from selection.
 * - Profiles explicitly disabled in config
 * - Profiles in cooldown
 * - Profiles above quota limits
 */
export function filterAvailableProfiles(
  profileIds: string[],
  config: OpenClawConfig,
  store: AuthProfileStore,
): string[] {
  const profiles = config.auth?.profiles ?? {};
  
  return profileIds.filter((id) => {
    // Check if explicitly disabled in config
    if (profiles[id]?.enabled === false) {
      logger.debug(`Profile ${id} disabled in config`);
      return false;
    }
    
    // Check if above quota limits
    if (isProfileAboveQuota(config, store, id)) {
      logger.debug(`Profile ${id} above quota limits`);
      return false;
    }
    
    // Check health score (negative score = in cooldown)
    const healthScore = getProfileHealthScore(config, store, id);
    if (healthScore < 0) {
      logger.debug(`Profile ${id} in cooldown (health score: ${healthScore})`);
      return false;
    }
    
    return true;
  });
}

/**
 * Select profiles using the configured load balancing strategy.
 * Returns an ordered list of profile IDs (most preferred first).
 */
export function selectProfilesWithLoadBalancing(
  profileIds: string[],
  config: OpenClawConfig,
  store: AuthProfileStore,
): string[] {
  // Filter to available profiles
  const available = filterAvailableProfiles(profileIds, config, store);
  
  if (available.length === 0) {
    logger.warn(`No available profiles after filtering from ${profileIds.length} candidates`);
    return profileIds; // Return all as fallback
  }
  
  const strategy = config.auth?.loadBalancing?.strategy ?? "round-robin";
  
  logger.debug(
    `Selecting from ${available.length}/${profileIds.length} available profiles using strategy: ${strategy}`,
  );
  
  let ordered: string[];
  
  switch (strategy) {
    case "weighted":
      ordered = selectProfileWeighted(available, config, store);
      break;
    case "quota-aware":
      ordered = selectProfileQuotaAware(available, config, store);
      break;
    case "cost-optimized":
      ordered = selectProfileCostOptimized(available, config, store);
      break;
    case "round-robin":
    default:
      ordered = selectProfileRoundRobin(available, store);
      break;
  }
  
  // Log the selection decision
  if (ordered.length > 0) {
    const selected = ordered[0];
    const healthScore = getProfileHealthScore(config, store, selected);
    const stats = store.usageStats?.[selected];
    logger.info(
      `Selected profile: ${selected} (strategy: ${strategy}, health: ${healthScore.toFixed(1)}, quota: ${stats?.quotaUsedToday ?? 0}/${config.auth?.profiles?.[selected]?.dailyApiCallLimit ?? "unlimited"})`,
    );
  }
  
  return ordered;
}

/**
 * Check if load balancing should be used.
 */
export function isLoadBalancingEnabled(config: OpenClawConfig): boolean {
  return config.auth?.loadBalancing?.enabled === true;
}

/**
 * Check if quota tracking should be used.
 */
export function isQuotaTrackingEnabled(config: OpenClawConfig): boolean {
  return config.auth?.loadBalancing?.quotaTracking !== false; // Default true if load balancing enabled
}

/**
 * Check if rate limit header parsing should be used.
 */
export function isRateLimitParsingEnabled(config: OpenClawConfig): boolean {
  return config.auth?.loadBalancing?.parseRateLimitHeaders !== false; // Default true if load balancing enabled
}
