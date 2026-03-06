/**
 * MEMORY.md → 3-Tier JSON Migration Script
 * 
 * Converts existing MEMORY.md format to new 3-tier JSON system:
 * - Evergreen: Permanent facts (dates, instructions, preferences, technical, relationships)
 * - Archived: Historical context (older than 7 days)
 * - Daily: Recent context (last 7 days)
 */

import * as fs from "fs";
import * as path from "path";
import { DailiesManager } from "./dailies-manager.js";
import { EvergreenManager } from "./evergreen-manager.js";

interface ParsedSection {
  title: string;
  content: string;
  category: "evergreen" | "archived" | "daily";
  evergreenType?: "dates" | "instructions" | "preferences" | "technicalFacts" | "relationships";
}

export class MemoryMigrator {
  private memoryMdPath: string;
  private dailiesManager: DailiesManager;
  private evergreenManager: EvergreenManager;
  
  constructor(memoryMdPath: string, openclaw_dir: string) {
    this.memoryMdPath = memoryMdPath;
    this.dailiesManager = new DailiesManager(path.join(openclaw_dir, "memory"));
    this.evergreenManager = new EvergreenManager(path.join(openclaw_dir, "memory"));
  }
  
  /**
   * Main migration function
   */
  async migrate(): Promise<void> {
    console.log("🔄 Starting MEMORY.md migration...");
    
    if (!fs.existsSync(this.memoryMdPath)) {
      throw new Error(`MEMORY.md not found at: ${this.memoryMdPath}`);
    }
    
    // Initialize managers
    await this.dailiesManager.initialize();
    await this.evergreenManager.initialize();
    
    const content = fs.readFileSync(this.memoryMdPath, "utf-8");
    const sections = this.parseSections(content);
    
    console.log(`📋 Found ${sections.length} sections to migrate`);
    
    let evergreenCount = 0;
    let archivedCount = 0;
    
    for (const section of sections) {
      if (section.category === "evergreen" && section.evergreenType) {
        await this.migrateToEvergreen(section);
        evergreenCount++;
      } else if (section.category === "archived") {
        await this.migrateToArchived(section);
        archivedCount++;
      }
      // Skip "daily" - it's already recent context
    }
    
    console.log(`✅ Migration complete!`);
    console.log(`   • ${evergreenCount} evergreen entries created`);
    console.log(`   • ${archivedCount} archived entries created`);
    console.log(`\n📝 Backup your original MEMORY.md before deleting!`);
  }
  
  /**
   * Parse MEMORY.md into sections
   */
  private parseSections(content: string): ParsedSection[] {
    const sections: ParsedSection[] = [];
    const lines = content.split("\n");
    
    let currentSection: ParsedSection | null = null;
    let currentContent: string[] = [];
    
    for (const line of lines) {
      // Detect ## headers (main sections)
      if (line.startsWith("## ")) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join("\n").trim();
          sections.push(currentSection);
        }
        
        // Start new section
        const title = line.replace("## ", "").trim();
        currentSection = this.categorizeSection(title);
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }
    
    // Save last section
    if (currentSection) {
      currentSection.content = currentContent.join("\n").trim();
      sections.push(currentSection);
    }
    
