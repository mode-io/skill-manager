import { useLocalizedCopy, type CopyShape, type LocalizedCopy } from "../../i18n";

const englishHooksCopy = {
  inUse: {
    title: "Hooks in use",
    subtitle: "Browse, enable, and remove hooks across your harnesses.",
    viewModeAria: "Hooks in use view mode",
    searchPlaceholder: "Search by ID, event or command...",
    searchLabel: "Search hooks",
    loading: "Loading hooks",
    unableToLoad: "Unable to load hooks.",
    noMatchesBody: "Adjust the search or filter to see other hooks.",
    emptyTitle: "No hooks in use yet",
    emptyBody: "Add a hook or enable one to see it here.",
    viewModes: {
      cards: "Cards",
      matrix: "Matrix",
    },
    filters: {
      all: "All",
      enabled: "Enabled",
      allHarnesses: "Enabled on all",
      unbound: "Unbound",
      drifted: "Different config",
      aria: (label: string) => `Filter: ${label}`,
    },
    uninstall: {
      action: "Delete",
      title: (id: string) => `Delete ${id}?`,
      description: "Remove this hook from skill-manager and disable it on all harnesses.",
      singleDescription: "Remove this hook from skill-manager and disable it on all harnesses.",
      pending: "Deleting",
      fallbackName: "this hook",
    },
  },
  detail: {
    close: "Close details",
    closeShort: "Close",
    loading: "Loading...",
    unableTitle: "Unable to load hook details",
    about: "About",
    differentConfigsTitle: "Different configs found",
    differentConfigsBody: "Choose which config Skill Manager should manage, then apply it to current bindings.",
    resolveConfig: "Resolve config",
    bindings: "Bindings",
    uninstall: "Delete",
    skillManagerConfig: "Skill Manager config",
    event: "Event",
    command: "Command",
    match: "Tool Category",
    timeout: "Timeout (seconds)",
    openDetail: (id: string) => `Open detail for ${id}`,
    moreActions: (id: string) => `More actions for ${id}`,
    select: (id: string) => `Select ${id}`,
    deselect: (id: string) => `Deselect ${id}`,
    enabledStatus: {
      enabled: "Enabled",
      disabled: "Disabled",
    },
    enabledStatusAria: (label: string) => `Status: ${label}`,
    matrix: {
      baseLabel: (id: string, harness: string) => `${id} on ${harness}`,
      enabledTooltip: (harness: string) => `Enabled on ${harness}`,
      disabledTooltip: (harness: string) => `Disabled on ${harness}`,
      differentTooltip: (harness: string, detail: string) => `Different configuration on ${harness}${detail}`,
      foundTooltip: (harness: string) => `Configured outside skill-manager on ${harness}`,
      disable: (label: string) => `Disable ${label}`,
      enable: (label: string) => `Enable ${label}`,
      resolveConfigFor: (label: string) => `Resolve config for ${label}`,
      openDetailFor: (label: string) => `Open details for ${label}`,
      unavailable: (label: string) => `Unavailable for ${label}`,
    },
  },
};

export type HooksCopy = typeof englishHooksCopy;

export const hooksCopy = {
  en: englishHooksCopy,
  "zh-CN": englishHooksCopy,
};

export function useHooksCopy(): HooksCopy {
  return useLocalizedCopy(hooksCopy);
}
