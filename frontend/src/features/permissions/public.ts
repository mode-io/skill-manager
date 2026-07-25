export {
  useCreatePermissionMutation,
  useDisablePermissionMutation,
  useEnablePermissionMutation,
  usePermissionsInventoryQuery,
  usePermissionDetailQuery,
  usePromotePermissionMutation,
  useReconcilePermissionMutation,
  useSetPermissionHarnessesMutation,
  useUninstallPermissionMutation,
} from "./api/management-queries";
export { createPermission } from "./api/management-client";
export { invalidatePermissionsQueries } from "./api/invalidation";
export { permissionsManagementKeys } from "./api/keys";
export type {
  PermissionBindingDto,
  PermissionInventoryColumnDto,
  PermissionInventoryDto,
  PermissionInventoryEntryDto,
  PermissionSpecDto,
} from "./api/management-types";
export { isPermissionsHarnessAddressable } from "./model/selectors";

export const permissionsRoutes = {
  inUse: "/permissions/use",
  needsReview: "/permissions/review",
} as const;
