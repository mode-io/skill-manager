export {
  invalidateSettingsQueries,
  settingsKeys,
  useHarnessSupportMutation,
  useSettingsQuery,
} from "./api/queries";

export const settingsRoutes = {
  settings: "/settings",
} as const;
