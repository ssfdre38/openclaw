/**
 * Model Context Protocol (MCP) Integration for OpenClaw
 * 
 * This module enables OpenClaw to connect to MCP servers and use their tools.
 * 
 * Architecture:
 * - client-manager.ts: Manages MCP server connections (stdio/http/sse)
 * - tool-discovery.ts: Discovers tools from MCP servers
 * - tool-adapter.ts: Converts MCP tools to OpenClaw ToolDefinitions
 * - tool-registry.ts: Central registry for all MCP tools
 * 
 * Usage:
 * 1. Configure MCP servers in openclaw.json:
 *    ```json
 *    {
 *      "tools": {
 *        "mcpServers": {
 *          "github": {
 *            "transport": "stdio",
 *            "command": "npx",
 *            "args": ["-y", "@modelcontextprotocol/server-github"],
 *            "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "..." }
 *          }
 *        }
 *      }
 *    }
 *    ```
 * 
 * 2. Initialize MCP during gateway startup:
 *    ```ts
 *    import { getMcpClientManager, initializeMcpTools } from "./mcp/index.js";
 *    
 *    // Start MCP servers
 *    await getMcpClientManager().initialize(config.tools.mcpServers);
 *    
 *    // Discover and register tools
 *    const mcpTools = await initializeMcpTools();
 *    ```
 * 
 * 3. MCP tools are automatically prefixed: mcp-{server}-{tool}
 *    Example: mcp-github-get_file_contents
 */

export { McpClientManager, getMcpClientManager, type McpClient } from "./client-manager.js";
export { discoverAllTools, discoverToolsFromServer, getAllMcpTools, findMcpTool, type McpToolInfo } from "./tool-discovery.js";
export { createToolDefinitionFromMcp, createToolDefinitionsFromMcp } from "./tool-adapter.js";
export { McpToolRegistry, getMcpToolRegistry, initializeMcpTools } from "./tool-registry.js";
