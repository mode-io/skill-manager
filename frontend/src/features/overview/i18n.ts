import { useLocalizedCopy, type CopyShape, type LocalizedCopy } from "../../i18n";

const englishOverviewCopy = {
  screen: {
    title: "Overview",
    unableToLoadOverview: "Unable to load overview data.",
    unableToLoadSkills: (message: string) => `Unable to load skills: ${message}`,
    unableToLoadSlashCommands: (message: string) => `Unable to load slash commands: ${message}`,
    unableToLoadMcpServers: (message: string) => `Unable to load MCP servers: ${message}`,
  },
  sections: {
    inventoryStatistics: "Inventory statistics",
    extensions: "Extensions",
    discover: "Discover",
    review: "Review",
    activeHarnesses: "Active harnesses",
    noReviewWaiting: "No local adoption or config review is waiting.",
    noHarnesses: "No harnesses have been discovered yet.",
    harness: "Harness",
    skills: "Skills",
    mcp: "MCP",
    needsReview: "Needs review",
    mcpUnavailable: "MCP unavailable",
    different: (count: number) => `${count.toLocaleString()} different`,
  },
  stats: {
    inUse: "In use",
    needsReview: "Needs review",
    harnesses: "Harnesses",
    metricPart: (value: number | null, singular: string, plural: string) =>
      `${value == null ? "-" : value.toLocaleString()} ${value === 1 ? singular : plural}`,
    inUseDetail: (skills: number | null, commands: number | null, mcp: number | null) =>
      [
        `${skills == null ? "-" : skills.toLocaleString()} ${skills === 1 ? "skill" : "skills"}`,
        `${commands == null ? "-" : commands.toLocaleString()} ${commands === 1 ? "command" : "commands"}`,
        `${mcp == null ? "-" : mcp.toLocaleString()} MCP`,
      ].join(" · "),
    needsReviewDetail: "adoption · config · inventory",
    harnessesDetail: (count: number | null) => `${count == null ? "-" : count.toLocaleString()} observed`,
  },
  extensions: {
    skills: "Skills",
    slashCommands: "Slash Commands",
    mcpServers: "MCP Servers",
    inUseFact: "in use",
    reviewFact: "review",
  },
  marketplace: {
    skills: "Skills Marketplace",
    mcp: "MCP Marketplace",
    cli: "CLI Marketplace",
    browse: "Browse",
    previewOnly: "Preview only",
  },
  reviewItems: {
    skillsLabel: "Skills to review",
    skillsDescription: "Adopt local skills so they can be enabled consistently.",
    slashCommandsLabel: "Slash commands",
    slashCommandsDescription: "Unmanaged, changed, or missing command files need a decision.",
    mcpConfigsLabel: "MCP configs to review",
    mcpConfigsDescription: "Adopt existing harness configs into Skill Manager.",
    differentMcpLabel: "Different MCP configs",
    differentMcpDescription: "Resolve which config should become the source of truth.",
    inventoryIssuesLabel: "MCP inventory issues",
    inventoryIssuesDescription: "Some Skill Manager MCP records could not be loaded cleanly.",
    unavailableHarnessLabel: "MCP harness unavailable",
    unavailableHarnessDescription: "At least one harness cannot safely receive MCP writes.",
  },
} as const;

export type OverviewCopy = CopyShape<typeof englishOverviewCopy>;

export const overviewCopy = {
  en: englishOverviewCopy,
  "zh-CN": {
    screen: {
      title: "总览",
      unableToLoadOverview: "无法加载总览数据。",
      unableToLoadSkills: (message: string) => `无法加载 Skill：${message}`,
      unableToLoadSlashCommands: (message: string) => `无法加载 Slash command：${message}`,
      unableToLoadMcpServers: (message: string) => `无法加载 MCP 服务器：${message}`,
    },
    sections: {
      inventoryStatistics: "库存统计",
      extensions: "扩展",
      discover: "发现",
      review: "确认",
      activeHarnesses: "活跃 harness",
      noReviewWaiting: "当前没有等待处理的本地采用或配置确认。",
      noHarnesses: "还没有发现任何 harness。",
      harness: "Harness",
      skills: "Skill",
      mcp: "MCP",
      needsReview: "待确认",
      mcpUnavailable: "MCP 不可用",
      different: (count: number) => `${count.toLocaleString()} 个不同配置`,
    },
    stats: {
      inUse: "使用中",
      needsReview: "待确认",
      harnesses: "Harness",
      metricPart: (value: number | null, singular: string) =>
        `${value == null ? "-" : value.toLocaleString()} ${singular}`,
      inUseDetail: (skills: number | null, commands: number | null, mcp: number | null) =>
        [
          `${skills == null ? "-" : skills.toLocaleString()} Skill`,
          `${commands == null ? "-" : commands.toLocaleString()} Slash command`,
          `${mcp == null ? "-" : mcp.toLocaleString()} MCP`,
        ].join(" · "),
      needsReviewDetail: "采用 · 配置 · 库存",
      harnessesDetail: (count: number | null) => `已发现 ${count == null ? "-" : count.toLocaleString()} 个`,
    },
    extensions: {
      skills: "Skill",
      slashCommands: "Slash command",
      mcpServers: "MCP 服务器",
      inUseFact: "使用中",
      reviewFact: "待确认",
    },
    marketplace: {
      skills: "Skill 商城",
      mcp: "MCP 商城",
      cli: "CLI 商城",
      browse: "浏览",
      previewOnly: "仅预览",
    },
    reviewItems: {
      skillsLabel: "待确认的 Skill",
      skillsDescription: "采用本地 Skill，方便统一启用到不同 harness。",
      slashCommandsLabel: "Slash command",
      slashCommandsDescription: "未托管、已变更或缺失的 command 文件需要确认。",
      mcpConfigsLabel: "待确认的 MCP 配置",
      mcpConfigsDescription: "将现有 harness 配置采用到 Skill Manager。",
      differentMcpLabel: "不同的 MCP 配置",
      differentMcpDescription: "确认哪一份配置应成为事实来源。",
      inventoryIssuesLabel: "MCP 库存问题",
      inventoryIssuesDescription: "部分 Skill Manager MCP 记录无法正常加载。",
      unavailableHarnessLabel: "MCP harness 不可用",
      unavailableHarnessDescription: "至少一个 harness 不能安全接收 MCP 写入。",
    },
  },
} satisfies LocalizedCopy<OverviewCopy>;

export function useOverviewCopy(): OverviewCopy {
  return useLocalizedCopy(overviewCopy);
}
