import { useLocalizedCopy, type CopyShape, type LocalizedCopy } from "./locales";

const englishCommonCopy = {
  actions: {
    cancel: "Cancel",
    refresh: "Refresh",
    refreshing: "Refreshing",
    clearFilters: "Clear filters",
    clearSearch: "Clear search",
    clearSelection: "Clear selection",
    enableAll: "Enable all",
    disableAll: "Disable all",
    enabling: "Enabling",
    disabling: "Disabling",
    delete: "Delete",
    browseMarketplace: "Browse marketplace",
    openMarketplace: "Open Marketplace",
    reviewItems: "Review items",
  },
  nav: {
    primary: "Primary navigation",
    overview: "Overview",
    skills: "Skills",
    slashCommands: "Slash Commands",
    mcpServers: "MCP Servers",
    marketplace: "Marketplace",
    clis: "CLIs",
    settings: "Settings",
    light: "Light",
    lightComingSoon: "Light theme — coming soon",
  },
  language: {
    label: "Language",
    selected: "Selected",
    ariaLabel: (current: string) => `Language: ${current}`,
  },
  productLanguage: {
    inUse: "In use",
    needsReview: "Needs review",
    review: "Review",
    discover: "Discover",
  },
  loading: {
    overview: "Loading overview",
    mcp: "Loading MCP",
    marketplace: "Loading marketplace",
    slashCommands: "Loading slash commands",
    settings: "Loading settings",
    document: "Loading document",
  },
  search: {
    placeholder: "Search...",
    label: "Filter search",
    filterOptions: "Filter options",
  },
  bulk: {
    ariaLabel: "Bulk actions",
    selected: (count: number) => `${count} selected`,
    selectedAction: (action: string, count: number) => `${action} ${count} selected`,
  },
  status: {
    noMatches: "No matches",
    unknownError: "Unknown error",
  },
} as const;

export type CommonCopy = CopyShape<typeof englishCommonCopy>;

export const commonCopy = {
  en: englishCommonCopy,
  "zh-CN": {
    actions: {
      cancel: "取消",
      refresh: "刷新",
      refreshing: "刷新中",
      clearFilters: "清除筛选",
      clearSearch: "清除搜索",
      clearSelection: "清除选择",
      enableAll: "全部启用",
      disableAll: "全部停用",
      enabling: "启用中",
      disabling: "停用中",
      delete: "删除",
      browseMarketplace: "浏览商城",
      openMarketplace: "打开商城",
      reviewItems: "查看待确认项",
    },
    nav: {
      primary: "主导航",
      overview: "总览",
      skills: "Skill",
      slashCommands: "Slash command",
      mcpServers: "MCP 服务器",
      marketplace: "商城",
      clis: "CLI",
      settings: "设置",
      light: "浅色",
      lightComingSoon: "浅色主题即将推出",
    },
    language: {
      label: "语言",
      selected: "当前语言",
      ariaLabel: (current: string) => `语言：${current}`,
    },
    productLanguage: {
      inUse: "使用中",
      needsReview: "待确认",
      review: "确认",
      discover: "发现",
    },
    loading: {
      overview: "正在加载总览",
      mcp: "正在加载 MCP",
      marketplace: "正在加载商城",
      slashCommands: "正在加载 Slash command",
      settings: "正在加载设置",
      document: "正在加载文档",
    },
    search: {
      placeholder: "搜索...",
      label: "筛选搜索",
      filterOptions: "筛选选项",
    },
    bulk: {
      ariaLabel: "批量操作",
      selected: (count: number) => `已选择 ${count} 项`,
      selectedAction: (action: string, count: number) => `${action}已选择的 ${count} 项`,
    },
    status: {
      noMatches: "没有匹配结果",
      unknownError: "未知错误",
    },
  },
} satisfies LocalizedCopy<CommonCopy>;

export function useCommonCopy(): CommonCopy {
  return useLocalizedCopy(commonCopy);
}
