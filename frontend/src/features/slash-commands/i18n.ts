import { useLocalizedCopy, type CopyShape, type LocalizedCopy } from "../../i18n";
import type { SlashCommandReviewDto, SlashReviewAction } from "./api/types";

const englishSlashCommandsCopy = {
  inUse: {
    title: "Slash Commands",
    subtitle: "Create one global prompt and sync it into local slash command folders.",
    viewModeAria: "Slash commands view mode",
    newCommand: "New command",
    searchPlaceholder: "Search slash commands",
    searchLabel: "Search slash commands",
    loading: "Loading slash commands",
    unableToLoad: "Unable to load slash commands.",
    viewModes: {
      grid: "Grid",
      board: "Board",
      matrix: "Matrix",
    },
    deleteTitle: (name: string) => `Delete ${name}?`,
    deleteDescription: "This removes the source command and generated command files from every synced target.",
    deleting: "Deleting",
    bulkDeleteTitle: (count: number) => `Delete ${count} slash command${count === 1 ? "" : "s"}?`,
    bulkDeleteDescription:
      "This removes the source command and generated command files for every selected slash command.",
  },
  review: {
    title: "Slash commands to review",
    subtitle: (count: number) =>
      count > 0
        ? `${count} command${count === 1 ? "" : "s"} found outside normal managed state.`
        : "No unmanaged, changed, or missing slash command files were found.",
    adoptAllEligible: "Adopt all eligible",
    adoptingAllCommands: "Adopting all commands",
    searchPlaceholder: "Search slash commands to review",
    searchLabel: "Search slash commands to review",
    loading: "Loading slash commands to review",
    listAria: "Slash commands to review list",
    emptyTitle: "Nothing needs review",
    emptyBody:
      "Slash command files in target folders are already managed or no supported target folders contain commands.",
    cannotUpdate: "Cannot update",
    actionLabel: (action: SlashReviewAction | null) => {
      if (action === "restore_managed") return "Restore";
      if (action === "adopt_target") return "Adopt";
      if (action === "remove_binding") return "Remove binding";
      if (action === "import") return "Adopt";
      return "Review";
    },
    actionTitle: (action: SlashReviewAction) => {
      if (action === "restore_managed") return "Restore the managed command content to this harness";
      if (action === "adopt_target") return "Use this harness command as the managed command content";
      if (action === "remove_binding") return "Stop tracking this harness command without deleting it";
      return "Adopt this command into Skill Manager";
    },
    metaText: (row: SlashCommandReviewDto) => {
      if (row.kind === "drifted") return `Changed in ${row.targetLabel}`;
      if (row.kind === "missing") return `Missing from ${row.targetLabel}`;
      return `Found in ${row.targetLabel}`;
    },
  },
  detail: {
    listEmptyTitle: "No slash commands yet",
    listEmptyBody: "Create one command and sync it into your local AI tools.",
    listAria: "Slash commands in use list",
    delete: "Delete",
    moreActions: (name: string) => `More actions for ${name}`,
    select: (name: string) => `Select ${name}`,
    deselect: (name: string) => `Deselect ${name}`,
    activeOnTargets: (active: number, total: number) => `Active on ${active} of ${total} targets`,
    enableTargetFor: (target: string, name: string) => `Enable ${target} for ${name}`,
    disableTargetFor: (target: string, name: string) => `Disable ${target} for ${name}`,
    notSelected: "not selected",
    enableOnAllTargets: "Enable on all targets",
    enableOnAll: "Enable on all",
    disableEverywhere: "Disable everywhere",
    close: "Close slash command detail",
    actionsAria: "Slash command actions",
    edit: "Edit",
    harnesses: "Harnesses",
    harnessesFor: (name: string) => `Harnesses for ${name}`,
    enabled: "Enabled",
    disabled: "Disabled",
    enable: "Enable",
    disable: "Disable",
    locations: "Locations",
    noHarnessLocations: "No harness locations are enabled.",
    written: "Written",
    description: "Description",
    prompt: "Prompt",
    noDescription: "No description provided.",
    noPrompt: "No prompt content.",
    form: {
      createTitle: "New slash command",
      editTitle: "Edit command",
      description: "Save one prompt and sync it into selected global command folders.",
      close: "Close",
      name: "Name",
      nameError: "Use lowercase letters, numbers, and hyphens, for example code-review.",
      descriptionLabel: "Description",
      descriptionPlaceholder: "Review code for bugs and security risks",
      prompt: "Prompt",
      promptPlaceholder: "Review the following content:\n\n$ARGUMENTS",
      harnesses: "Harnesses",
      cancel: "Cancel",
      create: "Create",
      save: "Save",
    },
    review: {
      actionsAria: "Slash command review actions",
      conflictNotice:
        "A managed slash command already uses this name. Adopting the harness command will replace the Skill Manager source.",
      driftedNotice:
        "The harness command changed after Skill Manager last synced it. Restore writes the Skill Manager source back to the harness; Adopt updates Skill Manager from this harness command.",
      canonicalGapNotice:
        "The review entry says this command is managed, but the canonical command is not present in the current slash command list.",
      harnessContext: (name: string) => `Harness review context for ${name}`,
      noDescriptionParsed: "No description parsed.",
      noPromptParsed: "No prompt content parsed.",
      skillManagerSource: "Skill Manager source",
      noCanonicalContent: "No canonical command content is available.",
      harnessCommand: "Harness command",
      path: "Path",
      notPresent: "Not present",
      adoptHint: "Adopt this command to manage it",
      resolveHint: "Resolve from footer",
      changedInHarness: "Changed in harness",
      missingFromHarness: "Missing from harness",
      foundInHarness: "Found in harness",
    },
  },
} as const;

