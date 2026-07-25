import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { ConfirmActionDialog } from "../../../components/ConfirmActionDialog";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { useCommonCopy } from "../../../i18n";
import { usePermissionsCopy } from "../i18n";
import { PermissionsMatrixView } from "../components/PermissionsMatrixView";
import { PermissionDetailSheet } from "../components/detail/PermissionDetailSheet";
import { PermissionFormDialog } from "../components/edit/PermissionFormDialog";
import { PermissionsFilterMenu } from "../components/PermissionsFilterMenu";
import {
  filterPermissionsInUse,
  pillCounts,
  type InUsePillValue,
} from "../model/selectors";
import { usePermissionsManagementController } from "../model/use-permissions-management-controller";

const DETAIL_PARAM = "permission";

export default function PermissionsInUsePage() {
  const {
    status,
    inventory,
    isInitialLoading,
    selectedPermissionId,
    setSelectedPermissionId,
    pendingPermissionKeys,
    pendingPerHarnessKeys,
    queryErrorMessage,
    actionErrorMessage,
    clearActionError,
    handleUninstallPermission,
    handleToggleHarness,
    handleReconcilePermission,
    handleCreatePermission,
  } = usePermissionsManagementController();

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get(DETAIL_PARAM);
  const [confirmUninstallId, setConfirmUninstallId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addPending, setAddPending] = useState(false);

  const [search, setSearch] = useState("");
  const [pill, setPill] = useState<InUsePillValue>("all");
  const copy = usePermissionsCopy();
  const common = useCommonCopy();

  const entries = useMemo(
    () => filterPermissionsInUse(inventory, { search, pill }),
    [inventory, search, pill],
  );
  const counts = useMemo(() => pillCounts(inventory), [inventory]);
  const totalInUse = inventory?.entries.filter((e) => e.kind === "managed").length ?? 0;
  const isReady = status === "ready" && Boolean(inventory);

  const setDetailId = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (id) {
        next.set(DETAIL_PARAM, id);
      } else {
        next.delete(DETAIL_PARAM);
      }
      setSearchParams(next, { replace: !id });
    },
    [searchParams, setSearchParams],
  );

  const pendingForSelected = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const result = new Set<string>();
    for (const key of pendingPerHarnessKeys) {
      const [id, harness] = key.split(":", 2);
      if (id === selectedId) result.add(harness);
    }
    return result;
  }, [pendingPerHarnessKeys, selectedId]);

  const isUninstallingSelected =
    selectedId !== null && pendingPermissionKeys.has(selectedId);
  const isPermissionPendingSelected =
    selectedId !== null && pendingPermissionKeys.has(selectedId);

  const handleCreatePermissionSubmit = async (value: {
    id: string;
    decision: string;
    scope: string;
    pattern: string | null;
    description: string;
  }) => {
    setAddPending(true);
    try {
      await handleCreatePermission(value);
      setAddDialogOpen(false);
    } finally {
      setAddPending(false);
    }
  };

  const executeUninstall = useCallback(async () => {
    const target = confirmUninstallId;
    if (!target) return;
    setConfirmUninstallId(null);
    await handleUninstallPermission(target);
    if (selectedId === target) {
      setDetailId(null);
    }
  }, [confirmUninstallId, handleUninstallPermission, selectedId, setDetailId]);

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title={copy.inUse.title}
          subtitle={copy.inUse.subtitle}
          actions={
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus size={16} style={{ marginRight: "4px" }} />
              Add Permission
            </button>
          }
        />
        {totalInUse > 0 ? (
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={copy.inUse.searchPlaceholder}
            searchLabel={copy.inUse.searchLabel}
            trailing={<PermissionsFilterMenu pill={pill} counts={counts} onChange={setPill} />}
          />
        ) : null}
      </div>

      {actionErrorMessage ? (
        <ErrorBanner message={actionErrorMessage} onDismiss={clearActionError} />
      ) : null}

      {isInitialLoading ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label={copy.inUse.loading} />
        </div>
      ) : status === "error" ? (
        <div className="panel-state">{queryErrorMessage || copy.inUse.unableToLoad}</div>
      ) : isReady && inventory ? (
        entries.length > 0 ? (
          <PermissionsMatrixView
            entries={entries}
            columns={inventory.columns}
            pendingPermissionKeys={pendingPermissionKeys}
            pendingPerHarnessKeys={pendingPerHarnessKeys}
            onOpenDetail={setDetailId}
            onEnableHarness={(id, harness) => {
              void handleToggleHarness(id, harness, false);
            }}
            onDisableHarness={(id, harness) => {
              void handleToggleHarness(id, harness, true);
            }}
          />
        ) : totalInUse > 0 ? (
          <div className="empty-panel">
            <h3 className="empty-panel__title">{common.status.noMatches}</h3>
            <p className="empty-panel__body">
              {copy.inUse.noMatchesBody}
            </p>
            <div className="empty-panel__actions">
              <button
                type="button"
                className="action-pill action-pill--md"
                onClick={() => {
                  setSearch("");
                  setPill("all");
                }}
              >
                {common.actions.clearFilters}
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-panel">
            <h3 className="empty-panel__title">{copy.inUse.emptyTitle}</h3>
            <p className="empty-panel__body">
              {copy.inUse.emptyBody}
            </p>
            <div className="empty-panel__actions">
              <button
                type="button"
                className="action-pill action-pill--md action-pill--accent"
                onClick={() => setAddDialogOpen(true)}
              >
                Add Permission
              </button>
            </div>
          </div>
        )
      ) : null}

      {inventory ? (
        <PermissionDetailSheet
          id={selectedId}
          columns={inventory.columns}
          pendingPerHarness={pendingForSelected}
          isServerPending={isPermissionPendingSelected}
          isUninstalling={isUninstallingSelected}
          onClose={() => setDetailId(null)}
          onEnableHarness={(harness) => {
            if (selectedId) void handleToggleHarness(selectedId, harness, false);
          }}
          onDisableHarness={(harness) => {
            if (selectedId) void handleToggleHarness(selectedId, harness, true);
          }}
          onResolveConfig={(args) => {
            if (!selectedId) return Promise.resolve();
            return handleReconcilePermission({ id: selectedId, ...args });
          }}
          onUninstall={() => {
            if (selectedId) setConfirmUninstallId(selectedId);
          }}
        />
      ) : null}

      <PermissionFormDialog
        open={addDialogOpen}
        pending={addPending}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleCreatePermissionSubmit}
      />

      <ConfirmActionDialog
        open={confirmUninstallId !== null}
        title={copy.inUse.uninstall.title(confirmUninstallId ?? "")}
        description={copy.inUse.uninstall.singleDescription}
        confirmLabel={copy.inUse.uninstall.action}
        pendingLabel={copy.inUse.uninstall.pending}
        isPending={false}
        onOpenChange={(open) => {
          if (!open) setConfirmUninstallId(null);
        }}
        onConfirm={executeUninstall}
      />
    </>
  );
}
