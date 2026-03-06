import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { registerMemorySearchTools } from "./search-tools.js";
import { registerMemoryLoader } from "./memory-loader.js";
import { registerArchiveTool } from "./archive-tool.js";

const memoryCorePlugin = {
  id: "memory-core",
  name: "Memory (Core)",
  description: "File-backed memory search tools and CLI with 3-tier system (dailies, archived, evergreen)",
  kind: "memory",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    // NOTE: Old markdown-based memory tools (memory_search, memory_get) are DISABLED
    // We're using the new 3-tier JSON system instead (memory_search_tiers, memory_get_daily, etc.)
    // The old tools expected .md files in memory/ directory, but we use .json files now

    // Register 3-tier memory search tools
    registerMemorySearchTools(api);
    
    // Register memory auto-loader (session:start hook)
    registerMemoryLoader(api);
    
    // Register manual archive tool
    registerArchiveTool(api);

    api.registerCli(
      ({ program }) => {
        api.runtime.tools.registerMemoryCli(program);
      },
      { commands: ["memory"] },
    );
  },
};

export default memoryCorePlugin;
