import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { McpToolInfo } from "./tool-discovery.js";
import { getMcpClientManager } from "./client-manager.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const logger = createSubsystemLogger("mcp:adapter");

/**
 * Convert MCP tool schema to OpenClaw ToolDefinition format
 * 
 * MCP tools use JSON Schema for parameters.
 * OpenClaw tools use a simpler execute(name, args, signal, callback, context) format.
 * 
 * We create a ToolDefinition that:
 * 1. Has the correct name (mcp-{server}-{tool})
 * 2. Forwards calls to the MCP server
 * 3. Handles response conversion
 */
export function createToolDefinitionFromMcp(mcpTool: McpToolInfo): ToolDefinition {
  return {
    name: mcpTool.fullName,
    description: mcpTool.description || `MCP tool: ${mcpTool.originalName}`,
    
    // Convert JSON Schema to a simple parameters object
    // OpenClaw doesn't validate against schemas (LLM does), so we just need the shape
    parameters: convertJsonSchemaToParameters(mcpTool.inputSchema),

    execute: async (name, args, signal, callback, context) => {
      const manager = getMcpClientManager();
      const client = manager.getClient(mcpTool.serverName);

      if (!client) {
        throw new Error(`MCP server ${mcpTool.serverName} is not connected`);
      }

      try {
        logger.debug(`Calling MCP tool: ${mcpTool.fullName} with args:`, args);

        // Call the MCP server's tool
        const response = await client.callTool({
          name: mcpTool.originalName,
          arguments: args as Record<string, unknown>,
        });

        logger.debug(`MCP tool ${mcpTool.fullName} response:`, response);

        // MCP returns { content: Array<{ type: "text"|"image"|"resource", text?: string, data?: string }> }
        // Convert to OpenClaw result format
        if (response.content && Array.isArray(response.content)) {
          const textParts: string[] = [];
          const otherContent: unknown[] = [];

          for (const item of response.content) {
            if (item.type === "text" && "text" in item) {
              textParts.push(String(item.text));
            } else {
              otherContent.push(item);
            }
          }

          // If we have text, return that
          if (textParts.length > 0) {
            const text = textParts.join("\n\n");
            
            // If there's other content too, include it in metadata
            if (otherContent.length > 0) {
              return {
                type: "text" as const,
                text,
                metadata: { additionalContent: otherContent },
              };
            }
            
            return {
              type: "text" as const,
              text,
            };
          }

          // No text content, return the raw content array
          return {
            type: "text" as const,
            text: JSON.stringify(response.content, null, 2),
          };
        }

        // Unexpected response format
        return {
          type: "text" as const,
          text: JSON.stringify(response, null, 2),
        };
      } catch (error) {
        logger.error(`MCP tool ${mcpTool.fullName} failed:`, error);
        throw error;
      }
    },
  };
}

/**
 * Convert JSON Schema to OpenClaw parameters format
 * 
 * This is a simplified conversion - we just need parameter names and types.
 * The LLM will handle the actual schema validation via the tool description.
 */
function convertJsonSchemaToParameters(inputSchema: Record<string, unknown>): Record<string, unknown> {
  // JSON Schema format: { type: "object", properties: {...}, required: [...] }
  if (inputSchema.type === "object" && inputSchema.properties) {
    const properties = inputSchema.properties as Record<string, unknown>;
    const required = (inputSchema.required as string[]) || [];

    // Convert to simple param map: { paramName: { type: "string"|"number"|etc, required: boolean } }
    const params: Record<string, unknown> = {};

    for (const [name, schema] of Object.entries(properties)) {
      const s = schema as Record<string, unknown>;
      params[name] = {
        type: s.type || "string",
        required: required.includes(name),
        description: s.description || undefined,
      };
    }

    return params;
  }

  // If not an object schema, just return it as-is
  return inputSchema;
}

/**
 * Create ToolDefinitions for all discovered MCP tools
 */
export function createToolDefinitionsFromMcp(tools: McpToolInfo[]): ToolDefinition[] {
  return tools.map((tool) => createToolDefinitionFromMcp(tool));
}
