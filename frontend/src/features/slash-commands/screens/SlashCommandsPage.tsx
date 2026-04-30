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
import { useSlashCommandsController } from "../model/useSlashCommandsController";
import type { SlashCommandsViewMode } from "../model/useSlashCommandsViewMode";

const VIEW_MODE_OPTIONS: readonly ViewModeOption<SlashCommandsViewMode>[] = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "board", label: "Board", icon: Columns3 },
  { value: "matrix", label: "Matrix", icon: Rows3 },
];

export default function SlashCommandsPage() {
  const controller = useSlashCommandsController();
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

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title="Slash Commands"
          subtitle="Create one global prompt and sync it into local slash command folders."
          actions={
            <>
              <ViewModeToggle
                mode={viewMode}
                options={VIEW_MODE_OPTIONS}
                ariaLabel="Slash commands view mode"
                onChange={setViewMode}
              />
              <button type="button" className="action-pill action-pill--md" onClick={openCreate}>
                <Plus size={14} aria-hidden="true" />
                New command
              </button>
            </>
          }
        />
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search slash commands"
          searchLabel="Search slash commands"
        />
      </div>

      {actionError ? <ErrorBanner message={actionError} onDismiss={() => setActionError("")} /> : null}
      {query.error ? (
        <ErrorBanner message={query.error instanceof Error ? query.error.message : "Unable to load slash commands."} />
      ) : null}

      {query.isPending ? (
        <div className="panel-state">
          <LoadingSpinner label="Loading slash commands" />
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
          actionLabel: "Delete",
          confirmTitle: `Delete ${checkedNames.size} slash command${
            checkedNames.size === 1 ? "" : "s"
          }?`,
          confirmDescription:
            "This removes the source command and generated command files for every selected slash command.",
        }}
      />

      <ConfirmActionDialog
        open={deleteCommand !== null}
        title={`Delete ${deleteCommand?.name ?? "slash command"}?`}
        description="This removes the source command and generated command files from every synced target."
        confirmLabel="Delete"
        pendingLabel="Deleting"
        isPending={deletePending}
        onOpenChange={(open) => {
          if (!open) setDeleteCommand(null);
        }}
        onConfirm={executeDeleteCommand}
      />
    </>
  );
}
