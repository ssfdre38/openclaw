/**
 * Memory Loader - Auto-loads memories on session start
 * 
 * Loads:
 * 1. Evergreen (always) - Permanent facts, instructions, preferences
 * 2. Recent dailies (last N days) - Recent context
 */

import * as path from "path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { DailiesManager } from "./dailies-manager.js";
import { EvergreenManager } from "./evergreen-manager.js";

interface LoadedMemories {
  evergreen: {
    dates: any[];
    instructions: any[];
    preferences: any[];
    technicalFacts: any[];
    relationships: any[];
  };
  recentDailies: any[];
  stats: {
    evergreenCount: number;
    dailiesCount: number;
    daysLoaded: number;
  };
}

export class MemoryLoader {
  private dailiesManager: DailiesManager;
  private evergreenManager: EvergreenManager;
  private daysToLoad: number;
  
  constructor(memoryPath: string, daysToLoad: number = 7) {
    this.dailiesManager = new DailiesManager(memoryPath);
    this.evergreenManager = new EvergreenManager(memoryPath);
    this.daysToLoad = daysToLoad;
  }
  
  /**
   * Load all memories for session start
   */
  async loadMemories(): Promise<LoadedMemories> {
    // Initialize managers
    await this.dailiesManager.initialize();
    await this.evergreenManager.initialize();
    
    // Load evergreen (always)
    const evergreen = await this.evergreenManager.search();
    
    // Load recent dailies
    const recentDailies = await this.dailiesManager.loadRecentDailies(this.daysToLoad);
    
    // Calculate stats
    const evergreenCount = 
      evergreen.dates.length + 
      evergreen.instructions.length + 
      evergreen.preferences.length + 
      evergreen.technicalFacts.length + 
      evergreen.relationships.length;
    
    const dailiesCount = recentDailies.reduce((sum, day) => sum + day.highlights.length, 0);
    
    return {
      evergreen,
      recentDailies,
      stats: {
        evergreenCount,
        dailiesCount,
        daysLoaded: recentDailies.length,
      }
    };
  }
  
  /**
   * Format loaded memories as context string for agent
   */
  formatForContext(memories: LoadedMemories): string {
    const sections: string[] = [];
    
    // Evergreen section
    sections.push("# EVERGREEN MEMORY (Permanent Facts)\n");
    
    if (memories.evergreen.instructions.length > 0) {
      sections.push("## Instructions");
      memories.evergreen.instructions.forEach((item: any) => {
        sections.push(`- [${item.id}] ${item.instruction}`);
        if (item.context) sections.push(`  Context: ${item.context}`);
      });
      sections.push("");
    }
    
    if (memories.evergreen.relationships.length > 0) {
      sections.push("## Relationships & Community");
      memories.evergreen.relationships.forEach((item: any) => {
        sections.push(`- [${item.id}] ${item.name}: ${item.relationship}`);
        if (item.context) sections.push(`  ${item.context}`);
      });
      sections.push("");
    }
    
    if (memories.evergreen.technicalFacts.length > 0) {
      sections.push("## Technical Facts");
      memories.evergreen.technicalFacts.forEach((item: any) => {
        sections.push(`- [${item.id}] ${item.fact}`);
        if (item.context) sections.push(`  Context: ${item.context}`);
      });
      sections.push("");
    }
    
    if (memories.evergreen.preferences.length > 0) {
      sections.push("## Preferences");
      memories.evergreen.preferences.forEach((item: any) => {
        sections.push(`- [${item.id}] ${item.preference}`);
      });
      sections.push("");
    }
    
    if (memories.evergreen.dates.length > 0) {
      sections.push("## Important Dates");
      memories.evergreen.dates.forEach((item: any) => {
        sections.push(`- [${item.id}] ${item.date}: ${item.description}`);
      });
      sections.push("");
    }
    
    // Recent dailies section
    if (memories.recentDailies.length > 0) {
      sections.push("---\n");
      sections.push("# RECENT MEMORY (Last 7 Days)\n");
      
      for (const day of memories.recentDailies) {
        sections.push(`## ${day.date}`);
        sections.push(`Topics: ${day.stats.topicsDiscussed.join(", ")}`);
        sections.push("");
        
        for (const highlight of day.highlights) {
          sections.push(`- [${highlight.id}] ${highlight.summary}`);
          if (highlight.context) sections.push(`  Context: ${highlight.context}`);
          if (highlight.topics.length > 0) sections.push(`  Topics: ${highlight.topics.join(", ")}`);
        }
        sections.push("");
      }
    }
    
    return sections.join("\n");
  }
}

/**
 * Register memory auto-loader with OpenClaw
 * 
 * For now, this is a placeholder. Memory loading will be done manually
 * via the search tools or can be triggered by the agent.
 * 
 * Future: Hook into "agent:bootstrap" event to auto-load memories.
 */
export function registerMemoryLoader(api: OpenClawPluginApi): void {
  // TODO: Implement auto-load when agent starts
  // For now, memories are accessible via search tools
  api.logger.info("Memory loader registered (manual load via search tools)");
}
