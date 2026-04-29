export const slashCommandKeys = {
  all: ["slash-commands"] as const,
  list: () => ["slash-commands", "list"] as const,
};

export const SLASH_COMMANDS_STALE_TIME_MS = 10_000;
export const SLASH_COMMANDS_GC_TIME_MS = 5 * 60_000;
