/**
 * Minimal test to verify MCP integration works
 * 
 * Tests:
 * 1. Client manager can initialize
 * 2. Tool discovery works
 * 3. Tool definitions are created
 */

import { getMcpClientManager, initializeMcpTools } from "./dist/mcp/index.js";

const testConfig = {
  "github-test": {
    transport: "stdio",
    enabled: true,
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_test_placeholder_not_real",
    },
    timeoutSeconds: 30,
  },
};

async function testMcpIntegration() {
  console.log("🧪 Testing MCP Integration\n");

  try {
    // Test 1: Initialize client manager
    console.log("1️⃣  Testing client manager initialization...");
    const manager = getMcpClientManager();
    await manager.initialize(testConfig);
    console.log("✅ Client manager initialized\n");

    // Test 2: Check connection status
    console.log("2️⃣  Checking connection status...");
    const connected = manager.isConnected("github-test");
    console.log(`   Connected: ${connected}`);
    
    const clientInfo = manager.getClientInfo("github-test");
    console.log(`   Uptime: ${clientInfo?.startedAt ? Date.now() - clientInfo.startedAt.getTime() : 0}ms\n`);

    // Test 3: Discover tools
    console.log("3️⃣  Discovering tools...");
    const tools = await initializeMcpTools();
    console.log(`✅ Discovered ${tools.length} tools\n`);

    // Test 4: List tool names
    console.log("4️⃣  Tool names:");
    for (const tool of tools.slice(0, 10)) {
      console.log(`   • ${tool.name}: ${tool.description || "(no description)"}`);
    }
    if (tools.length > 10) {
      console.log(`   ... and ${tools.length - 10} more`);
    }
    console.log();

    // Test 5: Health check
    console.log("5️⃣  Health check:");
    const health = await manager.healthCheck();
    for (const [name, status] of Object.entries(health)) {
      console.log(`   ${name}: connected=${status.connected}, uptime=${status.uptime}ms`);
    }
    console.log();

    // Cleanup
    console.log("🧹 Shutting down...");
    await manager.shutdown();
    console.log("✅ Shutdown complete\n");

    console.log("🎉 All tests passed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testMcpIntegration();
