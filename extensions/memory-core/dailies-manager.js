import * as fs from "node:fs/promises";
import * as path from "node:path";
export class DailiesManager {
    memoryPath;
    dailiesPath;
    archivedPath;
    indexPath;
    index = null;
    constructor(memoryPath) {
        this.memoryPath = memoryPath;
        this.dailiesPath = path.join(memoryPath, "dailies");
        this.archivedPath = path.join(memoryPath, "archived");
        this.indexPath = path.join(memoryPath, "index.json");
    }
    /**
     * Initialize the dailies manager (load index)
     */
    async initialize() {
        // Create directories if they don't exist
        await fs.mkdir(this.dailiesPath, { recursive: true });
        await fs.mkdir(this.archivedPath, { recursive: true });
        // Load or create index
        try {
            const indexData = await fs.readFile(this.indexPath, "utf-8");
            this.index = JSON.parse(indexData);
        }
        catch (error) {
            // Index doesn't exist, create new one
            this.index = {
                lastUpdated: new Date().toISOString(),
                dailies: {
                    files: [],
                    currentlyLoaded: [],
                },
                archived: {
                    files: [],
                },
                topicIndex: {},
            };
            await this.saveIndex();
        }
    }
    /**
     * Save the index to disk
     */
    async saveIndex() {
        if (!this.index)
            return;
        this.index.lastUpdated = new Date().toISOString();
        // Ensure directory exists
        const dir = path.dirname(this.indexPath);
        if (!await fs.access(dir).then(() => true).catch(() => false)) {
            await fs.mkdir(dir, { recursive: true });
        }
        await fs.writeFile(this.indexPath, JSON.stringify(this.index, null, 2), "utf-8");
    }
    /**
     * Get the file path for a daily memory
     */
    getDailyPath(date) {
        return path.join(this.dailiesPath, `${date}.json`);
    }
    /**
     * Get the file path for an archived memory
     */
    getArchivedPath(date) {
        return path.join(this.archivedPath, `${date}.json`);
    }
    /**
     * Generate a unique highlight ID
     */
    generateHighlightId(date, existingIds) {
        const prefix = `hl-${date}-`;
        let counter = 1;
        let id = `${prefix}${String(counter).padStart(3, "0")}`;
        while (existingIds.includes(id)) {
            counter++;
            id = `${prefix}${String(counter).padStart(3, "0")}`;
        }
        return id;
    }
    /**
     * Write a daily memory file
     */
    async writeDailyMemory(memory) {
        const filePath = this.getDailyPath(memory.date);
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!await fs.access(dir).then(() => true).catch(() => false)) {
            await fs.mkdir(dir, { recursive: true });
        }
        await fs.writeFile(filePath, JSON.stringify(memory, null, 2), "utf-8");
        // Update index
        if (!this.index)
            await this.initialize();
        if (!this.index)
            return;
        // Check if already in index
        const existing = this.index.dailies.files.find((f) => f.date === memory.date);
        if (existing) {
            existing.topics = memory.stats.topicsDiscussed;
        }
        else {
            this.index.dailies.files.push({
                date: memory.date,
                path: `dailies/${memory.date}.json`,
                topics: memory.stats.topicsDiscussed,
            });
        }
        // Update topic index
        for (const topic of memory.stats.topicsDiscussed) {
            if (!this.index.topicIndex[topic]) {
                this.index.topicIndex[topic] = [];
            }
            if (!this.index.topicIndex[topic].includes(memory.date)) {
                this.index.topicIndex[topic].push(memory.date);
            }
        }
        await this.saveIndex();
    }
    /**
     * Read a daily memory file
     */
    async readDailyMemory(date) {
        const filePath = this.getDailyPath(date);
        try {
            const data = await fs.readFile(filePath, "utf-8");
            return JSON.parse(data);
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Append highlights to an existing daily memory (or create new)
     */
    async appendHighlights(date, sessionId, newHighlights) {
        let memory = await this.readDailyMemory(date);
        if (!memory) {
            // Create new daily memory
            memory = {
                date,
                tier: "daily",
                sessionIds: [sessionId],
                highlights: [],
                stats: {
                    messageCount: 0,
                    topicsDiscussed: [],
                    evergreenCandidates: 0,
                },
            };
        }
        else if (!memory.sessionIds.includes(sessionId)) {
            memory.sessionIds.push(sessionId);
        }
        // Generate IDs for new highlights
        const existingIds = memory.highlights.map((h) => h.id);
        const highlightsWithIds = newHighlights.map((h) => ({
            ...h,
            id: this.generateHighlightId(date, existingIds),
        }));
        // Append highlights
        memory.highlights.push(...highlightsWithIds);
        // Update stats
        const allTopics = new Set();
        let evergreenCount = 0;
        for (const highlight of memory.highlights) {
            for (const topic of highlight.topics) {
                allTopics.add(topic);
            }
            if (highlight.evergreenCandidate) {
                evergreenCount++;
            }
        }
        memory.stats.topicsDiscussed = Array.from(allTopics);
        memory.stats.evergreenCandidates = evergreenCount;
        await this.writeDailyMemory(memory);
    }
    /**
     * Move a daily memory to archived
     */
    async moveDailyToArchived(date) {
        const dailyPath = this.getDailyPath(date);
        const archivedPath = this.getArchivedPath(date);
        // Read the daily memory
        const memory = await this.readDailyMemory(date);
        if (!memory) {
            throw new Error(`Daily memory not found: ${date}`);
        }
        // Write to archived
        await fs.writeFile(archivedPath, JSON.stringify(memory, null, 2), "utf-8");
        // Delete from dailies
        await fs.unlink(dailyPath);
        // Update index
        if (!this.index)
            await this.initialize();
        if (!this.index)
            return;
        // Remove from dailies index
        this.index.dailies.files = this.index.dailies.files.filter((f) => f.date !== date);
        this.index.dailies.currentlyLoaded = this.index.dailies.currentlyLoaded.filter((d) => d !== date);
        // Add to archived index
        this.index.archived.files.push({
            date: memory.date,
            path: `archived/${memory.date}.json`,
            topics: memory.stats.topicsDiscussed,
        });
        await this.saveIndex();
    }
    /**
     * Get dates of dailies that should be loaded (last N days)
     */
    getLoadableDates(daysToLoad) {
        const dates = [];
        const today = new Date();
        for (let i = 0; i < daysToLoad; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().split("T")[0]);
        }
        return dates;
    }
    /**
     * Load recent dailies (last N days)
     */
    async loadRecentDailies(daysToLoad) {
        const dates = this.getLoadableDates(daysToLoad);
        const memories = [];
        for (const date of dates) {
            const memory = await this.readDailyMemory(date);
            if (memory) {
                memories.push(memory);
            }
        }
        // Update currentlyLoaded in index
        if (this.index) {
            this.index.dailies.currentlyLoaded = dates.filter((date) => this.index.dailies.files.some((f) => f.date === date));
            await this.saveIndex();
        }
        return memories;
    }
    /**
     * Get the memory index
     */
    getIndex() {
        return this.index;
    }
    /**
     * Search dailies by topic
     */
    async searchDailiesByTopic(topic) {
        if (!this.index)
            await this.initialize();
        if (!this.index)
            return [];
        const dates = this.index.topicIndex[topic] || [];
        const memories = [];
        for (const date of dates) {
            const memory = await this.readDailyMemory(date);
            if (memory) {
                memories.push(memory);
            }
        }
        return memories;
    }
}
