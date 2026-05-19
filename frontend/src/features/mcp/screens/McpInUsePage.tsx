import { useCallback, useMemo, useState } from "react";
import { Grid2X2, Rows3 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { BulkActionBar } from "../../../components/BulkActionBar";
import { ConfirmActionDialog } from "../../../components/ConfirmActionDialog";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { ViewModeToggle, type ViewModeOption } from "../../../components/ViewModeToggle";
import { McpServerDetailSheet } from "../components/detail/McpServerDetailSheet";
import { McpFilterMenu } from "../components/McpFilterMenu";
import { McpServerCardList } from "../components/McpServerCardList";
import { McpServerMatrixView } from "../components/McpServerMatrixView";
import { useCommonCopy } from "../../../i18n";
import { useMcpCopy } from "../i18n";
import {
  filterMcpServersInUse,
  pillCounts,
  type InUsePillValue,
} from "../model/selectors";
import { useMcpManagementController } from "../model/use-mcp-management-controller";
import { useMcpInUseViewMode, type McpInUseViewMode } from "../model/useMcpInUseViewMode";

const DETAIL_PARAM = "server";

export default function McpInUsePage() {
  const {
    status,
    inventory,
    isInitialLoading,
    pendingServerKeys,
    pendingPerHarnessKeys,
    queryErrorMessage,
    actionErrorMessage,
    dismissActionError,
    handleSetServerHarnesses,
    handleUninstallServer,
    handleEnableInHarness,
    handleDisableInHarness,
    handleResolveConfig,
    multiSelectedNames,
    multiSelectPending,
    handleToggleMultiSelect,
    handleClearMultiSelect,
    handleMultiSelectEnableAll,
    handleMultiSelectDisableAll,
    handleMultiSelectUninstall,
  } = useMcpManagementController();

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedName = searchParams.get(DETAIL_PARAM);
  const [confirmUninstallName, setConfirmUninstallName] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [pill, setPill] = useState<InUsePillValue>("all");
  const [viewMode, setViewMode] = useMcpInUseViewMode();
  const copy = useMcpCopy();
  const common = useCommonCopy();
  const viewModeOptions: readonly ViewModeOption<McpInUseViewMode>[] = useMemo(
    () => [
      { value: "cards", label: copy.inUse.viewModes.cards, icon: Grid2X2 },
      { value: "matrix", label: copy.inUse.viewModes.matrix, icon: Rows3 },
    ],
    [copy],
  );

  const entries = useMemo(
    () => filterMcpServersInUse(inventory, { search, pill }),
    [inventory, search, pill],
  );
  const counts = useMemo(() => pillCounts(inventory), [inventory]);
  const totalInUse = inventory?.entries.filter((e) => e.kind === "managed").length ?? 0;
  const isReady = status === "ready" && Boolean(inventory);
  const inventoryIssueMessage = inventory?.issues?.length
    ? copy.inUse.inventoryIssue(inventory.issues.length)
    : "";

  const setDetailName = useCallback(
    (name: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (name) {
        next.set(DETAIL_PARAM, name);
      } else {
        next.delete(DETAIL_PARAM);
      }
      setSearchParams(next, { replace: !name });
    },
    [searchParams, setSearchParams],
  );

  const pendingForSelected = useMemo(() => {
    if (!selectedName) return new Set<string>();
    const result = new Set<string>();
    for (const key of pendingPerHarnessKeys) {
      const [name, harness] = key.split(":", 2);
      if (name === selectedName) result.add(harness);
    }
    return result;
  }, [pendingPerHarnessKeys, selectedName]);

  const isUninstallingSelected =
    selectedName !== null && pendingServerKeys.has(selectedName);
  const isServerPendingSelected =
    selectedName !== null && pendingServerKeys.has(selectedName);

  const confirmUninstall = useCallback(
    (name: string) => setConfirmUninstallName(name),
    [],
  );

  const executeUninstall = useCallback(async () => {
    const target = confirmUninstallName;
    if (!target) return;
    setConfirmUninstallName(null);
    await handleUninstallServer(target);
    if (selectedName === target) {
      setDetailName(null);
    }
  }, [confirmUninstallName, handleUninstallServer, selectedName, setDetailName]);

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
              <Link
                to="/marketplace/mcp"
                className="action-pill action-pill--md action-pill--accent"
              >
                {common.actions.browseMarketplace}
              </Link>
            </>
          }
        />
        {totalInUse > 0 ? (
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={copy.inUse.searchPlaceholder}
            searchLabel={copy.inUse.searchLabel}
            trailing={<McpFilterMenu pill={pill} counts={counts} onChange={setPill} />}
          />
        ) : null}
      </div>

      {actionErrorMessage ? (
        <ErrorBanner message={actionErrorMessage} onDismiss={dismissActionError} />
      ) : null}
      {inventoryIssueMessage ? <ErrorBanner message={inventoryIssueMessage} /> : null}

      {isInitialLoading ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label={copy.inUse.loading} />
        </div>
      ) : status === "error" ? (
        <div className="panel-state">{queryErrorMessage || copy.inUse.unableToLoad}</div>
      ) : isReady && inventory ? (
        entries.length > 0 ? (
          viewMode === "matrix" ? (
            <McpServerMatrixView
              entries={entries}
              columns={inventory.columns}
              pendingServerKeys={pendingServerKeys}
              pendingPerHarnessKeys={pendingPerHarnessKeys}
              checkedNames={multiSelectedNames}
              onOpenDetail={setDetailName}
              onToggleChecked={handleToggleMultiSelect}
              onEnableHarness={(name, harness) => {
                void handleEnableInHarness(name, harness);
              }}
              onDisableHarness={(name, harness) => {
                void handleDisableInHarness(name, harness);
              }}
            />
          ) : (
            <McpServerCardList
              entries={entries}
              columns={inventory.columns}
              pendingServerKeys={pendingServerKeys}
              checkedNames={multiSelectedNames}
              onOpenDetail={setDetailName}
              onToggleChecked={handleToggleMultiSelect}
              onSetHarnesses={handleSetServerHarnesses}
              onRequestUninstall={confirmUninstall}
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
              <Link
                to="/marketplace/mcp"
                className="action-pill action-pill--md action-pill--accent"
              >
                {common.actions.openMarketplace}
              </Link>
              <Link to="/mcp/review" className="action-pill action-pill--md">
                {common.actions.reviewItems}
              </Link>
            </div>
          </div>
        )
      ) : null}

      {inventory ? (
        <McpServerDetailSheet
          name={selectedName}
          columns={inventory.columns}
          pendingPerHarness={pendingForSelected}
          isServerPending={isServerPendingSelected}
          isUninstalling={isUninstallingSelected}
          onClose={() => setDetailName(null)}
          onEnableHarness={(harness) => {
            if (selectedName) void handleEnableInHarness(selectedName, harness);
          }}
          onDisableHarness={(harness) => {
            if (selectedName) void handleDisableInHarness(selectedName, harness);
          }}
          onResolveConfig={(args) => {
            if (!selectedName) return Promise.resolve();
            return handleResolveConfig(selectedName, args);
          }}
          onUninstall={() => {
            if (selectedName) confirmUninstall(selectedName);
          }}
        />
      ) : null}

      <BulkActionBar
        selectedCount={multiSelectedNames.size}
        pending={multiSelectPending}
        onClear={handleClearMultiSelect}
        onEnableAll={handleMultiSelectEnableAll}
        onDisableAll={handleMultiSelectDisableAll}
        onDelete={handleMultiSelectUninstall}
        destructive={{
          actionLabel: copy.inUse.uninstall.action,
          confirmTitle: copy.inUse.uninstall.bulkTitle(multiSelectedNames.size),
          confirmDescription: copy.inUse.uninstall.description,
        }}
      />

      <ConfirmActionDialog
        open={confirmUninstallName !== null}
        title={copy.inUse.uninstall.title(uninstallDisplayName(inventory, confirmUninstallName, copy.inUse.uninstall.fallbackName))}
        description={copy.inUse.uninstall.singleDescription}
        confirmLabel={copy.inUse.uninstall.action}
        pendingLabel={copy.inUse.uninstall.pending}
        isPending={false}
        onOpenChange={(open) => {
          if (!open) setConfirmUninstallName(null);
        }}
        onConfirm={executeUninstall}
      />
    </>
  );
}

function uninstallDisplayName(
  inventory: { entries: { name: string; displayName: string }[] } | null,
  name: string | null,
  fallbackName = "this server",
): string {
  if (!inventory || !name) return fallbackName;
  const entry = inventory.entries.find((e) => e.name === name);
  return entry?.displayName ?? name;
}
