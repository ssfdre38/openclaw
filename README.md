# OpenClaw CE MCP Servers

Custom Model Context Protocol (MCP) servers built for OpenClaw Community Edition. These servers extend OpenClaw's capabilities by providing specialized integrations with external platforms and services.

## Available Servers

### 💬 Discord MCP Server
Discord integration for emoji, sticker discovery, and text art.

**Features:**
- 🎨 List custom emojis with usage syntax
- 🎭 List custom and default stickers
- 🔍 Search emojis and stickers by keyword
- ⚡ Slash command text art (/fliptable, /shrug, /lenny)
- 🎭 15 ASCII art pieces (animals, symbols, objects)
- 🔒 Privacy-safe (no message reading/logging)

**Note:** Some tools (reply, reactions, edit, threads) currently non-functional with OpenClaw due to [precision loss bug](https://github.com/ssfdre38/openclaw-community-edition/blob/discord-fix/docs/PRECISION-LOSS-WORKAROUND.md). Works correctly with other MCP clients.

**[Full Documentation](./discord/README.md)**

## Installation

The Discord MCP server is standalone and can be installed separately:

```bash
# Navigate to the MCP server directory
cd mcp-servers/discord

# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Configuration

Add the Discord MCP server to your OpenClaw CE `openclaw.json`:

```json
{
  "tools": {
    "mcpServers": {
      "discord": {
        "transport": "stdio",
        "enabled": true,
        "command": "node",
        "args": ["/path/to/openclaw/mcp-servers/discord/dist/index.js"],
        "env": {
          "DISCORD_BOT_TOKEN": "your_discord_bot_token",
          "DISCORD_DEFAULT_GUILD_ID": "your_guild_id"
        }
      }
    }
  }
}
```

**Windows paths:**
```json
{
  "tools": {
    "mcpServers": {
      "discord": {
        "transport": "stdio",
        "command": "node",
        "args": ["E:\\openclaw\\mcp-servers\\discord\\dist\\index.js"],
        "env": {
          "DISCORD_BOT_TOKEN": "MTQ3NjcxMjc4...",
          "DISCORD_DEFAULT_GUILD_ID": "119510237819568131"
        }
      }
    }
  }
}
```

## Environment Variables

### Discord MCP Server
- `DISCORD_BOT_TOKEN` - Bot token from Discord Developer Portal
  - Create bot at: https://discord.com/developers/applications
  - Enable intents: Guilds, Guild Messages, Message Content
- `DISCORD_DEFAULT_GUILD_ID` - Default Discord server (guild) ID for emoji/sticker discovery

## Usage

Once configured, OpenClaw can automatically use these tools:

```
User: "What custom emojis are available in this Discord server?"
OpenClaw: [uses discord:list_emojis tool]

User: "Search for party emojis"
OpenClaw: [uses discord:search_emoji tool]

User: "Show me a shrug text art"
OpenClaw: [uses discord:textart tool with shrug]
```

## Architecture

The Discord MCP server:
- Runs as a separate Node.js process
- Communicates with OpenClaw via stdio (standard input/output)
- Uses the `@modelcontextprotocol/sdk` for protocol compliance
- Connects to Discord via `discord.js`
- Operates independently (no shared state with gateway)

## Development

### Project Structure
```
mcp-servers/discord/
├── src/
│   └── index.ts          # Main server implementation
├── dist/                 # Compiled JavaScript (built)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # Full documentation
```

### Building
```bash
cd mcp-servers/discord
npm install
npm run build      # Compiles TypeScript to dist/
```

### Testing
```bash
# Test with MCP Inspector (if installed)
npx @modelcontextprotocol/inspector node dist/index.js
```

## Security Considerations

- **Never commit tokens/secrets** - Use environment variables only
- **Bot permissions** - Only request `Guilds` and `Guild Messages` intents
- **Privacy** - This server does not read user messages, only provides discovery/expression tools
- **Rate limiting** - Discord.js handles rate limits automatically

## License

MIT License - Same as OpenClaw Community Edition

## Contributing

These MCP servers are maintained by the OpenClaw CE community. Contributions welcome!

1. Add new tools to existing servers
2. Create new MCP servers for other platforms
3. Improve error handling and validation
4. Add tests and examples

## Roadmap

Planned future MCP servers:
- 🐙 **GitHub** - Repository operations, issues, PRs, code search  
  (Can use [@modelcontextprotocol/server-github](https://github.com/modelcontextprotocol/servers) - official MCP server)
- 📁 **Filesystem** - File operations for local development  
  (Can use [@modelcontextprotocol/server-filesystem](https://github.com/modelcontextprotocol/servers) - official)
- 📧 **Email** - SMTP/IMAP integration
- 📝 **Notion** - Notes and database integration
- 🗄️ **Database** - PostgreSQL, MySQL, SQLite queries
- 🌐 **Web Scraping** - Puppeteer-based browsing
- 📊 **Google Sheets** - Spreadsheet operations
- 🔔 **Slack** - Team messaging integration

## Support

- **Issues**: https://github.com/ssfdre38/openclaw-community-edition/issues
- **Documentation**: https://openclawce.com
- **Discord MCP**: See [discord/README.md](./discord/README.md)

---

**Built with ❤️ by the OpenClaw CE community**
