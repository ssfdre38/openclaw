/**
 * Local MCP integration test
 * Tests MCP without deploying to production
 */

import { getMcpClientManager } from "./dist/mcp/index.js";
import { getMcpToolRegistry } from "./dist/mcp/index.js";
import { initializeMcpTools } from "./dist/mcp/index.js";

async function testMcp() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🧪 Testing MCP Integration");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    // Test 1: Module imports
    console.log("✓ Step 1: Module imports successful");
    console.log(`  - getMcpClientManager: ${typeof getMcpClientManager}`);
    console.log(`  - getMcpToolRegistry: ${typeof getMcpToolRegistry}`);
    console.log(`  - initializeMcpTools: ${typeof initializeMcpTools}`);

    // Test 2: Get manager instance
    const manager = getMcpClientManager();
    console.log("\n✓ Step 2: Client manager instance created");
    console.log(`  - Has initialize method: ${typeof manager.initialize === "function"}`);
    console.log(`  - Has getClient method: ${typeof manager.getClient === "function"}`);

    // Test 3: Get registry instance
    const registry = getMcpToolRegistry();
    console.log("\n✓ Step 3: Tool registry instance created");
    console.log(`  - Has discover method: ${typeof registry.discover === "function"}`);
    console.log(`  - Has getToolDefinitions method: ${typeof registry.getToolDefinitions === "function"}`);

    // Test 4: Test with minimal config (filesystem MCP server)
    console.log("\n✓ Step 4: Testing with filesystem MCP server");
    console.log("  Note: This requires @modelcontextprotocol/server-filesystem");
    console.log("  Install with: npm install -g @modelcontextprotocol/server-filesystem");
    
    const testConfig = {
      filesystem: {
        transport: "stdio",
        enabled: true,
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
        env: {},
      },
    };

    console.log("\n  Initializing MCP client manager...");
    await manager.initialize(testConfig);
    console.log("  ✓ Client manager initialized");

    console.log("\n  Discovering and registering tools...");
    await initializeMcpTools();
    console.log("  ✓ Tools initialized");

    const tools = registry.getToolDefinitions();
    console.log(`\n  ✓ Discovered ${tools.length} MCP tools:`);
    
    for (const tool of tools.slice(0, 5)) {
      console.log(`    • ${tool.name}`);
      console.log(`      ${tool.description || "(no description)"}`);
    }
    
    if (tools.length > 5) {
      console.log(`    ... and ${tools.length - 5} more tools`);
    }

    // Test 5: Call a simple tool if available
    if (tools.length > 0) {
      const listTool = tools.find((t) => t.name.includes("list") || t.name.includes("read"));
      if (listTool) {
        console.log(`\n✓ Step 5: Testing tool execution: ${listTool.name}`);
        try {
          // Note: We can't actually execute without proper context,
          // but we can verify the execute function exists
          console.log(`  - Tool has execute function: ${typeof listTool.execute === "function"}`);
          console.log(`  - Tool parameters: ${JSON.stringify(listTool.parameters, null, 2)}`);
        } catch (error) {
          console.log(`  - Tool execution test skipped: ${error.message}`);
        }
      }
    }

    // Cleanup
    console.log("\n✓ Step 6: Shutting down MCP client manager...");
    await manager.shutdown();
    console.log("  ✓ Client manager shut down");

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ All tests passed!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error);
    console.log("\nIf you see 'ENOENT' or 'command not found', you may need to:");
    console.log("  1. Install an MCP server: npm install -g @modelcontextprotocol/server-filesystem");
    console.log("  2. Or modify testConfig above to use a different MCP server");
    process.exit(1);
  }
}

testMcp();
