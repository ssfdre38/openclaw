import type { ChannelAgentTool } from "../types.js";
import {
  createDiscordListEmojisTool,
  createDiscordListStickersTool,
  createDiscordSearchEmojiTool,
} from "../../../agents/tools/discord-emoji-tools.js";

/**
 * Creates Discord-specific agent tools (emoji/sticker discovery).
 * These tools are available when Discord is the active channel.
 */
export function createDiscordAgentTools(params: { guildId?: string }): ChannelAgentTool[] {
  const tools: ChannelAgentTool[] = [];

  // Emoji discovery tool
  const emojiTool = createDiscordListEmojisTool({ guildId: params.guildId });
  if (emojiTool) {
    tools.push(emojiTool);
  }

  // Sticker discovery tool
  const stickerTool = createDiscordListStickersTool({ guildId: params.guildId });
  if (stickerTool) {
    tools.push(stickerTool);
  }

  // Emoji search tool
  const searchTool = createDiscordSearchEmojiTool({ guildId: params.guildId });
  if (searchTool) {
    tools.push(searchTool);
  }

  return tools;
}
