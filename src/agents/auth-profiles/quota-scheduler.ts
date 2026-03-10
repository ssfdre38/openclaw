import type { OpenClawConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { resetAllProfilesDailyQuota } from "./quota-check.js";

const logger = createSubsystemLogger("auth-profiles/quota-scheduler");

/**
 * Parse time string in HH:MM format (UTC) to hours and minutes.
 */
function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
}

/**
 * Calculate milliseconds until the next scheduled reset time.
 * @param resetTime Time in HH:MM format (UTC)
 * @returns Milliseconds until next reset
 */
function getMillisecondsUntilNextReset(resetTime: string): number {
  const parsed = parseTimeString(resetTime);
  if (!parsed) {
    logger.warn(`Invalid reset time format: ${resetTime}, using default 00:00`);
    return getMillisecondsUntilNextReset("00:00");
  }

  const now = new Date();
  const nextReset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    parsed.hours,
    parsed.minutes,
    0,
    0,
  ));

  // If the reset time has already passed today, schedule for tomorrow
  if (nextReset.getTime() <= now.getTime()) {
    nextReset.setUTCDate(nextReset.getUTCDate() + 1);
  }

  return nextReset.getTime() - now.getTime();
}

/**
 * Schedule the daily quota reset task.
 * Returns a function to cancel the scheduled task.
 */
export function scheduleQuotaReset(config: OpenClawConfig): () => void {
  const resetTime = config.auth?.loadBalancing?.dailyQuotaResetTime ?? "00:00";
  let timeoutHandle: NodeJS.Timeout | null = null;
  let isRunning = true;

  const scheduleNext = () => {
    if (!isRunning) {
      return;
    }

    const msUntilReset = getMillisecondsUntilNextReset(resetTime);
    const resetDate = new Date(Date.now() + msUntilReset);
    
    logger.info(
      `Quota reset scheduled for ${resetDate.toISOString()} (in ${Math.round(msUntilReset / 1000 / 60)} minutes)`,
    );

    timeoutHandle = setTimeout(async () => {
      try {
        logger.info("Running daily quota reset...");
        const result = await resetAllProfilesDailyQuota(config);
        logger.info(`Daily quota reset complete: ${result.resetCount} profiles reset`);
      } catch (error) {
        logger.error("Failed to reset daily quotas:", error);
      }

      // Schedule the next reset (24 hours from now)
      scheduleNext();
    }, msUntilReset);
  };

  // Start the schedule
  scheduleNext();

  // Return a function to cancel the schedule
  return () => {
    isRunning = false;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    logger.info("Quota reset scheduler stopped");
  };
}

/**
 * Start the quota reset scheduler if load balancing is enabled.
 * Returns a function to stop the scheduler, or null if not started.
 */
export function startQuotaResetScheduler(config: OpenClawConfig): (() => void) | null {
  if (!config.auth?.loadBalancing?.enabled) {
    logger.debug("Load balancing disabled, not starting quota reset scheduler");
    return null;
  }

  if (!config.auth?.loadBalancing?.quotaTracking) {
    logger.debug("Quota tracking disabled, not starting quota reset scheduler");
    return null;
  }

  logger.info("Starting quota reset scheduler");
  return scheduleQuotaReset(config);
}
