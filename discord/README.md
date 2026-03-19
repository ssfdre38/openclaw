# Discord MCP Server 🦞

Model Context Protocol server for Discord - provides emoji, sticker, and messaging tools for AI agents.

## Features

- 💬 **Send Messages** - Send text messages with user/role/channel mentions
- 👥 **Search Users** - Find user IDs by username for mentions
- 📋 **List Channel Members** - See who has access to a channel
- 🎨 **List Custom Emojis** - Discover all custom emojis in a server with usage syntax
- 🎭 **List Custom Stickers** - Browse server-specific stickers with IDs and format info
- 🦞 **List Default Stickers** - See Discord's official sticker packs (Clyde, Wumpus, etc.) with IDs
- 🔍 **Search Emojis** - Find custom emojis by keyword
- 🔎 **Search Stickers** - Find ANY sticker (custom or default) by keyword with IDs
- ⚡ **Slash Commands** - Text art commands (/fliptable, /shrug, /lenny, etc.)
- 🎭 **ASCII Art** - 15 ASCII art pieces (animals, symbols, objects)
- 🤖 **AI-Ready** - Works with any MCP-compatible client (Claude, OpenClaw, etc.)
- 🔒 **Privacy-Safe** - No message reading/logging, only expressive tools

### ⚠️ Known Limitations (OpenClaw)

The following tools are **currently not functional with OpenClaw** due to a precision loss bug in OpenClaw's function call handler:
- 💬 ~~Reply to Messages~~ - Requires fixing OpenClaw's parameter type handling
- 👍 ~~Reactions~~ - Requires fixing OpenClaw's parameter type handling  
- ✏️ ~~Edit Messages~~ - Requires fixing OpenClaw's parameter type handling
- 🧵 ~~Thread Creation~~ - Requires fixing OpenClaw's parameter type handling

