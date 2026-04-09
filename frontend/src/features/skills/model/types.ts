import type {
  BulkManageResult as BulkManageResultDto,
  HarnessCell as HarnessCellDto,
  HarnessCellState as HarnessCellStateDto,
  HarnessColumn as HarnessColumnDto,
  SkillDetailDto,
  SkillLocation as SkillLocationDto,
  SkillSourceLinks as SkillSourceLinksDto,
  SkillStatus as SkillStatusDto,
  SkillsSummary as SkillsSummaryDto,
  SkillDetailActionsDto,
  SkillStopManagingStatus as SkillStopManagingStatusDto,
  SkillSourceStatusDto,
  SkillUpdateStatus as SkillUpdateStatusDto,
} from "../api/types";

export type SkillStatus = SkillStatusDto;
export type HarnessCellState = HarnessCellStateDto;
export type SkillUpdateStatus = SkillUpdateStatusDto;
export type SkillStopManagingStatus = SkillStopManagingStatusDto;
export type SkillsSummary = SkillsSummaryDto;
export type HarnessColumn = HarnessColumnDto;
export type HarnessCell = HarnessCellDto;
export type SkillLocation = SkillLocationDto;
export type SkillSourceLinks = SkillSourceLinksDto;
export type BulkManageResult = BulkManageResultDto;

export interface SkillListRow {
  skillRef: string;
  name: string;
  description: string;
  displayStatus: SkillStatus;
  attentionMessage: string | null;
  canManage: boolean;
  cells: HarnessCell[];
}

export interface SkillsWorkspaceData {
  summary: SkillsSummary;
  harnessColumns: HarnessColumn[];
  rows: SkillListRow[];
}

export interface SkillActions extends SkillDetailActionsDto {
  updateStatus: SkillSourceStatusDto["updateStatus"];
}

export interface SkillDetail {
  skillRef: string;
  name: string;
  description: string;
  displayStatus: SkillStatus;
  attentionMessage: string | null;
  actions: SkillActions;
  harnessCells: HarnessCell[];
  locations: SkillLocation[];
  sourceLinks: SkillSourceLinks | null;
  documentMarkdown: string | null;
}
