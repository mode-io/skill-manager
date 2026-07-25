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
export type {
  HarnessCell,
  HarnessColumn,
  SkillListRow,
  SkillsWorkspaceData,
} from "./model/types";

export const skillsRoutes = {
  inUse: "/skills/use",
  needsReview: "/skills/review",
  marketplace: "/marketplace/skills",
} as const;
