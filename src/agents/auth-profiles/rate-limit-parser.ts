import { createSubsystemLogger } from "../../logging/subsystem.js";

const logger = createSubsystemLogger("auth-profiles/rate-limit-parser");

export type RateLimitInfo = {
  /** Remaining requests from API headers */
  requestsRemaining?: number;
  /** Remaining tokens from API headers */
  tokensRemaining?: number;
  /** Requests per minute limit */
  rpm?: number;
  /** Tokens per minute limit */
  tpm?: number;
  /** When the rate limit resets (timestamp in ms) */
  resetTimestamp?: number;
};

/**
 * Parse rate limit headers from Anthropic API responses.
 * 
 * Headers:
 * - anthropic-ratelimit-requests-limit
 * - anthropic-ratelimit-requests-remaining
 * - anthropic-ratelimit-requests-reset
 * - anthropic-ratelimit-tokens-limit
 * - anthropic-ratelimit-tokens-remaining
 * - anthropic-ratelimit-tokens-reset
 */
export function parseAnthropicRateLimitHeaders(headers: Record<string, string>): RateLimitInfo {
  const info: RateLimitInfo = {};

  const requestsRemaining = headers["anthropic-ratelimit-requests-remaining"];
  const tokensRemaining = headers["anthropic-ratelimit-tokens-remaining"];
  const requestsLimit = headers["anthropic-ratelimit-requests-limit"];
  const tokensLimit = headers["anthropic-ratelimit-tokens-limit"];
  const requestsReset = headers["anthropic-ratelimit-requests-reset"];
  const tokensReset = headers["anthropic-ratelimit-tokens-reset"];

  if (requestsRemaining) {
    const value = parseInt(requestsRemaining, 10);
    if (!isNaN(value)) {
      info.requestsRemaining = value;
    }
  }

  if (tokensRemaining) {
    const value = parseInt(tokensRemaining, 10);
    if (!isNaN(value)) {
      info.tokensRemaining = value;
    }
  }

  if (requestsLimit) {
    const value = parseInt(requestsLimit, 10);
    if (!isNaN(value)) {
      info.rpm = value; // Anthropic uses per-minute limits
    }
  }

  if (tokensLimit) {
    const value = parseInt(tokensLimit, 10);
    if (!isNaN(value)) {
      info.tpm = value;
    }
  }

  // Parse reset time (ISO 8601 timestamp)
  const resetTime = requestsReset || tokensReset;
  if (resetTime) {
    const resetDate = new Date(resetTime);
    if (!isNaN(resetDate.getTime())) {
      info.resetTimestamp = resetDate.getTime();
    }
  }

  return info;
}

/**
 * Parse rate limit headers from OpenAI API responses.
 * 
 * Headers:
 * - x-ratelimit-limit-requests
 * - x-ratelimit-remaining-requests
 * - x-ratelimit-reset-requests
 * - x-ratelimit-limit-tokens
 * - x-ratelimit-remaining-tokens
 * - x-ratelimit-reset-tokens
 */
export function parseOpenAIRateLimitHeaders(headers: Record<string, string>): RateLimitInfo {
  const info: RateLimitInfo = {};

  const requestsRemaining = headers["x-ratelimit-remaining-requests"];
  const tokensRemaining = headers["x-ratelimit-remaining-tokens"];
  const requestsLimit = headers["x-ratelimit-limit-requests"];
  const tokensLimit = headers["x-ratelimit-limit-tokens"];
  const requestsReset = headers["x-ratelimit-reset-requests"];
  const tokensReset = headers["x-ratelimit-reset-tokens"];

  if (requestsRemaining) {
    const value = parseInt(requestsRemaining, 10);
    if (!isNaN(value)) {
      info.requestsRemaining = value;
    }
  }

  if (tokensRemaining) {
    const value = parseInt(tokensRemaining, 10);
    if (!isNaN(value)) {
      info.tokensRemaining = value;
    }
  }

  if (requestsLimit) {
    const value = parseInt(requestsLimit, 10);
    if (!isNaN(value)) {
      info.rpm = value;
    }
  }

  if (tokensLimit) {
    const value = parseInt(tokensLimit, 10);
    if (!isNaN(value)) {
      info.tpm = value;
    }
  }

  // Parse reset time (seconds since epoch for requests, but could be different format)
  const resetTime = requestsReset || tokensReset;
  if (resetTime) {
    // OpenAI uses seconds or ISO 8601
    const asSeconds = parseInt(resetTime, 10);
    if (!isNaN(asSeconds)) {
      info.resetTimestamp = asSeconds * 1000; // Convert to milliseconds
    } else {
      const resetDate = new Date(resetTime);
      if (!isNaN(resetDate.getTime())) {
        info.resetTimestamp = resetDate.getTime();
      }
    }
  }

  return info;
}

