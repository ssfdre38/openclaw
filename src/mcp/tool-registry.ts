import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { getMcpClientManager } from "./client-manager.js";
import { discoverAllTools, type McpToolInfo } from "./tool-discovery.js";
import { createToolDefinitionsFromMcp } from "./tool-adapter.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const logger = createSubsystemLogger("mcp:registry");

/**
 * MCP Tool Registry
 * 
 * Manages the lifecycle of MCP tools:
 * - Discovery from MCP servers
 * - Conversion to OpenClaw ToolDefinitions
 * - Registration with the tool system
 * - Cache management
 */
export class McpToolRegistry {
  private toolsByServer = new Map<string, McpToolInfo[]>();
  private toolDefinitions: ToolDefinition[] = [];
  private lastDiscoveryTime: Date | null = null;

  /**
   * Discover and register all MCP tools
   */
  async discover(): Promise<ToolDefinition[]> {
    logger.info("Starting MCP tool discovery");

    try {
      // Discover tools from all connected MCP servers
      this.toolsByServer = await discoverAllTools();

      // Flatten to a single list
      const allTools: McpToolInfo[] = [];
      for (const tools of this.toolsByServer.values()) {
        allTools.push(...tools);
      }

      logger.info(`Discovered ${allTools.length} MCP tools total`);

      // Convert to ToolDefinitions
      this.toolDefinitions = createToolDefinitionsFromMcp(allTools);
      this.lastDiscoveryTime = new Date();

      logger.info(`Created ${this.toolDefinitions.length} MCP tool definitions`);

      return this.toolDefinitions;
    } catch (error) {
      logger.error("MCP tool discovery failed:", error);
      throw error;
    }
  }

  /**
   * Get all registered MCP tool definitions
   */
  getToolDefinitions(): ToolDefinition[] {
    return this.toolDefinitions;
  }

  /**
   * Get tools for a specific server
   */
  getToolsForServer(serverName: string): McpToolInfo[] {
    return this.toolsByServer.get(serverName) || [];
  }

  /**
   * Find a tool by its full name (mcp-{server}-{tool})
   */
  findTool(fullName: string): McpToolInfo | undefined {
    for (const tools of this.toolsByServer.values()) {
      const tool = tools.find((t) => t.fullName === fullName);
      if (tool) {
        return tool;
      }
    }
    return undefined;
  }

  /**
   * Check if a tool name is an MCP tool
   */
  isMcpTool(toolName: string): boolean {
    return toolName.startsWith("mcp-");
  }

  /**
   * Get discovery statistics
   */
  getStats(): {
    serverCount: number;
    toolCount: number;
    lastDiscovery: Date | null;
  } {
    return {
      serverCount: this.toolsByServer.size,
      toolCount: this.toolDefinitions.length,
      lastDiscovery: this.lastDiscoveryTime,
    };
  }

  /**
   * Rediscover tools (e.g., after config change)
   */
  async rediscover(): Promise<ToolDefinition[]> {
    logger.info("Rediscovering MCP tools");
    this.clear();
    return this.discover();
  }

  /**
   * Clear all cached tool data
   */
  clear(): void {
    this.toolsByServer.clear();
    this.toolDefinitions = [];
    this.lastDiscoveryTime = null;
  }

  /**
   * Shutdown - clear registry and disconnect clients
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down MCP tool registry");
    this.clear();
    const manager = getMcpClientManager();
    await manager.shutdown();
  }
}

// Singleton instance
let instance: McpToolRegistry | undefined;

export function getMcpToolRegistry(): McpToolRegistry {
  if (!instance) {
    instance = new McpToolRegistry();
  }
  return instance;
}

/**
 * Initialize MCP tool registry and discover tools
 * 
 * This should be called during gateway startup, after MCP clients are connected.
 */
export async function initializeMcpTools(): Promise<ToolDefinition[]> {
  const registry = getMcpToolRegistry();
  return registry.discover();
}
