import { useLocalizedCopy, type CopyShape, type LocalizedCopy } from "../../i18n";

const englishSettingsCopy = {
  title: "Settings",
  subtitle: "Local paths and per-harness discovery.",
  loading: "Loading settings",
  storage: {
    heading: "Local storage",
    storeTitle: "Skill Manager store",
    storeSubtitle: "Canonical copies of skills in use live here.",
    cacheTitle: "Marketplace cache",
    cacheSubtitle: "Downloaded previews and install bundles.",
  },
  harnesses: {
    heading: "Harness roots",
    detected: "Detected on this machine",
    notDetected: "Not detected on this machine",
    enableSupport: (label: string) => `Enable ${label} support`,
    saving: "Saving...",
  },
  errors: {
    unableToLoad: "Unable to load settings.",
    unableToUpdateHarnessSupport: "Unable to update harness support.",
  },
} as const;

export type SettingsCopy = CopyShape<typeof englishSettingsCopy>;

export const settingsCopy = {
  en: englishSettingsCopy,
  "zh-CN": {
    title: "设置",
    subtitle: "本地路径和每个 harness 的发现设置。",
    loading: "正在加载设置",
    storage: {
      heading: "本地存储",
      storeTitle: "Skill Manager 存储",
      storeSubtitle: "使用中的 Skill 会以规范副本保存在这里。",
      cacheTitle: "商城缓存",
      cacheSubtitle: "已下载的预览和安装包。",
    },
    harnesses: {
      heading: "Harness 根目录",
      detected: "已在这台机器上检测到",
      notDetected: "未在这台机器上检测到",
      enableSupport: (label: string) => `启用 ${label} 支持`,
      saving: "保存中...",
    },
    errors: {
      unableToLoad: "无法加载设置。",
      unableToUpdateHarnessSupport: "无法更新 harness 支持状态。",
    },
  },
} satisfies LocalizedCopy<SettingsCopy>;

export function useSettingsCopy(): SettingsCopy {
  return useLocalizedCopy(settingsCopy);
}