    return sections;
  }
  
  /**
   * Categorize section by title
   */
  private categorizeSection(title: string): ParsedSection {
    const lower = title.toLowerCase();
    
    // Evergreen: Relationships & Community
    if (lower.includes("community") || lower.includes("relationship")) {
      return {
        title,
        content: "",
        category: "evergreen",
        evergreenType: "relationships"
      };
    }
    
    // Evergreen: Trading Strategy = Instructions
    if (lower.includes("trading") || lower.includes("strategy") || lower.includes("boundaries")) {
      return {
        title,
        content: "",
        category: "evergreen",
        evergreenType: "instructions"
      };
    }
    
    // Evergreen: Configuration & Technical
    if (lower.includes("configuration") || lower.includes("technical") || lower.includes("system status")) {
      return {
        title,
        content: "",
        category: "evergreen",
        evergreenType: "technicalFacts"
      };
    }
    
    // Archived: Temporary events (news, market context, etc.)
    if (lower.includes("operation") || lower.includes("market") || lower.includes("model landscape") || 
        lower.includes("linux support") || lower.includes("tx-23") || lower.includes("congressional")) {
      return {
        title,
        content: "",
        category: "archived",
      };
    }
    
    // Default to archived for unknown sections
    return {
      title,
      content: "",
      category: "archived",
    };
  }
  
  /**
   * Migrate section to evergreen
   */
  private async migrateToEvergreen(section: ParsedSection): Promise<void> {
    if (!section.evergreenType) return;
    
    const summary = this.summarizeSection(section.content);
    const timestamp = new Date().toISOString();
    
    switch (section.evergreenType) {
      case "relationships":
        // Extract key relationship facts
        const relationshipFacts = this.extractKeyFacts(section.content);
        for (const fact of relationshipFacts) {
          await this.evergreenManager.addRelationship({
            name: section.title,
            relationship: fact,
            context: `Migrated from MEMORY.md section: ${section.title}`,
            significance: "Community context and communication patterns",
            dateEstablished: timestamp
          });
        }
        break;
        
      case "instructions":
        // Extract standing instructions
        const instructions = this.extractKeyFacts(section.content);
        for (const instruction of instructions) {
          await this.evergreenManager.addInstruction({
            instruction: instruction,
            context: `From ${section.title}`,
            scope: "general",
            priority: "normal",
            dateAdded: timestamp
          });
        }
        break;
        
      case "technicalFacts":
        // Extract technical facts
        const facts = this.extractKeyFacts(section.content);
        for (const fact of facts) {
          await this.evergreenManager.addTechnicalFact({
            fact: fact,
            category: "system",
            context: `From ${section.title}`,
            dateRecorded: timestamp
          });
        }
        break;
        
      case "preferences":
        // Extract preferences
        const prefs = this.extractKeyFacts(section.content);
        for (const pref of prefs) {
          await this.evergreenManager.addPreference({
            preference: pref,
            context: `From ${section.title}`,
            scope: "general",
            dateSet: timestamp
          });
        }
        break;
    }
    
    console.log(`   ✓ Evergreen: ${section.title} → ${section.evergreenType}`);
  }
  
  /**
   * Migrate section to archived
   */
  private async migrateToArchived(section: ParsedSection): Promise<void> {
    // Get compaction date from MEMORY.md header (2026-03-06)
    const compactionDate = "2026-03-06";
    
    const highlight = {
      timestamp: new Date(compactionDate).toISOString(),
      userId: "system",
      userName: "Migration",
      context: `Section: ${section.title}`,
      summary: this.summarizeSection(section.content),
      topics: [section.title],
      evergreenCandidate: false
    };
    
    // Move directly to archived (since it's from a previous compaction)
    await this.dailiesManager.appendHighlights(compactionDate, "migration", [highlight]);
    await this.dailiesManager.moveDailyToArchived(compactionDate);
    
    console.log(`   ✓ Archived: ${section.title}`);
  }
  
  /**
   * Extract key facts from content (bullet points)
   */
  private extractKeyFacts(content: string): string[] {
    const facts: string[] = [];
    const lines = content.split("\n");
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Bullet points or dashes
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const fact = trimmed.replace(/^[*-]\s+/, "").trim();
        if (fact.length > 10) { // Skip very short lines
          facts.push(fact);
        }
      }
    }
    
    return facts;
  }
  
  /**
   * Summarize section content (take first 500 chars)
   */
  private summarizeSection(content: string): string {
    const cleaned = content.replace(/[#*\-]/g, "").trim();
    return cleaned.length > 500 ? cleaned.substring(0, 500) + "..." : cleaned;
  }
}

/**
 * CLI runner
 */
async function main() {
  const memoryMdPath = process.argv[2] || "C:\\Users\\admin\\.openclaw\\workspace\\MEMORY.md";
  const openclawDir = process.argv[3] || "C:\\Users\\admin\\.openclaw";
  
  console.log(`📁 MEMORY.md: ${memoryMdPath}`);
  console.log(`📁 OpenClaw dir: ${openclawDir}`);
  console.log("");
  
  const migrator = new MemoryMigrator(memoryMdPath, openclawDir);
  await migrator.migrate();
  
  console.log("\n🎉 Done! Check your memory/ directory:");
  console.log(`   • ${openclawDir}\\memory\\evergreen.json`);
  console.log(`   • ${openclawDir}\\memory\\archived\\2026-03-06.json`);
}

// Run if called directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  main().catch(console.error);
}
