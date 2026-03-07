import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import { listDiscordGuildEmojis, listDiscordGuildStickers, searchDiscordEmojis } from "../../discord/tools/emoji-discovery.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";

const DiscordListEmojisSchema = Type.Object({
  guildId: Type.Optional(Type.String()),
});

const DiscordListStickersSchema = Type.Object({
  guildId: Type.Optional(Type.String()),
});

const DiscordSearchEmojiSchema = Type.Object({
  query: Type.String(),
  guildId: Type.Optional(Type.String()),
});

/**
 * Creates discord_list_emojis tool that lists custom emojis available in the current Discord server.
 */
export function createDiscordListEmojisTool(options: {
  config?: OpenClawConfig;
  guildId?: string;
}): AnyAgentTool | null {
  if (!options.guildId) {
    return null;
  }

  return {
    label: "Discord List Emojis",
    name: "discord_list_emojis",
    description:
      "Lists custom emojis available in this Discord server. Returns emoji names, IDs, whether they're animated, and the syntax to use them in messages. Use this to discover what custom emojis you can use to add personality to your responses.",
    parameters: DiscordListEmojisSchema,
    handler: async (params) => {
      const guildId = readStringParam(params, "guildId") || options.guildId!;
      const result = await listDiscordGuildEmojis({ guildId });
      
      const formatted = result.emojis.length > 0
        ? result.emojis
            .map(
              (e) =>
                `${e.name} ${e.animated ? "(animated)" : "(static)"} - Use: ${e.syntax}`,
            )
            .join("\n")
        : "No custom emojis available in this server.";

      return jsonResult({ emojis: result.emojis, total: result.total, formatted });
    },
  };
}

/**
 * Creates discord_list_stickers tool that lists stickers available in the current Discord server.
 */
export function createDiscordListStickersTool(options: {
  config?: OpenClawConfig;
  guildId?: string;
}): AnyAgentTool | null {
  if (!options.guildId) {
    return null;
  }

  return {
    label: "Discord List Stickers",
    name: "discord_list_stickers",
    description:
      "Lists stickers available in this Discord server. Returns sticker names, IDs, descriptions, and format types. Use this to discover what stickers you can send to add personality and emotion to your responses.",
    parameters: DiscordListStickersSchema,
    handler: async (params) => {
      const guildId = readStringParam(params, "guildId") || options.guildId!;
      const result = await listDiscordGuildStickers({ guildId });

      const formatted = result.stickers.length > 0
        ? result.stickers
            .map((s) => {
              const desc = s.description ? ` - ${s.description}` : "";
              return `"${s.name}" (${s.formatType})${desc}`;
            })
            .join("\n")
        : "No stickers available in this server.";

      return jsonResult({ stickers: result.stickers, total: result.total, formatted });
    },
  };
}

/**
 * Creates discord_search_emoji tool that searches for emojis by keyword.
 */
export function createDiscordSearchEmojiTool(options: {
  config?: OpenClawConfig;
  guildId?: string;
}): AnyAgentTool | null {
  if (!options.guildId) {
    return null;
  }

  return {
    label: "Discord Search Emoji",
    name: "discord_search_emoji",
    description:
      "Searches custom emojis by name or keyword. Useful for finding specific emojis quickly (e.g., party, think, happy). Returns matching emoji names and syntax.",
    parameters: DiscordSearchEmojiSchema,
    handler: async (params) => {
      const guildId = readStringParam(params, "guildId") || options.guildId!;
      const query = readStringParam(params, "query");
      
      const allEmojis = await listDiscordGuildEmojis({ guildId });
      const results = searchDiscordEmojis({ emojis: allEmojis.emojis, query });

      const formatted =
        results.length > 0
          ? results
              .map(
                (e) =>
                  `${e.name} ${e.animated ? "(animated)" : "(static)"} - Use: ${e.syntax}`,
              )
              .join("\n")
          : `No emojis found matching "${query}".`;

      return jsonResult({ results, total: results.length, formatted });
    },
  };
}
