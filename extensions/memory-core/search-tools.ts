import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import { DailiesManager } from "./dailies-manager.js";
import { EvergreenManager } from "./evergreen-manager.js";

/**
 * Memory Search Tools for 3-Tier System
 * 
 * Token-efficient search across dailies, archived, and evergreen memories
 */

interface SearchResult {
  id: string;
  date: string;
  tier: "daily" | "archived" | "evergreen";
  timestamp: string;
  summary: string;
  context?: string;
  topics?: string[];
  score?: number;
}

interface SearchConfig {
  maxResults?: number;
  maxTokens?: number; // Token budget for results
  tiers?: ("daily" | "archived" | "evergreen")[];
  dateRange?: {
    start: string; // YYYY-MM-DD
    end: string; // YYYY-MM-DD
  };
}

interface EvergreenSearchConfig {
  category?: "dates" | "instructions" | "preferences" | "technicalFacts" | "relationships";
  maxResults?: number;
}

export function registerMemorySearchTools(api: OpenClawPluginApi) {
  /**
   * Unified memory search across all tiers
   */
  api.registerTool(
    (ctx) => {
      const memoryPath = path.join(ctx.workspaceDir || ".", "memory");
      const dailiesManager = new DailiesManager(memoryPath);
      const evergreenManager = new EvergreenManager(memoryPath);

      return {
        label: "Memory Search (3-Tier)",
        name: "memory_search_tiers",
        description:
          "Search across daily memories (last 7 days), archived memories (90-day retention), and evergreen memories (permanent). Returns top matching highlights with tier tags. Use for recalling past conversations, decisions, preferences, or facts. Token-efficient: returns summaries, not full transcripts.",
        parameters: Type.Object({
          query: Type.String({ description: "Search query (topic, keyword, or question)" }),
          tiers: Type.Optional(Type.Array(Type.Union([
            Type.Literal("daily"),
            Type.Literal("archived"),
            Type.Literal("evergreen")
          ]), { description: "Which tiers to search (default: all)" })),
          maxResults: Type.Optional(Type.Number({ description: "Max results to return (default: 10)" })),
        }),
        execute: async (_toolCallId, params) => {
          try {
            // Initialize managers on first use
            await dailiesManager.initialize();
            await evergreenManager.initialize();
            
            const query = params.query as string;
            const config: SearchConfig = {
              tiers: (params.tiers as any) || ["daily", "archived", "evergreen"],
              maxResults: (params.maxResults as number) || 10,
              maxTokens: 10000, // Default 10k token budget (configurable)
              dateRange: params.dateRange as any,
            };

            const results: SearchResult[] = [];

            // Search dailies
            if (config.tiers?.includes("daily")) {
              const daysToLoad = 7; // TODO: Get from config
              const dailies = await dailiesManager.loadRecentDailies(daysToLoad);
              for (const daily of dailies) {
                for (const highlight of daily.highlights) {
                  if (matchesQuery(highlight, query)) {
                    results.push({
                      id: highlight.id,
                      date: daily.date,
                      tier: "daily",
                      timestamp: highlight.timestamp,
                      summary: highlight.summary,
                      context: highlight.context,
                      topics: highlight.topics,
                      score: calculateRelevanceScore(highlight, query),
                    });
                  }
                }
              }
            }

            // Search archived (TODO: implement when needed)
            if (config.tiers?.includes("archived")) {
              // For now, skip archived search (would need to load from disk)
              // In production: load archived/*.json and search
            }

            // Search evergreen
            if (config.tiers?.includes("evergreen")) {
              const searchResults = await evergreenManager.search(undefined, query);
              for (const item of searchResults) {
                results.push({
                  id: item.id,
                  date: "permanent",
                  tier: "evergreen",
                  timestamp: item.timestamp || item.addedTimestamp || "unknown",
                  summary: formatEvergreenForSearch(item),
                  topics: [],
                  score: calculateRelevanceScore(item, query),
                });
              }
            }

            // Sort by relevance score
            results.sort((a, b) => (b.score || 0) - (a.score || 0));

            // Limit results and apply token budget
            const limitedResults = applyTokenBudget(
              results.slice(0, config.maxResults),
              config.maxTokens || 10000,
            );

            return {
              success: true,
              results: limitedResults,
              stats: {
                totalFound: results.length,
                returned: limitedResults.length,
                tiers: config.tiers,
                estimatedTokens: estimateTokens(limitedResults),
              },
            };
          } catch (error) {
            return {
              success: false,
              error: `Memory search failed: ${String(error)}`,
            };
          }
        },
      };
    },
    { names: ["memory_search_tiers"] },
  );

  /**
   * Dedicated evergreen search (permanent memories only)
   */
  api.registerTool(
    (ctx) => {
      const memoryPath = path.join(ctx.workspaceDir || ".", "memory");
      const evergreenManager = new EvergreenManager(memoryPath);
      
      return {
        label: "Memory Search (Evergreen)",
        name: "memory_search_evergreen",
        description:
          "Search ONLY evergreen (permanent) memories: birthdays, instructions, preferences, technical facts, relationships. Fast lookup for critical long-term information. Does not search daily or archived memories.",
        parameters: Type.Object({
          query: Type.Optional(Type.String({ description: "Search query (optional if category specified)" })),
          category: Type.Optional(Type.Union([
            Type.Literal("dates"),
            Type.Literal("instructions"),
            Type.Literal("preferences"),
            Type.Literal("technicalFacts"),
            Type.Literal("relationships")
          ], { description: "Specific evergreen category to search" })),
          maxResults: Type.Optional(Type.Number({ description: "Max results to return (default: 20)" })),
        }),
        execute: async (_toolCallId, params) => {
          try {
            await evergreenManager.initialize();
            
            const query = params.query as string | undefined;
            const category = params.category as any;
            const maxResults = (params.maxResults as number) || 20;

            const results = await evergreenManager.search(category, query);

            // Format for display
            const formatted = results.slice(0, maxResults).map((item) => ({
              id: item.id,
              category: detectEvergreenCategory(item),
              content: formatEvergreenForDisplay(item),
              timestamp: item.timestamp || item.addedTimestamp || "unknown",
            }));

            return {
              success: true,
              results: formatted,
              stats: {
                totalFound: results.length,
                returned: formatted.length,
                category: category || "all",
              },
            };
          } catch (error) {
            return {
              success: false,
              error: `Evergreen search failed: ${String(error)}`,
            };
          }
        },
      };
    },
    { names: ["memory_search_evergreen"] },
  );

  /**
   * Get specific daily memory file
   */
  api.registerTool(
    (ctx) => {
      const memoryPath = path.join(ctx.workspaceDir || ".", "memory");
      const dailiesManager = new DailiesManager(memoryPath);
      
      return {
        label: "Memory Get Daily",
        name: "memory_get_daily",
        description:
          "Retrieve full daily memory file for a specific date. Returns all highlights from that day. Use when you need complete context for a specific day, not just search results.",
        parameters: Type.Object({
          date: Type.String({ description: "Date to retrieve (YYYY-MM-DD)" }),
        }),
        execute: async (_toolCallId, params) => {
          try {
            await dailiesManager.initialize();
            
            const date = params.date as string;
            const memory = await dailiesManager.readDailyMemory(date);

            if (!memory) {
              return {
                success: false,
                error: `No daily memory found for ${date}`,
              };
            }

            // Return truncated version to avoid token bloat
            const truncated = {
              date: memory.date,
              tier: memory.tier,
              sessionIds: memory.sessionIds,
              highlights: memory.highlights.map((h) => ({
                id: h.id,
                timestamp: h.timestamp,
                userName: h.userName,
                context: h.context,
                summary: h.summary,
                topics: h.topics,
                evergreenCandidate: h.evergreenCandidate,
              })),
              stats: memory.stats,
            };

            return {
              success: true,
              memory: truncated,
              estimatedTokens: estimateTokens([truncated]),
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to get daily memory: ${String(error)}`,
            };
          }
        },
      };
    },
    { names: ["memory_get_daily"] },
  );

  /**
   * Get specific archived memory file (placeholder for now)
   */
  api.registerTool(
    (ctx) => {
      const memoryPath = path.join(ctx.workspaceDir || ".", "memory");
      const dailiesManager = new DailiesManager(memoryPath);
      
      return {
        label: "Memory Get Archived",
        name: "memory_get_archived",
        description:
          "Retrieve full archived memory file for a specific date (7-90 days old). Returns all highlights from that day. Use for deeper historical context.",
        parameters: Type.Object({
          date: Type.String({ description: "Date to retrieve (YYYY-MM-DD)" }),
        }),
        execute: async (_toolCallId, params) => {
          try {
            const date = params.date as string;
            // TODO: Implement archived reading (similar to dailies)
            return {
              success: false,
              error: "Archived memory retrieval not yet implemented",
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to get archived memory: ${String(error)}`,
            };
          }
        },
      };
    },
    { names: ["memory_get_archived"] },
  );
}

