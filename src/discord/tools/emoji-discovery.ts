import { Type } from "@sinclair/typebox";
import { listGuildEmojisDiscord } from "../send.emojis-stickers.js";
import type { DiscordReactOpts } from "../send.types.js";

/**
 * Lists custom emojis available in a Discord guild.
 * This allows agents to discover what custom emojis they can use in messages.
 */
export async function listDiscordGuildEmojis(params: {
  guildId: string;
  opts?: DiscordReactOpts;
}): Promise<{
  emojis: Array<{
    id: string;
    name: string;
    animated: boolean;
    syntax: string;
  }>;
  total: number;
}> {
  const raw = await listGuildEmojisDiscord(params.guildId, params.opts);
  const emojis = Array.isArray(raw)
    ? raw
        .filter((emoji): emoji is { id?: string; name?: string; animated?: boolean } => {
          return (
            emoji &&
            typeof emoji === "object" &&
            typeof emoji.id === "string" &&
            typeof emoji.name === "string"
          );
        })
        .map((emoji) => ({
          id: emoji.id!,
          name: emoji.name!,
          animated: Boolean(emoji.animated),
          syntax: emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`,
        }))
    : [];

  return {
    emojis,
    total: emojis.length,
  };
}

/**
 * Lists stickers available in a Discord guild.
 * This allows agents to discover what stickers they can send.
 */
export async function listDiscordGuildStickers(params: {
  guildId: string;
  opts?: DiscordReactOpts;
}): Promise<{
  stickers: Array<{
    id: string;
    name: string;
    description?: string;
    formatType: string;
  }>;
  total: number;
}> {
  const { rest, token } = params.opts ?? {};
  if (!rest && !token) {
    throw new Error("Discord auth required to list stickers");
  }
  const { resolveDiscordRest } = await import("../send.shared.js");
  const restClient = rest ?? resolveDiscordRest(token);
  const { Routes } = await import("discord-api-types/v10");

  const raw = await restClient.get(Routes.guildStickers(params.guildId));
  const stickers = Array.isArray(raw)
    ? raw
        .filter(
          (
            sticker,
          ): sticker is { id: string; name: string; description?: string; format_type: number } => {
            return (
              sticker &&
              typeof sticker === "object" &&
              typeof sticker.id === "string" &&
              typeof sticker.name === "string"
            );
          },
        )
        .map((sticker) => ({
          id: sticker.id,
          name: sticker.name,
          description: sticker.description,
          formatType: formatStickerType(sticker.format_type),
        }))
    : [];

  return {
    stickers,
    total: stickers.length,
  };
}

function formatStickerType(type: number): string {
  // Discord sticker format types
  switch (type) {
    case 1:
      return "PNG";
    case 2:
      return "APNG (animated)";
    case 3:
      return "Lottie (animated)";
    case 4:
      return "GIF (animated)";
    default:
      return "Unknown";
  }
}

/**
 * Searches for emojis by name or keyword.
 */
export function searchDiscordEmojis(params: {
  emojis: Array<{ id: string; name: string; animated: boolean; syntax: string }>;
  query: string;
}): Array<{ id: string; name: string; animated: boolean; syntax: string }> {
  const normalizedQuery = params.query.toLowerCase().trim();
  return params.emojis.filter((emoji) => emoji.name.toLowerCase().includes(normalizedQuery));
}