/**
 * Parse rate limit headers from Google AI API responses.
 * 
 * Headers:
 * - x-goog-quota-user (optional)
 * - x-goog-quota-remaining
 * - x-goog-quota-reset
 */
export function parseGoogleRateLimitHeaders(headers: Record<string, string>): RateLimitInfo {
  const info: RateLimitInfo = {};

  const quotaRemaining = headers["x-goog-quota-remaining"];
  const quotaReset = headers["x-goog-quota-reset"];

  if (quotaRemaining) {
    const value = parseInt(quotaRemaining, 10);
    if (!isNaN(value)) {
      // Google doesn't distinguish between requests and tokens in headers
      // We'll store it as requests remaining
      info.requestsRemaining = value;
    }
  }

  if (quotaReset) {
    // Parse reset time (ISO 8601 or seconds)
    const asSeconds = parseInt(quotaReset, 10);
    if (!isNaN(asSeconds)) {
      info.resetTimestamp = asSeconds * 1000;
    } else {
      const resetDate = new Date(quotaReset);
      if (!isNaN(resetDate.getTime())) {
        info.resetTimestamp = resetDate.getTime();
      }
    }
  }

  return info;
}

/**
 * Parse rate limit headers from any provider.
 * Automatically detects provider type from headers.
 */
export function parseRateLimitHeaders(
  provider: string,
  headers: Record<string, string | string[] | undefined>,
): RateLimitInfo | null {
  // Normalize headers to simple Record<string, string>
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      normalizedHeaders[key.toLowerCase()] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      normalizedHeaders[key.toLowerCase()] = value[0];
    }
  }

  try {
    const normalizedProvider = provider.toLowerCase();

    if (normalizedProvider === "anthropic") {
      const info = parseAnthropicRateLimitHeaders(normalizedHeaders);
      if (Object.keys(info).length > 0) {
        logger.debug(`Parsed Anthropic rate limits:`, info);
        return info;
      }
    } else if (normalizedProvider === "openai") {
      const info = parseOpenAIRateLimitHeaders(normalizedHeaders);
      if (Object.keys(info).length > 0) {
        logger.debug(`Parsed OpenAI rate limits:`, info);
        return info;
      }
    } else if (normalizedProvider === "google" || normalizedProvider === "google-ai") {
      const info = parseGoogleRateLimitHeaders(normalizedHeaders);
      if (Object.keys(info).length > 0) {
        logger.debug(`Parsed Google rate limits:`, info);
        return info;
      }
    }

    // Try all parsers if provider not recognized
    for (const parser of [
      parseAnthropicRateLimitHeaders,
      parseOpenAIRateLimitHeaders,
      parseGoogleRateLimitHeaders,
    ]) {
      const info = parser(normalizedHeaders);
      if (Object.keys(info).length > 0) {
        logger.debug(`Auto-detected rate limits for ${provider}:`, info);
        return info;
      }
    }

    return null;
  } catch (error: unknown) {
    logger.warn(`Failed to parse rate limit headers for ${provider}:`, error as Record<string, unknown>);
    return null;
  }
}
