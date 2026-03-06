import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * 3-Tier Memory System: Evergreen Manager
 * 
 * Manages permanent memories (dates, instructions, preferences, facts)
 */

export interface EvergreenDate {
  id: string;
  type: "birthday" | "anniversary" | "important";
  person: string;
  date: string; // MM-DD or full ISO
  source: string;
  addedTimestamp: string;
  addedBy: string;
}

export interface EvergreenInstruction {
  id: string;
  timestamp: string;
  userId: string;
  instruction: string;
  context: string;
  source: string;
  addedTimestamp: string;
}

export interface EvergreenPreference {
  id: string;
  timestamp: string;
  userId: string;
  category: string;
  preference: string;
  source: string;
  confidence: "low" | "medium" | "high";
}

export interface EvergreenTechnicalFact {
  id: string;
  timestamp: string;
  userId: string;
  fact: string;
  context: string;
  source: string;
  permanent: boolean;
}

export interface EvergreenRelationship {
  id: string;
  timestamp: string;
  name: string;
  role: string;
  context: string;
  source: string;
}

export interface EvergreenMemory {
  tier: "evergreen";
  lastUpdated: string;
  categories: {
    dates: EvergreenDate[];
    instructions: EvergreenInstruction[];
    preferences: EvergreenPreference[];
    technicalFacts: EvergreenTechnicalFact[];
    relationships: EvergreenRelationship[];
  };
}

export class EvergreenManager {
  private evergreenPath: string;
  private memory: EvergreenMemory | null = null;

  constructor(memoryPath: string) {
    this.evergreenPath = path.join(memoryPath, "evergreen.json");
  }

  /**
   * Initialize the evergreen manager (load or create evergreen.json)
   */
  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.evergreenPath, "utf-8");
      this.memory = JSON.parse(data);
    } catch (error) {
      // File doesn't exist, create new one
      this.memory = {
        tier: "evergreen",
        lastUpdated: new Date().toISOString(),
        categories: {
          dates: [],
          instructions: [],
          preferences: [],
          technicalFacts: [],
          relationships: [],
        },
      };
      await this.save();
    }
  }

  /**
   * Save evergreen memory to disk
   */
  private async save(): Promise<void> {
    if (!this.memory) return;
    this.memory.lastUpdated = new Date().toISOString();
    
    // Ensure directory exists
    const dir = path.dirname(this.evergreenPath);
    if (!await fs.access(dir).then(() => true).catch(() => false)) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    await fs.writeFile(this.evergreenPath, JSON.stringify(this.memory, null, 2), "utf-8");
  }

  /**
   * Generate a unique ID for evergreen items
   */
  private generateId(category: string, existingIds: string[]): string {
    const prefix = category.substring(0, 4);
    let counter = 1;
    let id = `${prefix}-${String(counter).padStart(3, "0")}`;
    
    while (existingIds.includes(id)) {
      counter++;
      id = `${prefix}-${String(counter).padStart(3, "0")}`;
    }
    
    return id;
  }

  /**
   * Add a date to evergreen
   */
  async addDate(date: Omit<EvergreenDate, "id">): Promise<string> {
    if (!this.memory) await this.initialize();
    if (!this.memory) throw new Error("Failed to initialize evergreen memory");

    const existingIds = this.memory.categories.dates.map((d) => d.id);
    const id = this.generateId("date", existingIds);

    this.memory.categories.dates.push({ ...date, id });
    await this.save();
    return id;
  }

  /**
   * Add an instruction to evergreen
   */
  async addInstruction(instruction: Omit<EvergreenInstruction, "id">): Promise<string> {
    if (!this.memory) await this.initialize();
    if (!this.memory) throw new Error("Failed to initialize evergreen memory");

    const existingIds = this.memory.categories.instructions.map((i) => i.id);
    const id = this.generateId("inst", existingIds);

    this.memory.categories.instructions.push({ ...instruction, id });
    await this.save();
    return id;
  }

  /**
   * Add a preference to evergreen
   */
  async addPreference(preference: Omit<EvergreenPreference, "id">): Promise<string> {
    if (!this.memory) await this.initialize();
    if (!this.memory) throw new Error("Failed to initialize evergreen memory");

    const existingIds = this.memory.categories.preferences.map((p) => p.id);
    const id = this.generateId("pref", existingIds);

    this.memory.categories.preferences.push({ ...preference, id });
    await this.save();
    return id;
  }

  /**
   * Add a technical fact to evergreen
   */
  async addTechnicalFact(fact: Omit<EvergreenTechnicalFact, "id">): Promise<string> {
    if (!this.memory) await this.initialize();
    if (!this.memory) throw new Error("Failed to initialize evergreen memory");

    const existingIds = this.memory.categories.technicalFacts.map((f) => f.id);
    const id = this.generateId("tech", existingIds);

    this.memory.categories.technicalFacts.push({ ...fact, id });
    await this.save();
    return id;
  }

  /**
   * Add a relationship to evergreen
   */
  async addRelationship(relationship: Omit<EvergreenRelationship, "id">): Promise<string> {
    if (!this.memory) await this.initialize();
    if (!this.memory) throw new Error("Failed to initialize evergreen memory");

    const existingIds = this.memory.categories.relationships.map((r) => r.id);
    const id = this.generateId("rel", existingIds);

    this.memory.categories.relationships.push({ ...relationship, id });
    await this.save();
    return id;
  }

  /**
   * Get all evergreen memory
   */
  getMemory(): EvergreenMemory | null {
    return this.memory;
  }

  /**
   * Search evergreen by category and query
   */
  search(category?: keyof EvergreenMemory["categories"], query?: string): any[] {
    if (!this.memory) return [];

    let items: any[] = [];

    if (category) {
      items = this.memory.categories[category] || [];
    } else {
      // Search all categories
      items = [
        ...this.memory.categories.dates,
        ...this.memory.categories.instructions,
        ...this.memory.categories.preferences,
        ...this.memory.categories.technicalFacts,
        ...this.memory.categories.relationships,
      ];
    }

    if (!query) return items;

    // Simple text search
    const lowerQuery = query.toLowerCase();
    return items.filter((item) => {
      const json = JSON.stringify(item).toLowerCase();
      return json.includes(lowerQuery);
    });
  }

  /**
   * Remove an item from evergreen by ID
   */
  async removeById(id: string): Promise<boolean> {
    if (!this.memory) await this.initialize();
    if (!this.memory) return false;

    let found = false;

    for (const category of Object.keys(this.memory.categories)) {
      const items = (this.memory.categories as any)[category];
      const index = items.findIndex((item: any) => item.id === id);
      if (index !== -1) {
        items.splice(index, 1);
        found = true;
        break;
      }
    }

    if (found) {
      await this.save();
    }

    return found;
  }
}
