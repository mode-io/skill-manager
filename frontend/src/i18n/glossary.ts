import { useLocalizedCopy, type CopyShape, type LocalizedCopy } from "./locales";

const englishGlossary = {
  skill: "Skill",
  skills: "Skills",
  mcp: "MCP",
  mcpServer: "MCP Server",
  mcpServers: "MCP Servers",
  cli: "CLI",
  clis: "CLIs",
  slashCommand: "Slash command",
  slashCommands: "Slash Commands",
  skillManager: "Skill Manager",
  marketplace: "Marketplace",
} as const;

export type GlossaryCopy = CopyShape<typeof englishGlossary>;

export const glossaryCopy = {
  en: englishGlossary,
  "zh-CN": {
    skill: "Skill",
    skills: "Skill",
    mcp: "MCP",
    mcpServer: "MCP 服务器",
    mcpServers: "MCP 服务器",
    cli: "CLI",
    clis: "CLI",
    slashCommand: "Slash command",
    slashCommands: "Slash command",
    skillManager: "Skill Manager",
    marketplace: "商城",
  },
} satisfies LocalizedCopy<GlossaryCopy>;

export function useGlossary(): GlossaryCopy {
  return useLocalizedCopy(glossaryCopy);
}
