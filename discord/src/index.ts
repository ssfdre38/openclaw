#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client, GatewayIntentBits, type GuildMember } from "discord.js";
import { z } from "zod";

// Environment validation
const botToken = process.env.DISCORD_BOT_TOKEN;
const defaultGuildId = process.env.DISCORD_DEFAULT_GUILD_ID;
const defaultChannelId = process.env.DISCORD_DEFAULT_CHANNEL_ID;

if (!botToken) {
  console.error("Error: DISCORD_BOT_TOKEN environment variable is required");
  process.exit(1);
}

// Discord client setup
const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Required to fetch message history for replies/reactions
  ],
});

let discordReady = false;

// Text art slash commands
const TEXT_ART_COMMANDS = [
  { name: 'fliptable', description: 'Flip a table in frustration', response: '(╯°□°)╯︵ ┻━┻' },
  { name: 'tablefix', description: 'Fix the flipped table', response: '┬─┬ノ( º _ ºノ)' },
  { name: 'shrug', description: 'Express uncertainty or indifference', response: '¯\\_(ツ)_/¯' },
  { name: 'lenny', description: 'The Lenny face', response: '( ͡° ͜ʖ ͡°)' },
  { name: 'disapprove', description: 'Show disapproval', response: 'ಠ_ಠ' },
  { name: 'dealwithit', description: 'Deal with it', response: '(⌐■_■)' },
  { name: 'facepalm', description: 'Express exasperation', response: '(－‸ლ)' },
  { name: 'rage', description: 'Express anger', response: 'ლ(ಠ益ಠლ)' },
];

// ASCII Art catalog
const ASCII_ART_CATALOG = {
  cat: `  |\\__/,|   (\`\\
  |_ _  |.--.) )
  ( T   )     /
 (((^_(((/(((_/`,
  
  dog: `  / \\__
 (    @\\___
 /         O
/   (_____/
/_____/   U`,

  bear: `   ___   
  (o o)  
 (  V  ) 
 --m-m--`,

  rabbit: `  (\\___/)
  (='.'=)
  (")_(")`,

  owl: `  {o,o}
  |)__)
  -"-"-`,

  penguin: `   (°<
   ( )
  /  \\`,

  heart: `  ♥♥♥♥♥
 ♥♥♥♥♥♥♥
♥♥♥♥♥♥♥♥♥
 ♥♥♥♥♥♥♥
  ♥♥♥♥♥
   ♥♥♥
    ♥`,

  star: `    *
   ***
  *****
 *******
*********
 *******
  *****
   ***
    *`,

  thumbsup: `      _
     /(|
    (  :
   __\\  \\  _____
 (____)  \`|
(____)|   |
 (____).__|
  (___)__.|_____`,

  wave: `        .-''-.
       /  __  \\
       | /  \\ |
       |_\\ /_|
      .-'    '-.
     /  .-'-.  \\
    /  /     \\  \\
    |  |     |  |
    |  |     |  |
     \\ |     | /
      \\|     |/
       '-----'`,

  coffee: `    (  )   (   )  )
     ) (   )  (  (
     ( )  (    ) )
     _____________
    <_____________> ___
    |             |/ _ \\
    |               | | |
    |               |_| |
 ___|             |\\___/
/    \\___________/    \\
\\_____________________/`,

  computer: `    _______________
   |,----------.  |
   ||           |=|
   ||          || |
   ||          || |
   |'---------'| ,|
   /__________[_]/`,

  rocket: `       /\\
      /  \\
     |    |
     | [] |
     |    |
    /|  []|\\
   [  '  '  ]
   |   ==   |
   |   ==   |
   '---------'
    /|||||||\\
   '---------'`,

  happy: `   .-""""""-.
 .'          '.
/   O      O   \\
|               |
|  \\  ___  /  |
 \\          /
  '-......-'`,

  thinking: `    .-"""-.
   /       \\
  |  O   O  |
  |    ^    |
  |   \\_/   |
   \\_______/
      | |
      | |
     __| |__
    '-------'`
};

const ASCII_ART_LIST = Object.keys(ASCII_ART_CATALOG).map(name => ({
  name,
  preview: ASCII_ART_CATALOG[name as keyof typeof ASCII_ART_CATALOG].split('\n')[0]
}));

discord.once("ready", async () => {
  discordReady = true;
  console.error(`[MCP Discord] Bot logged in as ${discord.user?.tag}`);
  
  // Register slash commands
  try {
    if (defaultGuildId) {
      const guild = await discord.guilds.fetch(defaultGuildId);
      
      for (const cmd of TEXT_ART_COMMANDS) {
        await guild.commands.create({
          name: cmd.name,
          description: cmd.description,
        });
      }
      
      console.error(`[MCP Discord] Registered ${TEXT_ART_COMMANDS.length} slash commands in guild ${defaultGuildId}`);
    } else {
      console.error('[MCP Discord] No default guild ID - slash commands not registered');
    }
  } catch (error) {
    console.error('[MCP Discord] Failed to register slash commands:', error);
  }
});

