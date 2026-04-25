export {
  invalidateSettingsQueries,
  settingsKeys,
  useHarnessSupportMutation,
  useSettingsQuery,
} from "./queries";

export const settingsRoutes = {
  settings: "/settings",
} as const;
