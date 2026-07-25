import { useLocalizedCopy, type CopyShape, type LocalizedCopy } from "../../i18n";

const englishPermissionsCopy = {
  inUse: {
    title: "Permissions in use",
    subtitle: "Apply a rule once across your harnesses, and resolve any that differ.",
    searchPlaceholder: "Search by ID, decision, scope or pattern...",
    searchLabel: "Search permissions",
    loading: "Loading permissions",
    unableToLoad: "Unable to load permissions.",
    noMatchesBody: "Adjust the search or filter to see other permissions.",
    emptyTitle: "No permissions in use yet",
    emptyBody: "Add a permission or enable one to see it here.",
    filters: {
      all: "All",
      enabled: "Applied",
      allHarnesses: "Applied everywhere",
      unbound: "Not applied",
      drifted: "Differs",
      aria: (label: string) => `Filter: ${label}`,
    },
    uninstall: {
      action: "Delete",
      title: (id: string) => `Delete ${id}?`,
      description: "Remove this permission from skill-manager and disable it on all harnesses.",
      singleDescription: "Remove this permission from skill-manager and disable it on all harnesses.",
      pending: "Deleting",
      fallbackName: "this permission",
    },
  },
  detail: {
    close: "Close details",
    closeShort: "Close",
    loading: "Loading...",
    unableTitle: "Unable to load permission details",
    about: "About",
    differentConfigsTitle: "Config differs",
    differentConfigsBody: "Choose which config Skill Manager should manage, then apply it to current bindings.",
    resolveConfig: "Resolve",
    bindings: "Bindings",
    uninstall: "Delete",
    skillManagerConfig: "Skill Manager config",
    decision: "Decision",
    scope: "Scope",
    pattern: "Pattern",
    openDetail: (id: string) => `Open detail for ${id}`,
    moreActions: (id: string) => `More actions for ${id}`,
    select: (id: string) => `Select ${id}`,
    deselect: (id: string) => `Deselect ${id}`,
    enabledStatus: {
      enabled: "Applied",
      disabled: "Not applied",
    },
    enabledStatusAria: (label: string) => `Status: ${label}`,
    matrix: {
      baseLabel: (id: string, harness: string) => `${id} on ${harness}`,
      enabledTooltip: (harness: string) => `Applied on ${harness}`,
      disabledTooltip: (harness: string) => `Not applied on ${harness}`,
      differentTooltip: (harness: string, detail: string) => `Config differs on ${harness}${detail}`,
      foundTooltip: (harness: string) => `Untracked on ${harness}`,
      disable: (label: string) => `Remove ${label}`,
      enable: (label: string) => `Apply ${label}`,
      resolveConfigFor: (label: string) => `Resolve config for ${label}`,
      openDetailFor: (label: string) => `Open details for ${label}`,
      unavailable: (label: string) => `Unavailable for ${label}`,
    },
  },
};

export type PermissionsCopy = typeof englishPermissionsCopy;

export const permissionsCopy = {
  en: englishPermissionsCopy,
  "zh-CN": englishPermissionsCopy,
};

export function usePermissionsCopy(): PermissionsCopy {
  return useLocalizedCopy(permissionsCopy);
}