// Handle slash command interactions
discord.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  
  const command = TEXT_ART_COMMANDS.find(cmd => cmd.name === interaction.commandName);
  
  if (command) {
    try {
      await interaction.reply(command.response);
      console.error(`[MCP Discord] Handled /${command.name} command`);
    } catch (error) {
      console.error(`[MCP Discord] Failed to respond to /${command.name}:`, error);
    }
  }
});

discord.login(botToken).catch((err) => {
  console.error("[MCP Discord] Failed to log in:", err);
  process.exit(1);
});

// Utility: Get guild ID from args or default
function resolveGuildId(args: { guildId?: string }): string {
  const guildId = args.guildId || defaultGuildId;
  if (!guildId) {
    throw new Error("No guild ID provided and DISCORD_DEFAULT_GUILD_ID not set");
  }
  return guildId;
}

// MCP Server setup
const server = new Server(
  {
    name: "@openclaw/mcp-server-discord",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool: list_emojis
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "discord_list_emojis",
        description:
          "List custom emojis available in a Discord server. Returns emoji names, IDs, animated status, and usage syntax.",
        inputSchema: {
          type: "object",
          properties: {
            guildId: {
              type: "string",
              description: "Discord server/guild ID. Uses default if not provided.",
            },
          },
        },
      },
      {
        name: "discord_list_stickers",
        description:
          "List custom stickers available in a Discord server. Returns sticker names, descriptions, format types (PNG, APNG, Lottie, GIF).",
        inputSchema: {
          type: "object",
          properties: {
            guildId: {
              type: "string",
              description: "Discord server/guild ID. Uses default if not provided.",
            },
          },
        },
      },
      {
        name: "discord_list_default_stickers",
        description:
          "List Discord's official default sticker packs (Clyde, Wumpus, etc.) with IDs. These stickers are available to all users and can be sent by ID.",
        inputSchema: {
          type: "object",
          properties: {
            pack: {
              type: "string",
              description: "Filter by pack name (e.g., 'Clyde', 'Wumpus'). Optional - returns all if not specified.",
            },
          },
        },
      },
      {
        name: "discord_search_emoji",
        description:
          "Search for custom emojis by keyword in a Discord server. Case-insensitive search in emoji names.",
        inputSchema: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "Keyword to search for in emoji names",
            },
            guildId: {
              type: "string",
              description: "Discord server/guild ID. Uses default if not provided.",
            },
          },
          required: ["keyword"],
        },
      },
      {
        name: "discord_search_sticker",
        description:
          "Search for stickers (both custom and default) by keyword. Searches both custom server stickers and Discord's official sticker packs.",
        inputSchema: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "Keyword to search for in sticker names",
            },
            guildId: {
              type: "string",
              description: "Discord server/guild ID for custom stickers. Uses default if not provided.",
            },
          },
          required: ["keyword"],
        },
      },
      {
        name: "discord_text_art",
        description:
          "Get ASCII/text art emoticons for expression. Available types: fliptable=(╯°□°)╯︵ ┻━┻, tablefix=┬─┬ノ( º _ ºノ), shrug=¯\\_(ツ)_/¯, lenny=( ͡° ͜ʖ ͡°), disapprove=ಠ_ಠ, dealwithit=(⌐■_■), facepalm=(－‸ლ), rage=t(ಠ益ಠt). Returns the text art string to include in your message. Use discord_send_slash_command to post it directly to channel instead.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["fliptable", "tablefix", "shrug", "lenny", "disapprove", "dealwithit", "facepalm", "rage"],
              description: "Which text art to get. Examples: 'fliptable' for frustration, 'shrug' for confusion, 'lenny' for mischief, 'facepalm' for exasperation.",
            },
          },
          required: ["type"],
        },
      },
      {
        name: "discord_send_slash_command",
        description:
          "Post text art directly to Discord channel. Available commands: fliptable=(╯°□°)╯︵ ┻━┻, tablefix=┬─┬ノ( º _ ºノ), shrug=¯\\_(ツ)_/¯, lenny=( ͡° ͜ʖ ͡°), disapprove=ಠ_ಠ, dealwithit=(⌐■_■), facepalm=(－‸ლ), rage=t(ಠ益ಠt). Bot will post the text art as a standalone message. For inline use, use discord_text_art instead.",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              enum: ["fliptable", "tablefix", "shrug", "lenny", "disapprove", "dealwithit", "facepalm", "rage"],
              description: "Which text art to send. Pick based on emotion: 'fliptable' for frustration, 'shrug' for confusion, 'rage' for anger, etc.",
            },
            channelId: {
              type: "string",
              description: "Discord channel ID. Uses default if not provided.",
            },
          },
          required: ["command"],
        },
      },
      {
        name: "discord_list_ascii_art",
        description:
          "List all available ASCII art pieces. Returns catalog of multi-line ASCII art (cat, dog, bear, heart, star, coffee, rocket, etc.) that you can use for visual expression.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "discord_get_ascii_art",
        description:
          "Get a specific ASCII art piece. Returns multi-line ASCII art that you can include in messages or post directly. Available: cat, dog, bear, rabbit, owl, penguin, heart, star, thumbsup, wave, coffee, computer, rocket, happy, thinking.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              enum: ["cat", "dog", "bear", "rabbit", "owl", "penguin", "heart", "star", "thumbsup", "wave", "coffee", "computer", "rocket", "happy", "thinking"],
              description: "Which ASCII art to get. Examples: 'cat' for cute cat, 'heart' for love, 'rocket' for excitement, 'coffee' for energy.",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "discord_reply_to_message",
        description:
          "Reply to a specific Discord message. Creates a threaded reply that shows which message you're responding to. Use this when you want to respond directly to someone's message rather than just sending a new message. Supports text, emojis, and stickers. NOTE: Due to precision limits, provide the message ID in two parts (first 12 digits, last 7 digits).",
        inputSchema: {
          type: "object",
          properties: {
            messageIdHigh: {
              type: "string",
              description: "First 12 digits of the message ID (e.g., '148009906739' from message ID 1480099067391377442)",
            },
            messageIdLow: {
              type: "string",
              description: "Last 7 digits of the message ID (e.g., '1377442' from message ID 1480099067391377442)",
            },
            content: {
              type: "string",
              description: "Text content of the reply. Can include emoji syntax like <:name:id> or custom emojis.",
            },
            stickerId: {
              type: "string",
              description: "Optional: Send a sticker in the reply. Provide the sticker ID (from discord_list_stickers or discord_list_default_stickers).",
            },
            channelId: {
              type: "string",
              description: "Discord channel ID. Uses default if not provided.",
            },
          },
          required: ["messageIdHigh", "messageIdLow", "content"],
        },
      },
      {
        name: "discord_add_reaction",
        description:
          "Add an emoji reaction to a message. Use emojis to express quick responses without text (thumbs up, heart, eyes, etc.). Supports both custom server emojis and standard Unicode emojis.",
        inputSchema: {
          type: "object",
          properties: {
            messageId: {
              type: "string",
              description: "ID of the message to react to. IMPORTANT: Pass as string in quotes (e.g., '1234567890').",
            },
            emoji: {
              type: "string",
              description: "Emoji to react with. For custom emoji use format 'name:id' or '<:name:id>'. For Unicode emoji use the emoji itself (👍, ❤️, 👀, etc.).",
            },
            channelId: {
              type: "string",
              description: "Discord channel ID. Uses default if not provided.",
            },
          },
          required: ["messageId", "emoji"],
        },
      },
      {
        name: "discord_remove_reaction",
        description:
          "Remove your own emoji reaction from a message. Use this to un-react if you change your mind or reacted by mistake.",
        inputSchema: {
          type: "object",
          properties: {
            messageId: {
              type: "string",
              description: "ID of the message to remove reaction from. IMPORTANT: Pass as string in quotes (e.g., '1234567890').",
            },
            emoji: {
              type: "string",
              description: "Emoji to remove. Same format as discord_add_reaction.",
            },
            channelId: {
              type: "string",
              description: "Discord channel ID. Uses default if not provided.",
            },
          },
          required: ["messageId", "emoji"],
        },
      },
      {
        name: "discord_edit_message",
        description:
          "Edit one of your own messages. Use this to fix typos, clarify points, or update information. Can only edit messages sent by the bot.",
        inputSchema: {
          type: "object",
          properties: {
            messageId: {
              type: "string",
              description: "ID of your message to edit. IMPORTANT: Pass as string in quotes (e.g., '1234567890').",
            },
            newContent: {
              type: "string",
              description: "New text content for the message. Replaces the old content completely.",
            },
            channelId: {
              type: "string",
              description: "Discord channel ID. Uses default if not provided.",
            },
          },
          required: ["messageId", "newContent"],
        },
      },
      {
        name: "discord_create_thread",
        description:
          "Create a new thread from a message to organize discussion. Threads keep conversations focused and don't clutter the main channel. Great for deep dives or side discussions.",
        inputSchema: {
          type: "object",
          properties: {
            messageId: {
              type: "string",
              description: "ID of the message to start the thread from. IMPORTANT: Pass as string in quotes (e.g., '1234567890').",
            },
            name: {
              type: "string",
              description: "Name for the thread (max 100 characters). Be descriptive so people know what the thread is about.",
            },
            autoArchiveDuration: {
              type: "number",
              enum: [60, 1440, 4320, 10080],
              description: "Auto-archive after X minutes of inactivity. 60=1hr, 1440=1day, 4320=3days, 10080=1week. Default: 1440 (1 day).",
            },
            channelId: {
              type: "string",
              description: "Discord channel ID. Uses default if not provided.",
            },
          },
          required: ["messageId", "name"],
        },
      },
      {
        name: "discord_send_embed",
        description:
          "Send a rich embedded message with colors, fields, images, and formatting. Embeds look much prettier than plain text and can organize information visually. Great for summaries, lists, or important announcements.",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the embed (bold, at top).",
            },
            description: {
              type: "string",
              description: "Main text content of the embed. Supports basic markdown.",
            },
            color: {
              type: "string",
              description: "Hex color code for left border (e.g., '#FF5733', '#3498DB'). Makes embed visually distinct.",
            },
            fields: {
              type: "array",
              description: "Optional array of field objects with 'name' and 'value' properties. Each field is a section in the embed.",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { type: "string" },
                  inline: { type: "boolean" }
                }
              }
            },
            footer: {
              type: "string",
              description: "Small text at bottom of embed. Good for timestamps or source attribution.",
            },
            imageUrl: {
              type: "string",
              description: "URL of large image to display in embed.",
            },
            thumbnailUrl: {
              type: "string",
              description: "URL of small thumbnail image (top-right corner).",
            },
            channelId: {
              type: "string",
              description: "Discord channel ID. Uses default if not provided.",
            },
          },
          required: ["description"],
        },
      },
      {
        name: "discord_send_message",
        description:
          "Send a text message to a Discord channel. Supports user mentions (@user), role mentions (@role), and channel mentions (#channel). Use <@userId> for user mentions, <@&roleId> for role mentions, and <#channelId> for channel mentions. This is the primary tool for sending messages with mentions/pings.",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "Message content. Supports mentions: <@userId> for users, <@&roleId> for roles, <#channelId> for channels. Also supports custom emojis with <:name:id> syntax.",
            },
            channelId: {
              type: "string",
              description: "Discord channel ID to send the message to. Uses default if not provided.",
            },
            stickerId: {
              type: "string",
              description: "Optional: Attach a sticker to the message. Provide the sticker ID (from discord_list_stickers or discord_list_default_stickers).",
            },
          },
          required: ["content"],
        },
      },
      {
        name: "discord_search_users",
        description:
          "Search for users in a Discord server by username or display name. Returns user IDs that can be used for mentions. Use this to find user IDs before mentioning them with discord_send_message.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Username or display name to search for (case-insensitive, partial matches allowed).",
            },
            guildId: {
              type: "string",
              description: "Discord server/guild ID. Uses default if not provided.",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "discord_get_channel_members",
        description:
          "List members who can access a specific channel. Returns user IDs and names. Useful for finding who to mention in a channel.",
        inputSchema: {
          type: "object",
          properties: {
            channelId: {
              type: "string",
              description: "Discord channel ID. Uses default if not provided.",
            },
            limit: {
              type: "number",
              description: "Maximum number of members to return (default: 50, max: 100).",
            },
          },
        },
      },
    ],
  };
});

// Tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!discordReady) {
    throw new Error("Discord bot not ready yet");
  }

  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "discord_list_emojis": {
        const guildId = resolveGuildId(args as { guildId?: string });
        const guild = await discord.guilds.fetch(guildId);
        const emojis = await guild.emojis.fetch();

        const lines = ["**Custom Emojis:**", ""];
        
        if (emojis.size === 0) {
          lines.push("No custom emojis found in this server.");
        } else {
          for (const [, emoji] of emojis) {
            const animated = emoji.animated ? " (animated)" : " (static)";
            const syntax = emoji.animated
              ? `<a:${emoji.name}:${emoji.id}>`
              : `<:${emoji.name}:${emoji.id}>`;
            lines.push(`- **${emoji.name}**${animated}`);
            lines.push(`  Usage: \`${syntax}\``);
          }
        }

        return {
          content: [
            {
              type: "text",
              text: lines.join("\n"),
            },
          ],
        };
      }

      case "discord_list_stickers": {
        const guildId = resolveGuildId(args as { guildId?: string });
        const guild = await discord.guilds.fetch(guildId);
        const stickers = await guild.stickers.fetch();

        const lines = ["**Stickers:**", ""];

        if (stickers.size === 0) {
          lines.push("No stickers found in this server.");
        } else {
          const formatMap: Record<number, string> = {
            1: "PNG",
            2: "APNG",
            3: "Lottie",
            4: "GIF",
          };

          for (const [, sticker] of stickers) {
            const format = formatMap[sticker.format] || `Unknown (${sticker.format})`;
            lines.push(`- **${sticker.name}** (${format})`);
            if (sticker.description) {
              lines.push(`  Description: ${sticker.description}`);
            }
            lines.push(`  ID: ${sticker.id}`);
          }
        }

        return {
          content: [
            {
              type: "text",
              text: lines.join("\n"),
            },
          ],
        };
      }

      case "discord_list_default_stickers": {
        const { pack } = z
          .object({
            pack: z.string().optional(),
          })
          .parse(args);

        // Fetch standard sticker packs from Discord API
        const stickerPacks = await discord.fetchStickerPacks();

        const lines = ["**Discord Default Sticker Packs:**", ""];

        if (stickerPacks.size === 0) {
          lines.push("No standard sticker packs available.");
        } else {
          for (const [, stickerPack] of stickerPacks) {
            // Filter by pack name if specified
            if (pack && !stickerPack.name.toLowerCase().includes(pack.toLowerCase())) {
              continue;
            }

            lines.push(`**${stickerPack.name}** (${stickerPack.stickers.size} stickers):`);
            if (stickerPack.description) {
              lines.push(`  _${stickerPack.description}_`);
            }
            lines.push("");

            // List each sticker with ID
            for (const [, sticker] of stickerPack.stickers) {
              lines.push(`- **${sticker.name}**`);
              lines.push(`  ID: \`${sticker.id}\``);
              if (sticker.description) {
                lines.push(`  ${sticker.description}`);
              }
            }
            lines.push("");
          }
        }

        return {
          content: [
            {
              type: "text",
              text: lines.join("\n"),
            },
          ],
        };
      }

      case "discord_search_emoji": {
        const { keyword, guildId: providedGuildId } = z
          .object({
            keyword: z.string(),
            guildId: z.string().optional(),
          })
          .parse(args);

        const guildId = resolveGuildId({ guildId: providedGuildId });
        const guild = await discord.guilds.fetch(guildId);
        const emojis = await guild.emojis.fetch();

        const matches = emojis.filter((emoji) =>
          emoji.name?.toLowerCase().includes(keyword.toLowerCase())
        );

        const lines = [`**Search results for "${keyword}":**`, ""];

        if (matches.size === 0) {
          lines.push("No matching emojis found.");
        } else {
          for (const [, emoji] of matches) {
            const animated = emoji.animated ? " (animated)" : " (static)";
            const syntax = emoji.animated
              ? `<a:${emoji.name}:${emoji.id}>`
              : `<:${emoji.name}:${emoji.id}>`;
            lines.push(`- **${emoji.name}**${animated}`);
            lines.push(`  Usage: \`${syntax}\``);
          }
        }

        return {
          content: [
            {
              type: "text",
              text: lines.join("\n"),
            },
          ],
        };
      }

      case "discord_search_sticker": {
        const { keyword, guildId: providedGuildId } = z
          .object({
            keyword: z.string(),
            guildId: z.string().optional(),
          })
          .parse(args);

        const lines = [`**Sticker search results for "${keyword}":**`, ""];

        // Search custom server stickers
        const guildId = resolveGuildId({ guildId: providedGuildId });
        const guild = await discord.guilds.fetch(guildId);
        const customStickers = await guild.stickers.fetch();
        const customMatches = customStickers.filter((sticker) =>
          sticker.name?.toLowerCase().includes(keyword.toLowerCase())
        );

        if (customMatches.size > 0) {
          lines.push("**Custom Server Stickers:**");
          const formatMap: Record<number, string> = {
            1: "PNG",
            2: "APNG",
            3: "Lottie",
            4: "GIF",
          };
          for (const [, sticker] of customMatches) {
            const format = formatMap[sticker.format] || `Unknown (${sticker.format})`;
            lines.push(`- **${sticker.name}** (${format})`);
            if (sticker.description) {
              lines.push(`  ${sticker.description}`);
            }
            lines.push(`  ID: \`${sticker.id}\``);
          }
          lines.push("");
        }

        // Search default sticker packs
        const stickerPacks = await discord.fetchStickerPacks();
        const defaultMatches: Array<{ name: string; id: string; description: string; pack: string }> = [];

        for (const [, pack] of stickerPacks) {
          for (const [, sticker] of pack.stickers) {
            if (sticker.name.toLowerCase().includes(keyword.toLowerCase())) {
              defaultMatches.push({
                name: sticker.name,
                id: sticker.id,
                description: sticker.description || "",
                pack: pack.name,
              });
            }
          }
        }

        if (defaultMatches.length > 0) {
          lines.push("**Default Discord Stickers:**");
          for (const sticker of defaultMatches) {
            lines.push(`- **${sticker.name}** (${sticker.pack})`);
            if (sticker.description) {
              lines.push(`  ${sticker.description}`);
            }
            lines.push(`  ID: \`${sticker.id}\``);
          }
          lines.push("");
        }

        if (customMatches.size === 0 && defaultMatches.length === 0) {
          lines.push("No matching stickers found.");
        }

        return {
          content: [
            {
              type: "text",
              text: lines.join("\n"),
            },
          ],
        };
      }

      case "discord_text_art": {
        const { type } = z
          .object({
            type: z.enum(["fliptable", "tablefix", "shrug", "lenny", "disapprove", "dealwithit", "facepalm", "rage"]),
          })
          .parse(args);

        const command = TEXT_ART_COMMANDS.find(cmd => cmd.name === type);
        
        if (!command) {
          throw new Error(`Unknown text art type: ${type}`);
        }

        return {
          content: [
            {
              type: "text",
              text: command.response,
            },
          ],
        };
      }

      case "discord_send_slash_command": {
        const { command, channelId: providedChannelId } = z
          .object({
            command: z.enum(["fliptable", "tablefix", "shrug", "lenny", "disapprove", "dealwithit", "facepalm", "rage"]),
            channelId: z.coerce.string().optional(),
          })
          .parse(args);

        const channelId = providedChannelId || defaultChannelId;
        if (!channelId) {
          throw new Error("No channel ID provided and DISCORD_DEFAULT_CHANNEL_ID not set");
        }

        const channel = await discord.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
          throw new Error(`Channel ${channelId} not found or is not text-based`);
        }

        // Find the command response
        const cmdData = TEXT_ART_COMMANDS.find(cmd => cmd.name === command);
        if (!cmdData) {
          throw new Error(`Unknown command: ${command}`);
        }

        // Send the text art directly as the bot
        // (Discord doesn't allow bots to trigger slash commands programmatically)
        if ('send' in channel) {
          await channel.send(cmdData.response);
        } else {
          throw new Error(`Channel type does not support sending messages`);
        }

        return {
          content: [
            {
              type: "text",
              text: `Sent /${command}: ${cmdData.response}`,
            },
          ],
        };
      }

      case "discord_list_ascii_art": {
        const lines = ["**Available ASCII Art:**", ""];
        
        for (const art of ASCII_ART_LIST) {
          lines.push(`- **${art.name}** - ${art.preview}...`);
        }
        
        lines.push("");
        lines.push("Use `discord_get_ascii_art` to retrieve full art piece.");
        
        return {
          content: [
            {
              type: "text",
              text: lines.join("\n"),
            },
          ],
        };
      }

      case "discord_get_ascii_art": {
        const { name } = z
          .object({
            name: z.enum(["cat", "dog", "bear", "rabbit", "owl", "penguin", "heart", "star", "thumbsup", "wave", "coffee", "computer", "rocket", "happy", "thinking"]),
          })
          .parse(args);

        const art = ASCII_ART_CATALOG[name];
        
        if (!art) {
          throw new Error(`Unknown ASCII art: ${name}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `\`\`\`\n${art}\n\`\`\``,
            },
          ],
        };
      }

      case "discord_reply_to_message": {
        const { messageIdHigh, messageIdLow, content, stickerId, channelId: providedChannelId } = z
          .object({
            messageIdHigh: z.string(), // First 12 digits
            messageIdLow: z.string(),  // Last 7 digits
            content: z.string(),
            stickerId: z.string().optional(),
            channelId: z.string().optional(),
          })
          .parse(args);

        // Reconstruct the full message ID from two parts
        const messageId = messageIdHigh + messageIdLow;
        
        const channelId = providedChannelId || defaultChannelId;
        console.error(`[DEBUG] discord_reply_to_message: reconstructed messageId=${messageId} (from ${messageIdHigh} + ${messageIdLow}), channelId=${channelId}`);
        
        if (!channelId) {
          throw new Error("No channel ID provided and DISCORD_DEFAULT_CHANNEL_ID not set");
        }

        const channel = await discord.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
          throw new Error(`Channel ${channelId} not found or is not text-based`);
        }

        // Fetch the message we're replying to
        if (!('messages' in channel)) {
          throw new Error(`Channel does not support message history`);
        }

        let targetMessage;
        try {
          console.error(`[DEBUG] Attempting to fetch message ${messageId} from channel ${channelId}`);
          targetMessage = await channel.messages.fetch(messageId);
          console.error(`[DEBUG] Successfully fetched message ${messageId}`);
        } catch (error: any) {
          console.error(`[DEBUG] Failed to fetch message: ${error.message}, code: ${error.code}, status: ${error.status}`);
          throw new Error(`Failed to fetch message ${messageId}: ${error.message}. Bot may need 'Read Message History' permission in this channel.`);
        }

        if (!targetMessage) {
          throw new Error(`Message ${messageId} not found in channel ${channelId}`);
        }

        // Build reply options
        const replyOptions: any = {
          content: content,
        };

        // Add sticker if provided
        if (stickerId) {
          replyOptions.stickers = [stickerId];
        }

        // Send the reply
        await targetMessage.reply(replyOptions);

        return {
          content: [
            {
              type: "text",
              text: `Replied to message ${messageId}${stickerId ? ' with sticker' : ''}`,
            },
          ],
        };
      }

      case "discord_add_reaction": {
        const { messageId, emoji, channelId: providedChannelId } = z
          .object({
            messageId: z.coerce.string(),
            emoji: z.string(),
            channelId: z.coerce.string().optional(),
          })
          .parse(args);

        const channelId = providedChannelId || defaultChannelId;
        if (!channelId) {
          throw new Error("No channel ID provided and DISCORD_DEFAULT_CHANNEL_ID not set");
        }

        const channel = await discord.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
          throw new Error(`Channel ${channelId} not found or is not text-based`);
        }

        if (!('messages' in channel)) {
          throw new Error(`Channel does not support messages`);
        }

        let message;
        try {
          message = await channel.messages.fetch(messageId);
        } catch (error: any) {
          throw new Error(`Failed to fetch message ${messageId}: ${error.message}. Bot may need 'Read Message History' permission.`);
        }

        if (!message) {
          throw new Error(`Message ${messageId} not found`);
        }

        // Parse emoji - could be Unicode or custom format
        await message.react(emoji);

        return {
          content: [
            {
              type: "text",
              text: `Added reaction ${emoji} to message ${messageId}`,
            },
          ],
        };
      }

      case "discord_remove_reaction": {
        const { messageId, emoji, channelId: providedChannelId } = z
          .object({
            messageId: z.coerce.string(),
            emoji: z.string(),
            channelId: z.coerce.string().optional(),
          })
          .parse(args);

        const channelId = providedChannelId || defaultChannelId;
        if (!channelId) {
          throw new Error("No channel ID provided and DISCORD_DEFAULT_CHANNEL_ID not set");
        }

        const channel = await discord.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
          throw new Error(`Channel ${channelId} not found or is not text-based`);
        }

        if (!('messages' in channel)) {
          throw new Error(`Channel does not support messages`);
        }

        let message;
        try {
          message = await channel.messages.fetch(messageId);
        } catch (error: any) {
          throw new Error(`Failed to fetch message ${messageId}: ${error.message}. Bot may need 'Read Message History' permission.`);
        }

        if (!message) {
          throw new Error(`Message ${messageId} not found`);
        }

        // Remove bot's own reaction
        const reactions = message.reactions.cache.get(emoji);
        if (reactions) {
          await reactions.users.remove(discord.user!.id);
        }

        return {
          content: [
            {
              type: "text",
              text: `Removed reaction ${emoji} from message ${messageId}`,
            },
          ],
        };
      }

      case "discord_edit_message": {
        const { messageId, newContent, channelId: providedChannelId } = z
          .object({
            messageId: z.coerce.string(),
            newContent: z.string(),
            channelId: z.coerce.string().optional(),
          })
          .parse(args);

        const channelId = providedChannelId || defaultChannelId;
        if (!channelId) {
          throw new Error("No channel ID provided and DISCORD_DEFAULT_CHANNEL_ID not set");
        }

        const channel = await discord.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
          throw new Error(`Channel ${channelId} not found or is not text-based`);
        }

        if (!('messages' in channel)) {
          throw new Error(`Channel does not support messages`);
        }

        let message;
        try {
          message = await channel.messages.fetch(messageId);
        } catch (error: any) {
          throw new Error(`Failed to fetch message ${messageId}: ${error.message}. Bot may need 'Read Message History' permission.`);
        }

        if (!message) {
          throw new Error(`Message ${messageId} not found`);
        }

        // Verify this is the bot's own message
        if (message.author.id !== discord.user!.id) {
          throw new Error(`Cannot edit message ${messageId} - not sent by this bot`);
        }

        await message.edit(newContent);

        return {
          content: [
            {
              type: "text",
              text: `Edited message ${messageId}`,
            },
          ],
        };
      }

      case "discord_create_thread": {
        const { messageId, name, autoArchiveDuration, channelId: providedChannelId } = z
          .object({
            messageId: z.coerce.string(),
            name: z.string(),
            autoArchiveDuration: z.number().optional(),
            channelId: z.coerce.string().optional(),
          })
          .parse(args);

        const channelId = providedChannelId || defaultChannelId;
        if (!channelId) {
          throw new Error("No channel ID provided and DISCORD_DEFAULT_CHANNEL_ID not set");
        }

        const channel = await discord.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
          throw new Error(`Channel ${channelId} not found or is not text-based`);
        }

        if (!('messages' in channel)) {
          throw new Error(`Channel does not support messages`);
        }

        let message;
        try {
          message = await channel.messages.fetch(messageId);
        } catch (error: any) {
          throw new Error(`Failed to fetch message ${messageId}: ${error.message}. Bot may need 'Read Message History' permission.`);
        }

        if (!message) {
          throw new Error(`Message ${messageId} not found`);
        }

        const thread = await message.startThread({
          name: name,
          autoArchiveDuration: autoArchiveDuration as any || 1440,
        });

        return {
          content: [
            {
              type: "text",
              text: `Created thread "${name}" (ID: ${thread.id}) from message ${messageId}`,
            },
          ],
        };
      }

      case "discord_send_embed": {
        const { title, description, color, fields, footer, imageUrl, thumbnailUrl, channelId: providedChannelId } = z
          .object({
            title: z.string().optional(),
            description: z.string(),
            color: z.string().optional(),
            fields: z.array(z.object({
              name: z.string(),
              value: z.string(),
              inline: z.boolean().optional(),
            })).optional(),
            footer: z.string().optional(),
            imageUrl: z.string().optional(),
            thumbnailUrl: z.string().optional(),
            channelId: z.coerce.string().optional(),
          })
          .parse(args);

        const channelId = providedChannelId || defaultChannelId;
        if (!channelId) {
          throw new Error("No channel ID provided and DISCORD_DEFAULT_CHANNEL_ID not set");
        }

        const channel = await discord.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
          throw new Error(`Channel ${channelId} not found or is not text-based`);
        }

        if (!('send' in channel)) {
          throw new Error(`Channel does not support sending messages`);
        }

        // Build embed
        const embed: any = {
          description: description,
        };

        if (title) embed.title = title;
        if (color) {
          // Convert hex color to decimal
          const colorInt = parseInt(color.replace('#', ''), 16);
          embed.color = colorInt;
        }
        if (fields) embed.fields = fields;
        if (footer) embed.footer = { text: footer };
        if (imageUrl) embed.image = { url: imageUrl };
        if (thumbnailUrl) embed.thumbnail = { url: thumbnailUrl };

        await channel.send({ embeds: [embed] });

        return {
          content: [
            {
              type: "text",
              text: `Sent embed${title ? ` "${title}"` : ''} to channel`,
            },
          ],
        };
      }

      case "discord_send_message": {
        const { content, channelId: providedChannelId, stickerId } = z
          .object({
            content: z.string(),
            channelId: z.coerce.string().optional(),
            stickerId: z.string().optional(),
          })
          .parse(args);

        const channelId = providedChannelId || defaultChannelId;
        if (!channelId) {
          throw new Error("No channel ID provided and DISCORD_DEFAULT_CHANNEL_ID not set");
        }

        const channel = await discord.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
          throw new Error(`Channel ${channelId} not found or is not text-based`);
        }

        if (!('send' in channel)) {
          throw new Error(`Channel does not support sending messages`);
        }

        // Build message payload
        const messagePayload: any = {
          content: content,
        };

        // Add sticker if provided
        if (stickerId) {
          messagePayload.stickers = [stickerId];
        }

        const sentMessage = await channel.send(messagePayload);

        return {
          content: [
            {
              type: "text",
              text: `Message sent to channel (ID: ${sentMessage.id})`,
            },
          ],
        };
      }

      case "discord_search_users": {
        const { query, guildId: providedGuildId } = z
          .object({
            query: z.string(),
            guildId: z.string().optional(),
          })
          .parse(args);

        const guildId = resolveGuildId({ guildId: providedGuildId });
        const guild = await discord.guilds.fetch(guildId);
        const members = await guild.members.fetch();

        const searchLower = query.toLowerCase();
        const matches = members.filter((member: GuildMember) => {
          const username = member.user.username.toLowerCase();
          const displayName = member.displayName.toLowerCase();
          return username.includes(searchLower) || displayName.includes(searchLower);
        });

        if (matches.size === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No users found matching "${query}"`,
              },
            ],
          };
        }

        const lines = [`**Found ${matches.size} user(s) matching "${query}":**`, ""];
        matches.forEach((member: GuildMember) => {
          const username = member.user.username;
          const displayName = member.displayName !== username ? ` (${member.displayName})` : '';
          const mentionSyntax = `<@${member.user.id}>`;
          lines.push(`- **${username}**${displayName}`);
          lines.push(`  ID: \`${member.user.id}\``);
          lines.push(`  Mention: \`${mentionSyntax}\``);
        });

        return {
          content: [
            {
              type: "text",
              text: lines.join("\n"),
            },
          ],
        };
      }

      case "discord_get_channel_members": {
        const { channelId: providedChannelId, limit } = z
          .object({
            channelId: z.string().optional(),
            limit: z.number().optional().default(50),
          })
          .parse(args);

        const channelId = providedChannelId || defaultChannelId;
        if (!channelId) {
          throw new Error("No channel ID provided and DISCORD_DEFAULT_CHANNEL_ID not set");
        }

        const channel = await discord.channels.fetch(channelId);
        if (!channel) {
          throw new Error(`Channel ${channelId} not found`);
        }

        // Get guild from channel
        const guildChannel = 'guild' in channel ? channel : null;
        if (!guildChannel || !guildChannel.guild) {
          throw new Error("Channel is not in a guild");
        }

        const guild = guildChannel.guild;
        const members = await guild.members.fetch();

        // Filter to members who can view the channel
        const canViewChannel = members.filter((member: GuildMember) => {
          if ('permissionsFor' in guildChannel) {
            const perms = guildChannel.permissionsFor(member);
            return perms?.has('ViewChannel') ?? false;
          }
          return false;
        });

        const limitedMembers = Array.from(canViewChannel.values()).slice(0, Math.min(limit, 100));

        if (limitedMembers.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No members found with access to this channel",
              },
            ],
          };
        }

        const lines = [`**${limitedMembers.length} member(s) with access to this channel:**`, ""];
        limitedMembers.forEach((member: GuildMember) => {
          const username = member.user.username;
          const displayName = member.displayName !== username ? ` (${member.displayName})` : '';
          const mentionSyntax = `<@${member.user.id}>`;
          lines.push(`- **${username}**${displayName} - Mention: \`${mentionSyntax}\``);
        });

        return {
          content: [
            {
              type: "text",
              text: lines.join("\n"),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Tool execution failed: ${errorMessage}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP Discord] Server running on stdio");
}

main().catch((error) => {
  console.error("[MCP Discord] Fatal error:", error);
  process.exit(1);
});
