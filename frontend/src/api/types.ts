export type SkillStatus = "Managed" | "Found locally" | "Custom" | "Built-in";
export type SkillActionKind = "open" | "manage";
export type HarnessCellState = "enabled" | "disabled" | "found" | "builtin" | "empty";

export interface SkillsSummary {
  managed: number;
  foundLocally: number;
  custom: number;
  builtIn: number;
}

export interface HarnessColumn {
  harness: string;
  label: string;
}

export interface SkillAction {
  kind: SkillActionKind;
  label: string;
}

export interface HarnessCell {
  harness: string;
  label: string;
  state: HarnessCellState;
  interactive: boolean;
}

export interface SkillTableRow {
  skillRef: string;
  name: string;
  description: string;
  displayStatus: SkillStatus;
  attentionMessage: string | null;
  needsAttention: boolean;
  defaultSortRank: number;
  primaryAction: SkillAction;
  cells: HarnessCell[];
}

export interface SkillsPageData {
  summary: SkillsSummary;
  harnessColumns: HarnessColumn[];
  rows: SkillTableRow[];
}

export interface SkillSource {
  kind: string;
  label: string;
  locator: string;
}

export interface SkillActions {
  canManage: boolean;
  canToggle: boolean;
  canUpdate: boolean;
  updateAvailable: boolean | null;
}

export interface SkillHarnessDetail {
  harness: string;
  label: string;
  state: HarnessCellState;
  scopes: string[];
  paths: string[];
}

export interface SkillLocation {
  kind: "shared" | "harness" | "builtin";
  harness: string | null;
  label: string;
  scope: string | null;
  path: string | null;
  revision: string | null;
  sourceKind: string;
  sourceLocator: string;
  detail: string | null;
}

export interface SkillAdvanced {
  packageDir: string | null;
  packagePath: string | null;
  currentRevision: string | null;
  recordedRevision: string | null;
  sourceKind: string;
  sourceLocator: string;
}

export interface SkillDetail {
  skillRef: string;
  name: string;
  description: string;
  displayStatus: SkillStatus;
  statusMessage: string;
  attentionMessage: string | null;
  primaryAction: SkillAction;
  source: SkillSource;
  actions: SkillActions;
  harnesses: SkillHarnessDetail[];
  locations: SkillLocation[];
  advanced: SkillAdvanced;
}

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  sourceKind: string;
  sourceLocator: string;
  registry: string;
  github: MarketplaceGitHubIdentity | null;
}

export interface MarketplaceGitHubIdentity {
  repo: string | null;
  url: string | null;
  ownerLogin: string | null;
  avatarPath: string | null;
  stars: number;
}

export interface MarketplacePageResult {
  items: MarketplaceItem[];
  nextOffset: number | null;
  hasMore: boolean;
}

export interface SettingsHarness {
  harness: string;
  label: string;
  detected: boolean;
  manageable: boolean;
  builtinSupport: boolean;
  issues: string[];
  diagnostics: {
    discoveryMode: string;
    detectionDetails: string[];
  };
}

export interface SettingsData {
  harnesses: SettingsHarness[];
  storeIssues: string[];
  bulkActions: {
    canManageAll: boolean;
  };
}
