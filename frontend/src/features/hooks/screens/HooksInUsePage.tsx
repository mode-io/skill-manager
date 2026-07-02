import { useCallback, useMemo, useState } from "react";
import { Grid2X2, Rows3, Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { ConfirmActionDialog } from "../../../components/ConfirmActionDialog";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { ViewModeToggle, type ViewModeOption } from "../../../components/ViewModeToggle";
import { useCommonCopy } from "../../../i18n";
import { useHooksCopy } from "../i18n";
import { HookCardList } from "../components/HookCardList";
import { HooksMatrixView } from "../components/HooksMatrixView";
import { HookDetailSheet } from "../components/detail/HookDetailSheet";
import { HookFormDialog } from "../components/edit/HookFormDialog";
import { HooksFilterMenu } from "../components/HooksFilterMenu";
import {
  filterHooksInUse,
  pillCounts,
  type InUsePillValue,
} from "../model/selectors";
import { useHooksManagementController } from "../model/use-hooks-management-controller";
import { useHooksInUseViewMode, type HooksInUseViewMode } from "../model/useHooksInUseViewMode";

const DETAIL_PARAM = "hook";

export default function HooksInUsePage() {
  const {
    status,
    inventory,
    isInitialLoading,
    selectedHookId,
    setSelectedHookId,
    pendingHookKeys,
    pendingPerHarnessKeys,
    queryErrorMessage,
    actionErrorMessage,
    clearActionError,
    handleSetHookHarnesses,
    handleUninstallHook,
    handleToggleHarness,
    handleReconcileHook,
    handleCreateHook,
  } = useHooksManagementController();

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get(DETAIL_PARAM);
  const [confirmUninstallId, setConfirmUninstallId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addPending, setAddPending] = useState(false);

  const [search, setSearch] = useState("");
  const [pill, setPill] = useState<InUsePillValue>("all");
  const [viewMode, setViewMode] = useHooksInUseViewMode();
  const copy = useHooksCopy();
  const common = useCommonCopy();

  const viewModeOptions: readonly ViewModeOption<HooksInUseViewMode>[] = useMemo(
    () => [
      { value: "cards", label: copy.inUse.viewModes.cards, icon: Grid2X2 },
      { value: "matrix", label: copy.inUse.viewModes.matrix, icon: Rows3 },
    ],
    [copy],
  );

  const entries = useMemo(
    () => filterHooksInUse(inventory, { search, pill }),
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
    selectedId !== null && pendingHookKeys.has(selectedId);
  const isHookPendingSelected =
    selectedId !== null && pendingHookKeys.has(selectedId);

  const handleCreateHookSubmit = async (value: {
    id: string;
    event: string;
    command: string;
    match?: string | null;
    timeout?: number | null;
    description?: string;
  }) => {
    setAddPending(true);
    try {
      await handleCreateHook(value);
      setAddDialogOpen(false);
    } finally {
      setAddPending(false);
    }
  };

  const executeUninstall = useCallback(async () => {
    const target = confirmUninstallId;
    if (!target) return;
    setConfirmUninstallId(null);
    await handleUninstallHook(target);
    if (selectedId === target) {
      setDetailId(null);
    }
  }, [confirmUninstallId, handleUninstallHook, selectedId, setDetailId]);

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title={copy.inUse.title}
          subtitle={copy.inUse.subtitle}
          actions={
            <>
              <ViewModeToggle
                mode={viewMode}
                options={viewModeOptions}
                ariaLabel={copy.inUse.viewModeAria}
                onChange={setViewMode}
              />
              <button
                type="button"
                className="action-pill action-pill--md action-pill--accent"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus size={16} style={{ marginRight: "4px" }} />
                Add Hook
              </button>
            </>
          }
        />
        {totalInUse > 0 ? (
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={copy.inUse.searchPlaceholder}
            searchLabel={copy.inUse.searchLabel}
            trailing={<HooksFilterMenu pill={pill} counts={counts} onChange={setPill} />}
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
          viewMode === "matrix" ? (
            <HooksMatrixView
              entries={entries}
              columns={inventory.columns}
              pendingHookKeys={pendingHookKeys}
              pendingPerHarnessKeys={pendingPerHarnessKeys}
              checkedIds={new Set()}
              onOpenDetail={setDetailId}
              onToggleChecked={() => {}}
              onEnableHarness={(id, harness) => {
                void handleToggleHarness(id, harness, false);
              }}
              onDisableHarness={(id, harness) => {
                void handleToggleHarness(id, harness, true);
              }}
            />
          ) : (
            <HookCardList
              entries={entries}
              columns={inventory.columns}
              pendingHookKeys={pendingHookKeys}
              checkedIds={new Set()}
              onOpenDetail={setDetailId}
              onToggleChecked={() => {}}
              onSetHarnesses={(id, target) => {
                void handleSetHookHarnesses(id, target);
              }}
              onRequestUninstall={setConfirmUninstallId}
            />
          )
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
                Add Hook
              </button>
            </div>
          </div>
        )
      ) : null}

      {inventory ? (
        <HookDetailSheet
          id={selectedId}
          columns={inventory.columns}
          pendingPerHarness={pendingForSelected}
          isServerPending={isHookPendingSelected}
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
            return handleReconcileHook({ id: selectedId, ...args });
          }}
          onUninstall={() => {
            if (selectedId) setConfirmUninstallId(selectedId);
          }}
        />
      ) : null}

      <HookFormDialog
        open={addDialogOpen}
        pending={addPending}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleCreateHookSubmit}
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