// Helper functions

function matchesQuery(item: any, query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const searchable = JSON.stringify(item).toLowerCase();
  return searchable.includes(lowerQuery);
}

function calculateRelevanceScore(item: any, query: string): number {
  const lowerQuery = query.toLowerCase();
  const searchable = JSON.stringify(item).toLowerCase();
  
  // Simple scoring: count occurrences
  const matches = (searchable.match(new RegExp(lowerQuery, "g")) || []).length;
  
  // Boost if match is in summary or context
  let score = matches;
  if (item.summary?.toLowerCase().includes(lowerQuery)) score += 5;
  if (item.context?.toLowerCase().includes(lowerQuery)) score += 3;
  
  return score;
}

function formatEvergreenForSearch(item: any): string {
  if (item.instruction) return `Instruction: ${item.instruction}`;
  if (item.preference) return `Preference: ${item.preference}`;
  if (item.fact) return `Fact: ${item.fact}`;
  if (item.name) return `Relationship: ${item.name} (${item.role})`;
  if (item.person) return `Date: ${item.person} - ${item.type} on ${item.date}`;
  return JSON.stringify(item);
}

function formatEvergreenForDisplay(item: any): string {
  if (item.instruction) {
    return `${item.instruction} (Context: ${item.context})`;
  }
  if (item.preference) {
    return `${item.preference} (Category: ${item.category}, Confidence: ${item.confidence})`;
  }
  if (item.fact) {
    return `${item.fact} (Context: ${item.context})`;
  }
  if (item.name) {
    return `${item.name} - ${item.role} (${item.context})`;
  }
  if (item.person) {
    return `${item.person}: ${item.type} on ${item.date}`;
  }
  return JSON.stringify(item);
}

function detectEvergreenCategory(item: any): string {
  if (item.instruction) return "instructions";
  if (item.preference) return "preferences";
  if (item.fact) return "technicalFacts";
  if (item.name) return "relationships";
  if (item.person) return "dates";
  return "unknown";
}

function applyTokenBudget(results: SearchResult[], maxTokens: number): SearchResult[] {
  let totalTokens = 0;
  const limitedResults: SearchResult[] = [];

  for (const result of results) {
    const tokens = estimateTokens([result]);
    if (totalTokens + tokens > maxTokens) {
      break; // Hit token budget limit
    }
    limitedResults.push(result);
    totalTokens += tokens;
  }

  return limitedResults;
}

function estimateTokens(items: any[]): number {
  // Rough estimate: ~4 chars per token
  const text = JSON.stringify(items);
  return Math.ceil(text.length / 4);
}
