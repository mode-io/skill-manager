export {
  invalidateSlashCommandQueries,
  useCreateSlashCommandMutation,
  useDeleteSlashCommandMutation,
  useImportSlashCommandMutation,
  useSlashCommandsQuery,
  useSyncSlashCommandMutation,
  useUpdateSlashCommandMutation,
} from "./api/queries";
export type {
  SlashCommandDto,
  SlashCommandListDto,
  SlashCommandReviewDto,
  SlashSyncEntryDto,
  SlashTargetDto,
  SlashTargetId,
} from "./api/types";

export const slashCommandRoutes = {
  home: "/slash-commands/use",
  inUse: "/slash-commands/use",
  needsReview: "/slash-commands/review",
} as const;
