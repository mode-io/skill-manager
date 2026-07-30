export {
  useDeleteSkillMutation,
  useManageAllSkillsMutation,
  useManageSkillMutation,
  useSetSkillHarnessesMutation,
  useSkillDetailQuery,
  useSkillsListQuery,
  useSkillSourceStatusQuery,
  useToggleSkillMutation,
  useUnmanageSkillMutation,
  useUpdateSkillMutation,
} from "./api/queries";
export { invalidateSkillsQueries } from "./api/invalidation";
export { skillsKeys } from "./api/keys";
export { useSkillsCopy } from "./i18n";
export type {
  HarnessCell,
  HarnessColumn,
  SkillListRow,
  SkillsWorkspaceData,
} from "./model/types";
export { SkillsWorkspaceSessionProvider } from "./model/session";

export const skillsRoutes = {
  inUse: "/skills/use",
  needsReview: "/skills/review",
  scanConfig: "/scan-config",
  marketplace: "/marketplace/skills",
} as const;
