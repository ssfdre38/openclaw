import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getMcpClientManager } from "./client-manager.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const logger = createSubsystemLogger("mcp:tools");

export interface McpToolInfo {
  /** Full tool name: mcp-{serverName}-{toolName} */
  fullName: string;
  /** Original tool name from MCP server */
  originalName: string;
  /** Server this tool belongs to */
  serverName: string;
  /** Tool description from MCP */
  description?: string;
  /** Input schema from MCP (JSON Schema) */
  inputSchema: Record<string, unknown>;
}

/**
 * Discover tools from a single MCP server
 */
export async function discoverToolsFromServer(
  serverName: string,
  client: Client,
): Promise<McpToolInfo[]> {
  try {
    logger.info(`Discovering tools from MCP server: ${serverName}`);

    // Call listTools() on the MCP server
    const response = await client.listTools();

    if (!response.tools || response.tools.length === 0) {
      logger.warn(`MCP server ${serverName} has no tools`);
      return [];
    }

    logger.info(`Found ${response.tools.length} tools from ${serverName}`);

    // Convert MCP tools to our format
    const mcpTools: McpToolInfo[] = response.tools.map((tool: Tool) => {
      const fullName = `mcp-${serverName}-${tool.name}`;
      return {
        fullName,
        originalName: tool.name,
        serverName,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>,
      };
    });

    return mcpTools;
  } catch (error) {
    logger.error(`Failed to discover tools from ${serverName}:`, error);
    throw error;
  }
}

/**
 * Discover tools from all connected MCP servers
 */
export async function discoverAllTools(): Promise<Map<string, McpToolInfo[]>> {
  const manager = getMcpClientManager();
  const allClients = manager.getAllClients();

  if (allClients.size === 0) {
    logger.warn("No MCP servers connected");
    return new Map();
  }

  logger.info(`Discovering tools from ${allClients.size} MCP servers`);

  const toolsByServer = new Map<string, McpToolInfo[]>();

  for (const [serverName, mcpClient] of allClients.entries()) {
    if (!mcpClient.connected) {
      logger.warn(`Skipping disconnected server: ${serverName}`);
      continue;
    }

    try {
      const tools = await discoverToolsFromServer(serverName, mcpClient.client);
      toolsByServer.set(serverName, tools);

      logger.info(`Discovered ${tools.length} tools from ${serverName}:`);
      for (const tool of tools) {
        logger.debug(`  • ${tool.fullName}: ${tool.description || "(no description)"}`);
      }
    } catch (error) {
      logger.error(`Failed to discover tools from ${serverName}:`, error);
      // Continue with other servers
    }
  }

  const totalTools = Array.from(toolsByServer.values()).reduce((sum, tools) => sum + tools.length, 0);
  logger.info(`Discovery complete: ${totalTools} total tools from ${toolsByServer.size} servers`);

  return toolsByServer;
}

/**
 * Get a flat list of all discovered MCP tools
 */
export async function getAllMcpTools(): Promise<McpToolInfo[]> {
  const toolsByServer = await discoverAllTools();
  const allTools: McpToolInfo[] = [];

  for (const tools of toolsByServer.values()) {
    allTools.push(...tools);
  }

  return allTools;
}

/**
 * Find an MCP tool by its full name
 */
export function findMcpTool(fullName: string, toolsByServer: Map<string, McpToolInfo[]>): McpToolInfo | undefined {
  for (const tools of toolsByServer.values()) {
    const tool = tools.find((t) => t.fullName === fullName);
    if (tool) {
      return tool;
    }
  }
  return undefined;
}
