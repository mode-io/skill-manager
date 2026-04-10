export type SkillStatus = "Managed" | "Unmanaged" | "Custom" | "Built-in";
export type HarnessCellState = "enabled" | "disabled" | "found" | "builtin" | "empty";
export type SkillUpdateStatus = "update_available" | "no_update_available" | "no_source_available";
export type SkillStopManagingStatus = "available" | "disabled_no_enabled";

export interface SkillsSummary {
  managed: number;
  unmanaged: number;
  custom: number;
  builtIn: number;
}

export interface HarnessColumn {
  harness: string;
  label: string;
  logoKey?: string | null;
}

export interface SkillRowActionsDto {
  canManage: boolean;
}

export interface HarnessCell {
  harness: string;
  label: string;
  logoKey?: string | null;
  state: HarnessCellState;
  interactive: boolean;
}

export interface SkillTableRowDto {
  skillRef: string;
  name: string;
  description: string;
  displayStatus: SkillStatus;
  attentionMessage: string | null;
  actions: SkillRowActionsDto;
  cells: HarnessCell[];
}

export interface SkillsPageDto {
  summary: SkillsSummary;
  harnessColumns: HarnessColumn[];
  rows: SkillTableRowDto[];
}

export interface SkillDetailActionsDto {
  canManage: boolean;
  stopManagingStatus: SkillStopManagingStatus | null;
  stopManagingHarnessLabels: string[];
  canDelete: boolean;
  deleteHarnessLabels: string[];
}

export interface SkillSourceStatusDto {
  updateStatus: SkillUpdateStatus | null;
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

export interface SkillSourceLinks {
  repoLabel: string;
  repoUrl: string;
  folderUrl: string | null;
}

export interface SkillDetailDto {
  skillRef: string;
  name: string;
  description: string;
  displayStatus: SkillStatus;
  attentionMessage: string | null;
  actions: SkillDetailActionsDto;
  harnessCells: HarnessCell[];
  locations: SkillLocation[];
  sourceLinks: SkillSourceLinks | null;
  documentMarkdown: string | null;
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
