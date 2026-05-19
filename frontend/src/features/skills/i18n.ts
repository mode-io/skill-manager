import { useLocalizedCopy, type CopyShape, type LocalizedCopy } from "../../i18n";

const englishSkillsCopy = {
  inUse: {
    title: "Skills in use",
    viewModeAria: "Skills in use view mode",
    importFolder: "Import folder",
    importFolderComingSoon: "Import folder — coming soon",
    searchPlaceholder: "Search by name, tag, description...",
    searchLabel: "Search skills in use",
    loading: "Loading skills in use",
    unableToLoad: "Unable to load skills in use.",
    emptyTitle: "No skills in use yet",
    emptyBody:
      "Review local skill folders or install something from the marketplace to start controlling harness coverage here.",
    filterAria: (label: string) => `Filter: ${label}`,
    pills: {
      all: "All",
      enabled: "Enabled",
      allHarnesses: "Enabled on all",
      off: "Off",
    },
    viewModes: {
      grid: "Grid",
      board: "Board",
      matrix: "Matrix",
    },
  },
  review: {
    title: "Skills to review",
    subtitle: (count: number) =>
      count > 0
        ? `${count} skill${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} a review decision.`
        : "No local skill folders need review across your harnesses.",
    adoptAllEligible: "Adopt all eligible",
    adoptingAllSkills: "Adopting all skills",
    searchPlaceholder: "Search skills to review...",
    searchLabel: "Search skills to review",
    loading: "Loading skills to review",
    unableToLoad: "Unable to load skills to review.",
    emptyTitle: "Nothing needs review",
    emptyBody:
      "Your local harness folders are either already in use through Skill Manager or currently empty. Install from the marketplace to add new skills.",
  },
  filters: {
    noMatchTitle: "No skills match the current filters.",
    noMatchBody: "Adjust the search or filter controls to bring skills back into view.",
    clearFilters: "Clear Filters",
  },
  bulk: {
    delete: "Delete",
    confirmTitle: (count: number) => `Delete ${count} skill${count === 1 ? "" : "s"}?`,
    confirmDescription: "This removes the Skill Manager copy and its symlinks from every harness.",
    confirmNote: "The source on disk outside the Skill Manager store is not touched.",
  },
  confirm: {
    removeTitle: "Remove skill from Skill Manager?",
    removeDescription: (skillName: string) =>
      `This removes ${skillName} from the Skill Manager store and restores local copies only for the harnesses that are currently enabled.`,
    restoreTo: (labels: readonly string[]) => `Will restore to: ${labels.join(", ")}`,
    remove: "Remove",
    removing: "Removing",
    deleteTitle: "Delete skill from Skill Manager?",
    deleteDescription: (skillName: string) =>
      `This will remove ${skillName} from the shared store and delete its links from all harnesses.`,
    cannotUndo: "This action cannot be undone.",
    affectedHarnesses: (labels: readonly string[]) => `Affected harnesses: ${labels.join(", ")}`,
    delete: "Delete",
    deletingSkill: "Deleting skill",
  },
  detail: {
    unableToLoad: "Unable to load skill",
    close: "Close skill details",
    tryAgain: "Try selecting the skill again, or return to the list and reopen it.",
    sourceLinksAria: (label: string) => `Source links for ${label}`,
    openSkillFolder: "Open Skill Folder",
    loading: "Loading",
    about: "About",
    noDescription: "No description provided.",
    loadingDocument: "Loading document",
    noDocument: "No SKILL.md document is available for this entry.",
    harnesses: "Harnesses",
    locations: "Locations",
    storeNote:
      "Skill Manager Store is the canonical physical package. Tool locations are symlinks to it when enabled.",
    addToSkillManager: "Add to Skill Manager",
    managingSkill: "Managing skill",
    deleteSkill: "Delete Skill",
    canonicalPhysicalPackage: "Canonical physical package",
    symlinkToStore: "Symlink to Skill Manager Store",
    moreActions: (name: string) => `More actions for ${name}`,
    removeFromSkillManager: "Remove from Skill Manager",
    delete: "Delete",
    enableOnAll: "Enable on all",
    enableOnAllAria: "Enable on all harnesses",
    disableEverywhere: "Disable everywhere",
    inUseList: "Skills in use list",
    reviewList: "Skills to review list",
  },
} as const;

export type SkillsCopy = CopyShape<typeof englishSkillsCopy>;