export type SlashCommandsCopy = CopyShape<typeof englishSlashCommandsCopy>;

export const slashCommandsCopy = {
  en: englishSlashCommandsCopy,
  "zh-CN": {
    inUse: {
      title: "Slash command",
      subtitle: "创建一个全局 prompt，并同步到本地 slash command 文件夹。",
      viewModeAria: "Slash command 视图模式",
      newCommand: "新建 command",
      searchPlaceholder: "搜索 Slash command",
      searchLabel: "搜索 Slash command",
      loading: "正在加载 Slash command",
      unableToLoad: "无法加载 Slash command。",
      viewModes: {
        grid: "网格",
        board: "看板",
        matrix: "矩阵",
      },
      deleteTitle: (name: string) => `删除 ${name}？`,
      deleteDescription: "这会移除源 command，以及每个已同步目标中的生成 command 文件。",
      deleting: "删除中",
      bulkDeleteTitle: (count: number) => `删除 ${count} 个 Slash command？`,
      bulkDeleteDescription: "这会移除所有已选择 Slash command 的源 command 和生成文件。",
    },
    review: {
      title: "待确认的 Slash command",
      subtitle: (count: number) =>
        count > 0 ? `${count} 个 command 处于非正常托管状态。` : "没有发现未托管、已变更或缺失的 slash command 文件。",
      adoptAllEligible: "采用全部可用项",
      adoptingAllCommands: "正在采用全部 command",
      searchPlaceholder: "搜索待确认的 Slash command",
      searchLabel: "搜索待确认的 Slash command",
      loading: "正在加载待确认的 Slash command",
      listAria: "待确认的 Slash command 列表",
      emptyTitle: "没有需要确认的内容",
      emptyBody: "目标文件夹中的 Slash command 文件已被托管，或支持的目标文件夹中没有 command。",
      cannotUpdate: "无法更新",
      actionLabel: (action: SlashReviewAction | null) => {
        if (action === "restore_managed") return "恢复";
        if (action === "adopt_target") return "采用";
        if (action === "remove_binding") return "移除绑定";
        if (action === "import") return "采用";
        return "确认";
      },
      actionTitle: (action: SlashReviewAction) => {
        if (action === "restore_managed") return "将托管 command 内容恢复到此 harness";
        if (action === "adopt_target") return "使用此 harness command 作为托管内容";
        if (action === "remove_binding") return "停止跟踪此 harness command，但不删除文件";
        return "将此 command 采用到 Skill Manager";
      },
      metaText: (row: SlashCommandReviewDto) => {
        if (row.kind === "drifted") return `${row.targetLabel} 中有变更`;
        if (row.kind === "missing") return `${row.targetLabel} 中缺失`;
        return `发现于 ${row.targetLabel}`;
      },
    },
    detail: {
      listEmptyTitle: "还没有 Slash command",
      listEmptyBody: "创建一个 command，并同步到本地 AI 工具。",
      listAria: "使用中的 Slash command 列表",
      delete: "删除",
      moreActions: (name: string) => `${name} 的更多操作`,
      select: (name: string) => `选择 ${name}`,
      deselect: (name: string) => `取消选择 ${name}`,
      activeOnTargets: (active: number, total: number) => `${total} 个 target 中已启用 ${active} 个`,
      enableTargetFor: (target: string, name: string) => `为 ${name} 启用 ${target}`,
      disableTargetFor: (target: string, name: string) => `为 ${name} 停用 ${target}`,
      notSelected: "未选择",
      enableOnAllTargets: "在所有 target 上启用",
      enableOnAll: "全部启用",
      disableEverywhere: "全部停用",
      close: "关闭 Slash command 详情",
      actionsAria: "Slash command 操作",
      edit: "编辑",
      harnesses: "Harness",
      harnessesFor: (name: string) => `${name} 的 harness`,
      enabled: "已启用",
      disabled: "已停用",
      enable: "启用",
      disable: "停用",
      locations: "位置",
      noHarnessLocations: "没有已启用的 harness 位置。",
      written: "已写入",
      description: "描述",
      prompt: "Prompt",
      noDescription: "没有提供描述。",
      noPrompt: "没有 prompt 内容。",
      form: {
        createTitle: "新建 Slash command",
        editTitle: "编辑 command",
        description: "保存一个 prompt，并同步到所选全局 command 文件夹。",
        close: "关闭",
        name: "名称",
        nameError: "请使用小写字母、数字和连字符，例如 code-review。",
        descriptionLabel: "描述",
        descriptionPlaceholder: "检查代码中的 bug 和安全风险",
        prompt: "Prompt",
        promptPlaceholder: "Review the following content:\n\n$ARGUMENTS",
        harnesses: "Harness",
        cancel: "取消",
        create: "创建",
        save: "保存",
      },
      review: {
        actionsAria: "Slash command 确认操作",
        conflictNotice:
          "已有托管 Slash command 使用此名称。采用 harness command 会替换 Skill Manager 来源。",
        driftedNotice:
          "此 harness command 在 Skill Manager 上次同步后发生变化。恢复会把 Skill Manager 来源写回 harness；采用会用此 harness command 更新 Skill Manager。",
        canonicalGapNotice:
          "确认条目显示此 command 已托管，但当前 Slash command 列表中没有规范 command。",
        harnessContext: (name: string) => `${name} 的 harness 确认上下文`,
        noDescriptionParsed: "没有解析到描述。",
        noPromptParsed: "没有解析到 prompt 内容。",
        skillManagerSource: "Skill Manager 来源",
        noCanonicalContent: "没有可用的规范 command 内容。",
        harnessCommand: "Harness command",
        path: "路径",
        notPresent: "不存在",
        adoptHint: "采用此 command 以开始管理",
        resolveHint: "从底部操作中解决",
        changedInHarness: "Harness 中有变更",
        missingFromHarness: "Harness 中缺失",
        foundInHarness: "Harness 中发现",
      },
    },
  },
} satisfies LocalizedCopy<SlashCommandsCopy>;

export function useSlashCommandsCopy(): SlashCommandsCopy {
  return useLocalizedCopy(slashCommandsCopy);
}
