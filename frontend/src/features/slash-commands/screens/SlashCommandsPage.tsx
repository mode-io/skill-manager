import { Columns3, LayoutGrid, Plus, Rows3 } from "lucide-react";

import { BulkActionBar } from "../../../components/BulkActionBar";
import { ConfirmActionDialog } from "../../../components/ConfirmActionDialog";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { ViewModeToggle, type ViewModeOption } from "../../../components/ViewModeToggle";
import { SlashCommandBoard } from "../components/SlashCommandBoard";
import { SlashCommandFormDialog } from "../components/SlashCommandFormDialog";
import { SlashCommandList } from "../components/SlashCommandList";
import { SlashCommandMatrix } from "../components/SlashCommandMatrix";
import { SlashCommandDetailSheet } from "../components/detail/SlashCommandDetailSheet";
import { useCommonCopy } from "../../../i18n";
import { useSlashCommandsCopy } from "../i18n";
import { useSlashCommandsController } from "../model/useSlashCommandsController";
import type { SlashCommandsViewMode } from "../model/useSlashCommandsViewMode";

export default function SlashCommandsPage() {
  const controller = useSlashCommandsController();
  const copy = useSlashCommandsCopy();
  const common = useCommonCopy();
  const {
    actionError,
    buckets,
    bulkPending,
    checkedNames,
    commands,
    data,
    deleteCommand,
    deletePending,
    editingCommand,
    formMode,
    formPending,
    pendingName,
    pendingTarget,
    query,
    search,
    selectedCommand,
    setActionError,
    setCheckedNames,
    setDeleteCommand,
    setFormMode,
    setSearch,
    viewMode,
    setViewMode,
    executeDeleteCommand,
    handleBulkDelete,
    handleBulkDisableAll,
    handleBulkEnableAll,
    handleSetAllTargets,
    handleSubmit,
    handleToggleChecked,
    handleToggleTarget,
    closeDetail,
    openCreate,
    openDetail,
    openEdit,
  } = controller;
  const viewModeOptions: readonly ViewModeOption<SlashCommandsViewMode>[] = [
    { value: "grid", label: copy.inUse.viewModes.grid, icon: LayoutGrid },
    { value: "board", label: copy.inUse.viewModes.board, icon: Columns3 },
    { value: "matrix", label: copy.inUse.viewModes.matrix, icon: Rows3 },
  ];

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
              <button type="button" className="action-pill action-pill--md" onClick={openCreate}>
                <Plus size={14} aria-hidden="true" />
                {copy.inUse.newCommand}
              </button>
            </>
          }
        />
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={copy.inUse.searchPlaceholder}
          searchLabel={copy.inUse.searchLabel}
        />
      </div>

      {actionError ? <ErrorBanner message={actionError} onDismiss={() => setActionError("")} /> : null}
      {query.error ? (
        <ErrorBanner message={query.error instanceof Error ? query.error.message : copy.inUse.unableToLoad} />
      ) : null}

      {query.isPending ? (
        <div className="panel-state">
          <LoadingSpinner label={copy.inUse.loading} />
        </div>
      ) : data ? (
        viewMode === "board" ? (
          <SlashCommandBoard
            commands={commands}
            buckets={buckets}
            targets={data.targets}
            pendingName={pendingName}
            checkedNames={checkedNames}
            onOpen={openDetail}
            onToggleChecked={handleToggleChecked}
            onSetAllTargets={handleSetAllTargets}
          />
        ) : viewMode === "matrix" ? (
          <SlashCommandMatrix
            commands={commands}
            targets={data.targets}
            pendingName={pendingName}
            pendingTarget={pendingTarget}
            checkedNames={checkedNames}
            onOpen={openDetail}
            onToggleChecked={handleToggleChecked}
            onToggleTarget={(command, target) => {
              void handleToggleTarget(command, target);
            }}
          />
        ) : (
          <SlashCommandList
            commands={commands}
            targets={data.targets}
            pendingName={pendingName}
            pendingTarget={pendingTarget}
            checkedNames={checkedNames}
            onOpen={openDetail}
            onSetAllTargets={(command, target) => {
              void handleSetAllTargets(command, target);
            }}
            onToggleTarget={(command, target) => {
              void handleToggleTarget(command, target);
            }}
            onToggleChecked={handleToggleChecked}
            onDelete={setDeleteCommand}
          />
        )
      ) : null}

      {data ? (
        <SlashCommandDetailSheet
          command={selectedCommand}
          targets={data.targets}
          pendingName={pendingName}
          pendingTarget={pendingTarget}
          onClose={closeDetail}
          onEdit={openEdit}
          onDelete={setDeleteCommand}
          onToggleTarget={(command, target) => {
            void handleToggleTarget(command, target);
          }}
        />
      ) : null}

      {data ? (
        <SlashCommandFormDialog
          open={formMode !== null}
          mode={formMode ?? "create"}
          command={editingCommand}
          targets={data.targets}
          defaultTargets={data.defaultTargets}
          pending={formPending}
          onOpenChange={(open) => {
            if (!open) setFormMode(null);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}

      <BulkActionBar
        selectedCount={checkedNames.size}
        pending={bulkPending}
        onClear={() => setCheckedNames(new Set())}
        onEnableAll={handleBulkEnableAll}
        onDisableAll={handleBulkDisableAll}
        onDelete={handleBulkDelete}
        destructive={{
          actionLabel: common.actions.delete,
          confirmTitle: copy.inUse.bulkDeleteTitle(checkedNames.size),
          confirmDescription: copy.inUse.bulkDeleteDescription,
        }}
      />

      <ConfirmActionDialog
        open={deleteCommand !== null}
        title={copy.inUse.deleteTitle(deleteCommand?.name ?? "slash command")}
        description={copy.inUse.deleteDescription}
        confirmLabel={common.actions.delete}
        pendingLabel={copy.inUse.deleting}
        isPending={deletePending}
        onOpenChange={(open) => {
          if (!open) setDeleteCommand(null);
        }}
        onConfirm={executeDeleteCommand}
      />
    </>
  );
}