export const skillsCopy = {
  en: englishSkillsCopy,
  "zh-CN": {
    inUse: {
      title: "使用中的 Skill",
      viewModeAria: "使用中的 Skill 视图模式",
      importFolder: "导入文件夹",
      importFolderComingSoon: "导入文件夹即将推出",
      searchPlaceholder: "按名称、标签或描述搜索...",
      searchLabel: "搜索使用中的 Skill",
      loading: "正在加载使用中的 Skill",
      unableToLoad: "无法加载使用中的 Skill。",
      emptyTitle: "还没有使用中的 Skill",
      emptyBody: "确认本地 Skill 文件夹，或从商城安装内容，然后在这里控制 harness 覆盖范围。",
      filterAria: (label: string) => `筛选：${label}`,
      pills: {
        all: "全部",
        enabled: "已启用",
        allHarnesses: "所有 harness 已启用",
        off: "关闭",
      },
      viewModes: {
        grid: "网格",
        board: "看板",
        matrix: "矩阵",
      },
    },
    review: {
      title: "待确认的 Skill",
      subtitle: (count: number) =>
        count > 0 ? `${count} 个 Skill 需要确认。` : "没有本地 Skill 文件夹需要在 harness 间确认。",
      adoptAllEligible: "采用全部可用项",
      adoptingAllSkills: "正在采用全部 Skill",
      searchPlaceholder: "搜索待确认的 Skill...",
      searchLabel: "搜索待确认的 Skill",
      loading: "正在加载待确认的 Skill",
      unableToLoad: "无法加载待确认的 Skill。",
      emptyTitle: "没有需要确认的内容",
      emptyBody:
        "你的本地 harness 文件夹要么已通过 Skill Manager 使用，要么当前为空。可以从商城安装新的 Skill。",
    },
    filters: {
      noMatchTitle: "没有 Skill 匹配当前筛选。",
      noMatchBody: "调整搜索或筛选条件，让 Skill 重新显示。",
      clearFilters: "清除筛选",
    },
    bulk: {
      delete: "删除",
      confirmTitle: (count: number) => `删除 ${count} 个 Skill？`,
      confirmDescription: "这会移除 Skill Manager 副本以及所有 harness 中的符号链接。",
      confirmNote: "Skill Manager 存储之外的磁盘来源不会被修改。",
    },
    confirm: {
      removeTitle: "从 Skill Manager 移除此 Skill？",
      removeDescription: (skillName: string) =>
        `这会从 Skill Manager 存储中移除 ${skillName}，并且只为当前已启用的 harness 恢复本地副本。`,
      restoreTo: (labels: readonly string[]) => `将恢复到：${labels.join(", ")}`,
      remove: "移除",
      removing: "移除中",
      deleteTitle: "从 Skill Manager 删除此 Skill？",
      deleteDescription: (skillName: string) =>
        `这会从共享存储中移除 ${skillName}，并删除所有 harness 中的链接。`,
      cannotUndo: "此操作无法撤销。",
      affectedHarnesses: (labels: readonly string[]) => `受影响的 harness：${labels.join(", ")}`,
      delete: "删除",
      deletingSkill: "正在删除 Skill",
    },
    detail: {
      unableToLoad: "无法加载 Skill",
      close: "关闭 Skill 详情",
      tryAgain: "请重新选择此 Skill，或回到列表后再次打开。",
      sourceLinksAria: (label: string) => `${label} 的来源链接`,
      openSkillFolder: "打开 Skill 文件夹",
      loading: "正在加载",
      about: "简介",
      noDescription: "没有提供描述。",
      loadingDocument: "正在加载文档",
      noDocument: "此条目没有可用的 SKILL.md 文档。",
      harnesses: "Harness",
      locations: "位置",
      storeNote: "Skill Manager Store 是规范的实体包。启用时，工具位置会以符号链接指向它。",
      addToSkillManager: "添加到 Skill Manager",
      managingSkill: "正在管理 Skill",
      deleteSkill: "删除 Skill",
      canonicalPhysicalPackage: "规范实体包",
      symlinkToStore: "指向 Skill Manager Store 的符号链接",
      moreActions: (name: string) => `${name} 的更多操作`,
      removeFromSkillManager: "从 Skill Manager 移除",
      delete: "删除",
      enableOnAll: "全部启用",
      enableOnAllAria: "在所有 harness 上启用",
      disableEverywhere: "全部停用",
      inUseList: "使用中的 Skill 列表",
      reviewList: "待确认的 Skill 列表",
    },
  },
} satisfies LocalizedCopy<SkillsCopy>;

export function useSkillsCopy(): SkillsCopy {
  return useLocalizedCopy(skillsCopy);
}
