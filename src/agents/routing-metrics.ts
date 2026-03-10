/**
 * Metrics tracking for complexity routing.
 * Tracks cost savings, complexity distribution, and routing decisions.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { TaskComplexity, RoutingDecision } from "./complexity-routing.types.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("routing-metrics");

export interface RoutingMetricsEntry {
  timestamp: string;
  complexity: TaskComplexity;
  modelUsed: string;
  score: number;
  confidence?: number;
  estimatedCost?: number;
  promptLength: number;
  reason?: string;
}

export interface RoutingMetricsSummary {
  totalRequests: number;
  byComplexity: Record<TaskComplexity, number>;
  totalCostSavings: number;
  averageCostPerRequest: number;
  modelUsageCount: Record<string, number>;
  periodStart: string;
  periodEnd: string;
}

/**
 * In-memory metrics store (resets on restart).
 * For production, this could be persisted to disk or sent to observability service.
 */
class RoutingMetricsStore {
  private entries: RoutingMetricsEntry[] = [];
  private readonly maxEntries = 10000; // Keep last 10k entries

  /**
   * Record a routing decision.
   */
  record(decision: RoutingDecision, promptLength: number): void {
    const entry: RoutingMetricsEntry = {
      timestamp: new Date().toISOString(),
      complexity: decision.complexity,
      modelUsed: `${decision.provider}/${decision.model}`,
      score: decision.classification.score,
      confidence: decision.classification.confidence,
      estimatedCost: decision.estimatedCost,
      promptLength,
      reason: decision.reason,
    };

    this.entries.push(entry);

    // Trim old entries if we exceed max
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    log.debug("Recorded routing metric:", {
      complexity: entry.complexity,
      model: entry.modelUsed,
      cost: entry.estimatedCost?.toFixed(4) ?? "unknown",
    });
  }

  /**
   * Get summary statistics for a time period.
   */
  getSummary(params?: { sinceHours?: number }): RoutingMetricsSummary {
    let entries = this.entries;

    // Filter by time if requested
    if (params?.sinceHours) {
      const cutoff = new Date(Date.now() - params.sinceHours * 60 * 60 * 1000);
      entries = entries.filter((e) => new Date(e.timestamp) >= cutoff);
    }

    if (entries.length === 0) {
      return {
        totalRequests: 0,
        byComplexity: { simple: 0, moderate: 0, complex: 0 },
        totalCostSavings: 0,
        averageCostPerRequest: 0,
        modelUsageCount: {},
        periodStart: new Date().toISOString(),
        periodEnd: new Date().toISOString(),
      };
    }

    // Count by complexity
    const byComplexity: Record<TaskComplexity, number> = {
      simple: 0,
      moderate: 0,
      complex: 0,
    };

    // Count model usage
    const modelUsageCount: Record<string, number> = {};

    let totalCost = 0;
    let costSavings = 0;

    for (const entry of entries) {
      byComplexity[entry.complexity]++;

      modelUsageCount[entry.modelUsed] = (modelUsageCount[entry.modelUsed] || 0) + 1;

      if (entry.estimatedCost !== undefined) {
        totalCost += entry.estimatedCost;

        // Calculate savings: if we used a free model instead of paid
        // Assume baseline cost of $0.01 per request for paid models
        if (entry.estimatedCost === 0) {
          costSavings += 0.01; // Saved ~1 cent per free request
        }
      }
    }

    return {
      totalRequests: entries.length,
      byComplexity,
      totalCostSavings: costSavings,
      averageCostPerRequest: entries.length > 0 ? totalCost / entries.length : 0,
      modelUsageCount,
      periodStart: entries[0].timestamp,
      periodEnd: entries[entries.length - 1].timestamp,
    };
  }

  /**
   * Get recent routing decisions.
   */
  getRecent(limit: number = 20): RoutingMetricsEntry[] {
    return this.entries.slice(-limit);
  }

  /**
   * Clear all metrics.
   */
  clear(): void {
    this.entries = [];
    log.info("Cleared routing metrics");
  }

  /**
   * Export metrics to JSON file.
   */
  async exportToFile(filepath: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(filepath, JSON.stringify(this.entries, null, 2), "utf-8");
      log.info(`Exported ${this.entries.length} metrics to ${filepath}`);
    } catch (error) {
      log.error("Failed to export metrics:", { error });
      throw error;
    }
  }

  /**
   * Import metrics from JSON file.
   */
  async importFromFile(filepath: string): Promise<void> {
    try {
      const data = await fs.readFile(filepath, "utf-8");
      const imported = JSON.parse(data) as RoutingMetricsEntry[];
      this.entries = imported.slice(-this.maxEntries); // Keep only last N
      log.info(`Imported ${this.entries.length} metrics from ${filepath}`);
    } catch (error) {
      log.error("Failed to import metrics:", { error });
      throw error;
    }
  }
}

// Global metrics store
export const routingMetrics = new RoutingMetricsStore();

/**
 * Record a routing decision in metrics.
 */
export function recordRoutingMetrics(decision: RoutingDecision, promptLength: number): void {
  routingMetrics.record(decision, promptLength);
}

/**
 * Get routing metrics summary.
 */
export function getRoutingMetricsSummary(params?: { sinceHours?: number }): RoutingMetricsSummary {
  return routingMetrics.getSummary(params);
}

/**
 * Get recent routing decisions.
 */
export function getRecentRoutingDecisions(limit?: number): RoutingMetricsEntry[] {
  return routingMetrics.getRecent(limit);
}

/**
 * Clear routing metrics.
 */
export function clearRoutingMetrics(): void {
  routingMetrics.clear();
}

/**
 * Export metrics to file.
 */
export async function exportRoutingMetrics(filepath: string): Promise<void> {
  await routingMetrics.exportToFile(filepath);
}

/**
 * Import metrics from file.
 */
export async function importRoutingMetrics(filepath: string): Promise<void> {
  await routingMetrics.importFromFile(filepath);
}
