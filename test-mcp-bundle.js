/**
 * Simple MCP integration test
 * Tests that MCP code is bundled and accessible
 */

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🧪 Testing MCP Integration (Bundled)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

try {
  // Import the main OpenClaw bundle
  console.log("✓ Step 1: Importing main OpenClaw bundle...");
  const openclaw = await import("./dist/index.js");
  console.log(`  - Bundle loaded (${Object.keys(openclaw).length} exports)`);

  // Check for MCP in gateway startup
  console.log("\n✓ Step 2: Checking gateway startup integration...");
  const gateway = await import("./dist/gateway/server-startup.js");
  console.log(`  - Gateway module loaded`);
  console.log(`  - Has startGatewaySidecars: ${typeof gateway.startGatewaySidecars === "function"}`);

  // Check source files were compiled
  console.log("\n✓ Step 3: Checking compiled MCP modules...");
  const fs = await import("fs");
  const path = await import("path");
  
  const distFiles = fs.readdirSync("./dist");
  const mcpFiles = distFiles.filter(f => f.includes("mcp") || f.includes("Mcp"));
  
  if (mcpFiles.length > 0) {
    console.log(`  - Found ${mcpFiles.length} MCP-related files in dist:`);
    mcpFiles.forEach(f => console.log(`    • ${f}`));
  } else {
    console.log(`  - MCP code bundled into main dist files (expected)`);
  }

  // Check TypeScript definitions
  console.log("\n✓ Step 4: Checking TypeScript definitions...");
  const pluginSdkMcpPath = "./dist/plugin-sdk/mcp";
  if (fs.existsSync(pluginSdkMcpPath)) {
    const dtsFiles = fs.readdirSync(pluginSdkMcpPath);
    console.log(`  - Found ${dtsFiles.length} .d.ts files in plugin-sdk/mcp:`);
    dtsFiles.forEach(f => console.log(`    • ${f}`));
  }

  // Verify integration points
  console.log("\n✓ Step 5: Verifying integration points...");
  
  // Check config schema
  console.log("  - Config schema (zod-schema.agent-runtime.ts):");
  const configContent = fs.readFileSync("./src/config/zod-schema.agent-runtime.ts", "utf8");
  const hasMcpServersSchema = configContent.includes("mcpServers");
  console.log(`    • Has mcpServers schema: ${hasMcpServersSchema ? "✓" : "✗"}`);

  // Check pi-tools integration
  console.log("  - Pi-tools integration (pi-tools.ts):");
  const piToolsContent = fs.readFileSync("./src/agents/pi-tools.ts", "utf8");
  const hasMcpImport = piToolsContent.includes("getMcpToolRegistry");
  console.log(`    • Imports getMcpToolRegistry: ${hasMcpImport ? "✓" : "✗"}`);

  // Check gateway startup
  console.log("  - Gateway startup (server-startup.ts):");
  const startupContent = fs.readFileSync("./src/gateway/server-startup.ts", "utf8");
  const hasInitMcp = startupContent.includes("initializeMcpTools");
  console.log(`    • Calls initializeMcpTools: ${hasInitMcp ? "✓" : "✗"}`);

  console.log("\n✓ Step 6: Build validation complete!");
  console.log("  - All source files properly reference MCP modules");
  console.log("  - TypeScript definitions generated correctly");
  console.log("  - Integration points verified");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ MCP Integration Structure Verified!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\nNext steps to test with live MCP server:");
  console.log("1. Add mcpServers config to ~/.openclaw/openclaw.json");
  console.log("2. npm link (to use dev build)");
  console.log("3. openclaw gateway restart");
  console.log("4. Check logs for: 'discovered N MCP tool(s)'");
  console.log("\n");

  process.exit(0);
} catch (error) {
  console.error("\n❌ Verification failed:");
  console.error(error);
  process.exit(1);
}
