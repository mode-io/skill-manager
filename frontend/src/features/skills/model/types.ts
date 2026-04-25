import type {
  BulkManageResult as BulkManageResultDto,
  HarnessCell as HarnessCellDto,
  HarnessCellState as HarnessCellStateDto,
  HarnessColumn as HarnessColumnDto,
  SkillRowActionsDto,
  SkillLocation as SkillLocationDto,
  SkillSourceLinks as SkillSourceLinksDto,
  SkillStatus as SkillStatusDto,
  SkillsSummary as SkillsSummaryDto,
  SkillDetailActionsDto,
  SkillRemoveStatus as SkillRemoveStatusDto,
  SkillSourceStatusDto,
  SkillUpdateStatus as SkillUpdateStatusDto,
} from "../api/types";

export type SkillStatus = SkillStatusDto;
export type HarnessCellState = HarnessCellStateDto;
export type SkillUpdateStatus = SkillUpdateStatusDto;
export type SkillRemoveStatus = SkillRemoveStatusDto;
export type SkillsSummary = SkillsSummaryDto;
export type HarnessColumn = HarnessColumnDto;
export type HarnessCell = HarnessCellDto;
export type SkillRowActions = SkillRowActionsDto;
export type SkillLocation = SkillLocationDto;
export type SkillSourceLinks = SkillSourceLinksDto;
export type BulkManageResult = BulkManageResultDto;

export interface SkillListRow {
  skillRef: string;
  name: string;
  description: string;
  displayStatus: SkillStatus;
  actions: SkillRowActions;
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
