import type { components } from "../../../api/generated";

export type EnableSkillRequest = components["schemas"]["EnableSkillRequest"];
export type DisableSkillRequest = components["schemas"]["DisableSkillRequest"];
export type SetSkillHarnessesRequest = components["schemas"]["SetSkillHarnessesRequest"];
export type OkResponse = components["schemas"]["OkResponse"];
export type SetSkillHarnessesFailureDto = components["schemas"]["SetSkillHarnessesFailureResponse"];
export type SetSkillHarnessesResultDto = components["schemas"]["SetSkillHarnessesResultResponse"];
export type SkillStatus = components["schemas"]["SkillTableRowResponse"]["displayStatus"];
export type HarnessCellState = components["schemas"]["HarnessCellResponse"]["state"];
export type SkillUpdateStatus = NonNullable<components["schemas"]["SkillSourceStatusResponse"]["updateStatus"]>;
export type SkillRemoveStatus = NonNullable<
  components["schemas"]["SkillDetailActionsResponse"]["stopManagingStatus"]
>;
export type SkillsSummary = components["schemas"]["SkillsSummaryResponse"];
export type HarnessColumn = components["schemas"]["HarnessColumnResponse"];
export type SkillRowActionsDto = components["schemas"]["SkillRowActionsResponse"];
export type HarnessCell = components["schemas"]["HarnessCellResponse"];
export type SkillTableRowDto = components["schemas"]["SkillTableRowResponse"];
export type SkillsPageDto = components["schemas"]["SkillsPageResponse"];
export type SkillDetailActionsDto = components["schemas"]["SkillDetailActionsResponse"];
export type SkillSourceStatusDto = components["schemas"]["SkillSourceStatusResponse"];
export type SkillLocation = components["schemas"]["SkillLocationResponse"];
export type SkillSourceLinks = components["schemas"]["SkillSourceLinksResponse"];
export type SkillDetailDto = components["schemas"]["SkillDetailResponse"];
export type BulkManageFailure = components["schemas"]["BulkManageFailureResponse"];
export type BulkManageResult = components["schemas"]["BulkManageResultResponse"];
