import * as fs from "node:fs/promises";
import * as path from "node:path";
export class EvergreenManager {
    evergreenPath;
    memory = null;
    constructor(memoryPath) {
        this.evergreenPath = path.join(memoryPath, "evergreen.json");
    }
    /**
     * Initialize the evergreen manager (load or create evergreen.json)
     */
    async initialize() {
        try {
            const data = await fs.readFile(this.evergreenPath, "utf-8");
            this.memory = JSON.parse(data);
        }
        catch (error) {
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
    async save() {
        if (!this.memory)
            return;
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
    generateId(category, existingIds) {
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
    async addDate(date) {
        if (!this.memory)
            await this.initialize();
        if (!this.memory)
            throw new Error("Failed to initialize evergreen memory");
        const existingIds = this.memory.categories.dates.map((d) => d.id);
        const id = this.generateId("date", existingIds);
        this.memory.categories.dates.push({ ...date, id });
        await this.save();
        return id;
    }
    /**
     * Add an instruction to evergreen
     */
    async addInstruction(instruction) {
        if (!this.memory)
            await this.initialize();
        if (!this.memory)
            throw new Error("Failed to initialize evergreen memory");
        const existingIds = this.memory.categories.instructions.map((i) => i.id);
        const id = this.generateId("inst", existingIds);
        this.memory.categories.instructions.push({ ...instruction, id });
        await this.save();
        return id;
    }
    /**
     * Add a preference to evergreen
     */
    async addPreference(preference) {
        if (!this.memory)
            await this.initialize();
        if (!this.memory)
            throw new Error("Failed to initialize evergreen memory");
        const existingIds = this.memory.categories.preferences.map((p) => p.id);
        const id = this.generateId("pref", existingIds);
        this.memory.categories.preferences.push({ ...preference, id });
        await this.save();
        return id;
    }
    /**
     * Add a technical fact to evergreen
     */
    async addTechnicalFact(fact) {
        if (!this.memory)
            await this.initialize();
        if (!this.memory)
            throw new Error("Failed to initialize evergreen memory");
        const existingIds = this.memory.categories.technicalFacts.map((f) => f.id);
        const id = this.generateId("tech", existingIds);
        this.memory.categories.technicalFacts.push({ ...fact, id });
        await this.save();
        return id;
    }
    /**
     * Add a relationship to evergreen
     */
    async addRelationship(relationship) {
        if (!this.memory)
            await this.initialize();
        if (!this.memory)
            throw new Error("Failed to initialize evergreen memory");
        const existingIds = this.memory.categories.relationships.map((r) => r.id);
        const id = this.generateId("rel", existingIds);
        this.memory.categories.relationships.push({ ...relationship, id });
        await this.save();
        return id;
    }
    /**
     * Get all evergreen memory
     */
    getMemory() {
        return this.memory;
    }
    /**
     * Search evergreen by category and query
     */
    search(category, query) {
        if (!this.memory)
            return [];
        let items = [];
        if (category) {
            items = this.memory.categories[category] || [];
        }
        else {
            // Search all categories
            items = [
                ...this.memory.categories.dates,
                ...this.memory.categories.instructions,
                ...this.memory.categories.preferences,
                ...this.memory.categories.technicalFacts,
                ...this.memory.categories.relationships,
            ];
        }
        if (!query)
            return items;
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
    async removeById(id) {
        if (!this.memory)
            await this.initialize();
        if (!this.memory)
            return false;
        let found = false;
        for (const category of Object.keys(this.memory.categories)) {
            const items = this.memory.categories[category];
            const index = items.findIndex((item) => item.id === id);
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
