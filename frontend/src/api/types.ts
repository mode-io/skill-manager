export type SkillStatus = "Managed" | "Unmanaged" | "Custom" | "Built-in";
export type SkillActionKind = "open" | "manage";
export type HarnessCellState = "enabled" | "disabled" | "found" | "builtin" | "empty";

export interface SkillsSummary {
  managed: number;
  unmanaged: number;
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
  primaryAction: SkillAction;
  cells: HarnessCell[];
}

export interface SkillsPageData {
  summary: SkillsSummary;
  harnessColumns: HarnessColumn[];
  rows: SkillTableRow[];
}

export interface SkillActions {
  canManage: boolean;
  canUpdate: boolean;
  updateAvailable: boolean | null;
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
  attentionMessage: string | null;
  actions: SkillActions;
  locations: SkillLocation[];
  advanced: SkillAdvanced;
  documentMarkdown: string | null;
}

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  installs: number;
  stars: number | null;
  repoLabel: string;
  repoImageUrl: string | null;
  githubFolderUrl: string | null;
  skillsDetailUrl: string;
  installToken: string;
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

export interface BulkManageFailure {
  skillRef: string;
  name: string;
  error: string;
}

export interface BulkManageResult {
  ok: boolean;
  managedCount: number;
  skippedCount: number;
  failures: BulkManageFailure[];
}
