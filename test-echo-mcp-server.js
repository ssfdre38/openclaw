#!/usr/bin/env node
/**
 * Simple Echo MCP Server for testing
 * Implements a minimal MCP server that responds to listTools and callTool
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Create MCP server
const server = new Server(
  {
    name: "echo-test-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register a simple echo tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "echo",
        description: "Echoes back the input text",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The message to echo back",
            },
          },
          required: ["message"],
        },
      },
      {
        name: "ping",
        description: "Returns 'pong'",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "echo") {
    return {
      content: [
        {
          type: "text",
          text: `Echo: ${request.params.arguments?.message || "(no message)"}`,
        },
      ],
    };
  } else if (request.params.name === "ping") {
    return {
      content: [
        {
          type: "text",
          text: "pong",
        },
      ],
    };
  }
  
  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Echo MCP server started");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