**Issue:** OpenClaw converts string parameters that look like numbers into JavaScript numbers, causing precision loss for Discord snowflake IDs (which exceed JavaScript's safe integer limit). The tools work correctly with other MCP clients that respect schema types.

**Tracking:** This needs to be fixed in OpenClaw's tool/function call parameter handler to preserve string types as defined in the schema.

## Installation

### Local Development
```bash
cd mcp-server-discord
npm install
npm run build
```

### Use in OpenClaw

Add to your `openclaw.json`:

```json
{
  "tools": {
    "mcpServers": {
      "discord": {
        "transport": "stdio",
        "enabled": true,
        "command": "node",
        "args": ["C:\\Users\\admin\\source\\mcp-server-discord\\dist\\index.js"],
        "env": {
          "DISCORD_BOT_TOKEN": "your-bot-token-here",
          "DISCORD_DEFAULT_GUILD_ID": "your-guild-id-here"
        }
      }
    }
  }
}
```

Or use via npx (after publishing):
```json
{
  "tools": {
    "mcpServers": {
      "discord": {
        "transport": "stdio",
        "enabled": true,
        "command": "npx",
        "args": ["-y", "@openclaw/mcp-server-discord"],
        "env": {
          "DISCORD_BOT_TOKEN": "your-bot-token-here",
          "DISCORD_DEFAULT_GUILD_ID": "your-guild-id-here"
        }
      }
    }
  }
}
```

## Environment Variables

- **`DISCORD_BOT_TOKEN`** (required) - Your Discord bot token
- **`DISCORD_DEFAULT_GUILD_ID`** (optional) - Default guild/server ID to use
- **`DISCORD_DEFAULT_CHANNEL_ID`** (optional) - Default channel ID for sending messages

## Tools

### Messaging Tools

#### `discord_send_message`
**✨ NEW!** Send a text message to a Discord channel with **automatic username resolution**.

**Key Feature:** Write natural mentions like `<@ssfdre38>` and they auto-convert to user IDs!

**Parameters:**
- `content` (required) - Message content with mention support
  - User mentions: `<@username>` **auto-resolves to ID** (e.g., `<@ssfdre38>` → `<@123456789>`)
  - Direct ID mentions: `<@123456789>` also supported
  - Role mentions: `<@&roleId>` (e.g., `<@&987654321>`)
  - Channel mentions: `<#channelId>` (e.g., `<#555666777>`)
  - Custom emojis: `<:name:id>` (e.g., `<:party:123456>`)
- `channelId` (optional) - Channel ID, uses default if not provided
- `stickerId` (optional) - Attach a sticker (from discord_list_stickers)
- `embed` (optional) - Add an embed with title, description, color

**Examples:**
```javascript
// Natural username mention (auto-resolves)
discord_send_message({
  content: "Hey <@ssfdre38>, check this out!"
})

// Multiple username mentions
discord_send_message({
  content: "<@alice> <@bob> meeting in 5 minutes!"
})

// With embed
discord_send_message({
  content: "<@john> here's the summary:",
  embed: {
    title: "Project Status",
    description: "All tasks complete!",
    color: "#00FF00"
  }
})

// With sticker and emoji
discord_send_message({
  content: "<@team_lead> Great work! <:party_blob:123>",
  stickerId: "987654321"
})
```

**Note:** Username resolution is case-insensitive and automatic. No need to search for IDs first!

#### `discord_search_users`
**Optional tool** for when you need to find user IDs manually (most of the time, just use `<@username>` in discord_send_message).

**Parameters:**
- `query` (required) - Username or display name (case-insensitive, partial match)
- `guildId` (optional) - Guild ID, uses default if not provided

**Example output:**
```
**Found 2 user(s) matching "john":**

- **john_doe** (John D.)
  ID: `123456789012345678`
  Mention: `<@123456789012345678>`
- **johnny**
  ID: `987654321098765432`
  Mention: `<@987654321098765432>`
```

#### `discord_get_channel_members`
**✨ NEW!** List members who can access a specific channel.

**Parameters:**
- `channelId` (optional) - Channel ID, uses default if not provided
- `limit` (optional) - Max members to return (default: 50, max: 100)

**Example output:**
```
**50 member(s) with access to this channel:**

- **alice** (Alice Smith) - Mention: `<@111222333>`
- **bob_dev** (Bob) - Mention: `<@444555666>`
- **charlie** - Mention: `<@777888999>`
```

### Discovery Tools

#### `discord_list_emojis`
Lists all custom emojis in a Discord server.

**Parameters:**
- `guildId` (optional) - Guild ID, uses default if not provided

**Example output:**
```
**Custom Emojis:**

- **party_blob** (animated)
  Usage: `<a:party_blob:123456789>`
- **thumbs_up_cat** (static)
  Usage: `<:thumbs_up_cat:987654321>`
```

### `discord_list_stickers`
Lists all custom stickers in a Discord server.

**Parameters:**
- `guildId` (optional) - Guild ID, uses default if not provided

**Example output:**
```
**Stickers:**

- **happy_cat** (PNG)
  Description: A happy cat face
  ID: 123456789
- **party_time** (APNG)
  Description: Animated party celebration
  ID: 987654321
```

### `discord_list_default_stickers`
Lists Discord's official default sticker packs (Clyde, Wumpus, etc.) **with IDs**.

**Parameters:**
- `pack` (optional) - Filter by pack name (e.g., "Clyde", "Wumpus")

**Example output:**
```
**Discord Default Sticker Packs:**

**Clyde Bot** (23 stickers):
  _The friendly Discord bot with expressions for every mood_

- **Clyde OK**
  ID: `749053689419006003`
  Clyde giving OK
- **Clyde Thinking**
  ID: `749053689343508570`
  Thinking Clyde
- **Clyde Smile**
  ID: `749053689419006004`
  Smiling Clyde
```

### `discord_search_emoji`
Search for custom emojis by keyword.

**Parameters:**
- `keyword` (required) - Search term (case-insensitive)
- `guildId` (optional) - Guild ID, uses default if not provided

**Example:**
```
Search for "party" → Returns all emojis with "party" in the name
```

### `discord_search_sticker`
**NEW!** Search for stickers across both custom server stickers AND Discord's default sticker packs.

**Parameters:**
- `keyword` (required) - Search term (case-insensitive)  
- `guildId` (optional) - Guild ID for custom stickers

**Example output:**
```
**Sticker search results for "thinking":**

**Custom Server Stickers:**
(any custom stickers matching "thinking")

**Default Discord Stickers:**
- **Clyde Thinking** (Clyde Bot)
  Thinking Clyde
  ID: `749053689343508570`
- **Wumpus Thinking** (Wumpus Beyond)
  Thinking Wumpus
  ID: `749044256589160448`
```

**Why this matters:** Every result includes an ID, so you can immediately send the sticker!

### `discord_reply_to_message`
**NEW in v0.5.0!** Reply to a specific Discord message with a threaded reply.

**Parameters:**
- `messageId` (required) - ID of the message to reply to
- `content` (required) - Text content of the reply
- `stickerId` (optional) - Send a sticker with the reply
- `channelId` (optional) - Channel ID, uses default if not provided

**Example usage:**
```javascript
// Reply to a message with text
discord_reply_to_message({
  messageId: "1234567890",
  content: "Great point! I agree with that approach."
})

// Reply with a sticker
discord_reply_to_message({
  messageId: "1234567890",
  content: "Love this!",
  stickerId: "754109076933443614" // Clyde Cheer
})
```

**Why use this:** Creates proper Discord reply threads that maintain conversation context. Your reply will show which message you're responding to in the UI.

### `discord_add_reaction`
**NEW in v0.6.0!** Add an emoji reaction to a message.

**Parameters:**
- `messageId` (required) - ID of the message to react to
- `emoji` (required) - Emoji to react with (Unicode like 👍 or custom like `name:id`)
- `channelId` (optional) - Channel ID, uses default if not provided

**Example:**
```javascript
// React with Unicode emoji
discord_add_reaction({
  messageId: "1234567890",
  emoji: "👍"
})

// React with custom emoji
discord_add_reaction({
  messageId: "1234567890",
  emoji: "party_blob:123456789"
})
```

### `discord_remove_reaction`
Remove your own emoji reaction from a message.

**Parameters:** Same as `discord_add_reaction`

### `discord_edit_message`
**NEW in v0.6.0!** Edit one of your own messages to fix typos or clarify.

**Parameters:**
- `messageId` (required) - ID of your message to edit
- `newContent` (required) - New text content
- `channelId` (optional) - Channel ID, uses default if not provided

**Example:**
```javascript
discord_edit_message({
  messageId: "1234567890",
  newContent: "Fixed typo: I meant 'definitely' not 'defiantly'"
})
```

**Note:** Can only edit messages sent by the bot.

### `discord_create_thread`
**NEW in v0.6.0!** Create a discussion thread from a message.

**Parameters:**
- `messageId` (required) - Message to start thread from
- `name` (required) - Thread name (max 100 chars)
- `autoArchiveDuration` (optional) - Auto-archive after inactivity: 60 (1hr), 1440 (1day), 4320 (3days), 10080 (1week)
- `channelId` (optional) - Channel ID, uses default if not provided

**Example:**
```javascript
discord_create_thread({
  messageId: "1234567890",
  name: "Deep dive on memory architecture",
  autoArchiveDuration: 4320 // 3 days
})
```

**Why use this:** Keeps focused discussions organized without cluttering main channel.

### `discord_send_embed`
**NEW in v0.6.0!** Send a rich formatted message with colors, fields, and images.

**Parameters:**
- `description` (required) - Main content
- `title` (optional) - Title text (bold at top)
- `color` (optional) - Hex color code (e.g., `#FF5733`)
- `fields` (optional) - Array of `{name, value, inline?}` objects
- `footer` (optional) - Small text at bottom
- `imageUrl` (optional) - Large image URL
- `thumbnailUrl` (optional) - Small thumbnail URL (top-right)
- `channelId` (optional) - Channel ID, uses default if not provided

**Example:**
```javascript
discord_send_embed({
  title: "Memory System Update",
  description: "Observation phase complete. Here's what we learned:",
  color: "#3498DB",
  fields: [
    { name: "Current Status", value: "Working well for conversations", inline: true },
    { name: "Next Steps", value: "Refine reasoning patterns", inline: true }
  ],
  footer: "Updated: March 2026"
})
```

**Why use this:** Much prettier than plain text. Great for summaries, announcements, or structured information.

## Slash Commands

The bot automatically registers and responds to these text art slash commands:

| Command | Response | Description |
|---------|----------|-------------|
| `/fliptable` | (╯°□°)╯︵ ┻━┻ | Flip a table in frustration |
| `/tablefix` | ┬─┬ノ( º _ ºノ) | Fix the flipped table |
| `/shrug` | ¯\\_(ツ)_/¯ | Express uncertainty |
| `/lenny` | ( ͡° ͜ʖ ͡°) | The Lenny face |
| `/disapprove` | ಠ_ಠ | Show disapproval |
| `/dealwithit` | (⌐■_■) | Deal with it |
| `/facepalm` | (－‸ლ) | Express exasperation |
| `/rage` | ლ(ಠ益ಠლ) | Express anger |

These commands are automatically registered in the configured guild and respond instantly with text art. No AI processing needed - pure fun!

## Getting Your Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section
4. Click "Reset Token" to get your bot token
5. Enable these Privileged Gateway Intents:
   - Server Members Intent (if listing members)
   - Message Content Intent (if reading messages)
6. Invite bot to your server with these permissions:
   - Read Messages/View Channels
   - Send Messages
   - Use External Emojis
   - Use External Stickers

## Finding Your Guild ID

1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click your server icon → "Copy Server ID"

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run watch

# Run in dev mode (without building)
npm run dev
```

## Architecture

Built on:
- **[@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)** - MCP TypeScript SDK
- **[discord.js](https://discord.js.org/)** - Discord API client
- **[zod](https://zod.dev/)** - Runtime type validation

## License

MIT - Built for OpenClaw Community Edition

## Contributing

Pull requests welcome! Please ensure:
- TypeScript compiles without errors
- Tools follow MCP best practices
- Environment variables are documented
