/**
 * Archive Tool - Manual memory archival
 * 
 * Allows manual creation of daily highlights from current session context.
 * Useful before /new or /reset commands to preserve important context.
 */

import * as path from "path";
import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { DailiesManager } from "./dailies-manager.js";

export interface ArchiveToolInput {
  highlights: Array<{
    summary: string;
    context?: string;
    topics?: string[];
    evergreenCandidate?: boolean;
  }>;
  date?: string; // YYYY-MM-DD, defaults to today
}

/**
 * Register memory_archive_now tool
 */
export function registerArchiveTool(api: OpenClawPluginApi): void {
  api.registerTool(
    (ctx) => ({
      name: "memory_archive_now",
      label: "Archive Memory Now",
      description: "Manually archive current session highlights to memory. Use before /new or /reset to preserve important context.",
      parameters: Type.Object({
        highlights: Type.Array(Type.Object({
          summary: Type.String({ description: "1-3 sentence summary of the highlight" }),
          context: Type.Optional(Type.String({ description: "Additional context about this highlight" })),
          topics: Type.Optional(Type.Array(Type.String(), { description: "Topic tags for this highlight" })),
          evergreenCandidate: Type.Optional(Type.Boolean({ description: "Whether this might be evergreen material" })),
        })),
        date: Type.Optional(Type.String({ description: "Date to archive under (YYYY-MM-DD), defaults to today" })),
      }),
      execute: async (_toolCallId, params: Record<string, unknown>) => {
        try {
          const memoryPath = path.join(
            ctx.config.openclaw_dir || process.env.OPENCLAW_DIR || ".",
            "memory"
          );
          
          const dailiesManager = new DailiesManager(memoryPath);
          await dailiesManager.initialize();
          
          // Get date (default to today)
          const date = (params.date as string) || new Date().toISOString().split("T")[0];
          
          const highlights = ((params.highlights as any[]) || []).map(h => ({
            timestamp: new Date().toISOString(),
            userId: "user",
            userName: "User",
            context: h.context || "",
            summary: h.summary,
            topics: h.topics || [],
            evergreenCandidate: h.evergreenCandidate || false
          }));
          
          // Save highlights
          await dailiesManager.appendHighlights(date, ctx.sessionKey || "manual", highlights);
          
          return {
            success: true,
            date,
            highlightsCount: highlights.length,
            highlights: highlights.map((h, i) => ({
              id: `hl-${date}-${String(i + 1).padStart(3, "0")}`,
              summary: h.summary,
              topics: h.topics,
              evergreenCandidate: h.evergreenCandidate
            }))
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || String(error)
          };
        }
      }
    }),
    { names: ["memory_archive_now"] }
  );
}
