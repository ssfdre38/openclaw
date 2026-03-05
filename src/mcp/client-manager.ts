import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpServerConfig } from "../config/types.tools.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const logger = createSubsystemLogger("mcp");

export interface McpClient {
  name: string;
  config: McpServerConfig;
  client: Client;
  transport: StdioClientTransport;
  connected: boolean;
  lastError?: Error;
  startedAt?: Date;
}

export class McpClientManager {
  private clients = new Map<string, McpClient>();
  private shuttingDown = false;

  async initialize(servers: Record<string, McpServerConfig>): Promise<void> {
    logger.info(`Initializing MCP client manager with ${Object.keys(servers).length} servers`);

    for (const [name, config] of Object.entries(servers)) {
      if (config.enabled === false) {
        logger.info(`Skipping disabled MCP server: ${name}`);
        continue;
      }

      try {
        await this.startServer(name, config);
      } catch (error) {
        logger.error(`Failed to start MCP server ${name}: ${String(error)}`);
      }
    }
  }

  async startServer(name: string, config: McpServerConfig): Promise<void> {
    if (this.clients.has(name)) {
      logger.warn(`MCP server ${name} is already running`);
      return;
    }

    logger.info(`Starting MCP server: ${name} (transport: ${config.transport})`);

    try {
      const client = await this.createClient(name, config);
      this.clients.set(name, client);
      logger.info(`MCP server ${name} started successfully`);
    } catch (error) {
      logger.error(`Failed to start MCP server ${name}: ${String(error)}`);
      throw error;
    }
  }

  private async createClient(name: string, config: McpServerConfig): Promise<McpClient> {
    if (config.transport === "stdio") {
      return this.createStdioClient(name, config);
    } else if (config.transport === "http" || config.transport === "sse") {
      throw new Error(`Transport ${config.transport} not yet implemented`);
    } else {
      throw new Error(`Unknown transport: ${config.transport}`);
    }
  }

  private async createStdioClient(name: string, config: McpServerConfig): Promise<McpClient> {
    if (!config.command) {
      throw new Error(`stdio transport requires a command`);
    }

    const args = config.args ?? [];
    const env: Record<string, string> = {};
    
    // Build env with only defined values
    for (const [key, value] of Object.entries({ ...process.env, ...config.env })) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    logger.debug(`Starting MCP server ${name}: ${config.command} ${args.join(" ")}`);

    // StdioClientTransport spawns the process internally
    const transport = new StdioClientTransport({
      command: config.command,
      args,
      env,
      stderr: "pipe", // Capture stderr
    });

    const client = new Client(
      {
        name: `openclaw-${name}`,
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    // Connect to the MCP server
    await client.connect(transport);

    logger.info(`MCP server ${name} connected via stdio`);

    return {
      name,
      config,
      client,
      transport,
      connected: true,
      startedAt: new Date(),
    };
  }

  async stopServer(name: string): Promise<void> {
    const mcpClient = this.clients.get(name);
    if (!mcpClient) {
      logger.warn(`MCP server ${name} is not running`);
      return;
    }

    logger.info(`Stopping MCP server: ${name}`);

    try {
      // Close client connection (this will also cleanup the spawned process)
      await mcpClient.client.close();

      mcpClient.connected = false;
      this.clients.delete(name);

      logger.info(`MCP server ${name} stopped successfully`);
    } catch (error) {
      logger.error(`Error stopping MCP server ${name}: ${String(error)}`);
      throw error;
    }
  }

  async restartServer(name: string): Promise<void> {
    const mcpClient = this.clients.get(name);
    if (!mcpClient) {
      throw new Error(`MCP server ${name} is not running`);
    }

    const config = mcpClient.config;
    await this.stopServer(name);
    await this.startServer(name, config);
  }

  getClient(name: string): Client | undefined {
    return this.clients.get(name)?.client;
  }

  getClientInfo(name: string): McpClient | undefined {
    return this.clients.get(name);
  }

  getAllClients(): Map<string, McpClient> {
    return new Map(this.clients);
  }

  isConnected(name: string): boolean {
    return this.clients.get(name)?.connected ?? false;
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    logger.info(`Shutting down MCP client manager (${this.clients.size} servers)`);

    const shutdownPromises = Array.from(this.clients.keys()).map((name) => this.stopServer(name));

    await Promise.allSettled(shutdownPromises);
    this.clients.clear();

    logger.info("MCP client manager shutdown complete");
  }

  async healthCheck(): Promise<Record<string, { connected: boolean; uptime?: number; error?: string }>> {
    const health: Record<string, { connected: boolean; uptime?: number; error?: string }> = {};

    for (const [name, mcpClient] of this.clients.entries()) {
      health[name] = {
        connected: mcpClient.connected,
        uptime: mcpClient.startedAt ? Date.now() - mcpClient.startedAt.getTime() : undefined,
        error: mcpClient.lastError?.message,
      };
    }

    return health;
  }
}

// Singleton instance
let instance: McpClientManager | undefined;

export function getMcpClientManager(): McpClientManager {
  if (!instance) {
    instance = new McpClientManager();
  }
  return instance;
}
