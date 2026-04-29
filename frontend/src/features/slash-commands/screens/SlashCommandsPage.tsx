import { useMemo, useState } from "react";
import { Columns3, LayoutGrid, Plus, Rows3 } from "lucide-react";

import { BulkActionBar, type MultiSelectAction } from "../../../components/BulkActionBar";
import { ConfirmActionDialog } from "../../../components/ConfirmActionDialog";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { useToast } from "../../../components/Toast";
import { ViewModeToggle, type ViewModeOption } from "../../../components/ViewModeToggle";
import { SlashCommandBoard } from "../components/SlashCommandBoard";
import { SlashCommandFormDialog } from "../components/SlashCommandFormDialog";
import { SlashCommandList } from "../components/SlashCommandList";
import { SlashCommandMatrix } from "../components/SlashCommandMatrix";
import { useSlashCommandsViewMode, type SlashCommandsViewMode } from "../model/useSlashCommandsViewMode";
import {
  useCreateSlashCommandMutation,
  useDeleteSlashCommandMutation,
  useSlashCommandsQuery,
  useSyncSlashCommandMutation,
  useUpdateSlashCommandMutation,
} from "../api/queries";
import type { SlashCommandDto, SlashTargetId } from "../api/types";
import type { SlashTargetDto } from "../api/types";

const VIEW_MODE_OPTIONS: readonly ViewModeOption<SlashCommandsViewMode>[] = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "board", label: "Board", icon: Columns3 },
  { value: "matrix", label: "Matrix", icon: Rows3 },
];

export default function SlashCommandsPage() {
  const query = useSlashCommandsQuery();
  const createMutation = useCreateSlashCommandMutation();
  const updateMutation = useUpdateSlashCommandMutation();
  const syncMutation = useSyncSlashCommandMutation();
  const deleteMutation = useDeleteSlashCommandMutation();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingCommand, setEditingCommand] = useState<SlashCommandDto | null>(null);
  const [actionError, setActionError] = useState("");
  const [pendingTargetKey, setPendingTargetKey] = useState<string | null>(null);
  const [checkedNames, setCheckedNames] = useState<Set<string>>(() => new Set());
  const [bulkPending, setBulkPending] = useState<MultiSelectAction | null>(null);
  const [deleteCommand, setDeleteCommand] = useState<SlashCommandDto | null>(null);
  const [viewMode, setViewMode] = useSlashCommandsViewMode();

  const data = query.data;
  const commands = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!data || !needle) return data?.commands ?? [];
    return data.commands.filter((command) =>
      `${command.name} ${command.description}`.toLowerCase().includes(needle),
    );
  }, [data, search]);

  const pendingName = syncMutation.isPending
    ? syncMutation.variables?.name ?? null
    : updateMutation.isPending
      ? updateMutation.variables?.name ?? null
      : deleteMutation.isPending
        ? deleteMutation.variables?.name ?? null
        : null;
  const pendingTarget = pendingName ? pendingTargetKey?.split(":")[1] ?? null : null;
  const formPending = createMutation.isPending || updateMutation.isPending;

  function openCreate(): void {
    setEditingCommand(null);
    setFormMode("create");
  }

  function openEdit(command: SlashCommandDto): void {
    setEditingCommand(command);
    setFormMode("edit");
  }

  async function handleSubmit(value: {
    name: string;
    description: string;
    prompt: string;
    targets: SlashTargetId[];
  }): Promise<void> {
    setActionError("");
    try {
      const result =
        formMode === "edit" && editingCommand
          ? await updateMutation.mutateAsync({
              name: editingCommand.name,
              body: {
                description: value.description,
                prompt: value.prompt,
                targets: value.targets,
              },
            })
          : await createMutation.mutateAsync(value);
      setFormMode(null);
      setEditingCommand(null);
      toast(result.ok ? "Slash command saved" : "Saved with sync warnings");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to save slash command.");
    }
  }

  async function handleToggleTarget(command: SlashCommandDto, target: SlashTargetDto): Promise<void> {
    setActionError("");
    setPendingTargetKey(`${command.name}:${target.id}`);
    const syncedTargets = command.syncTargets
      .filter((entry) => entry.status === "synced")
      .map((entry) => entry.target);
    const isEnabled = syncedTargets.includes(target.id);
    const nextTargets = isEnabled
      ? syncedTargets.filter((item) => item !== target.id)
      : [...syncedTargets, target.id];
    try {
      const result = await syncMutation.mutateAsync({
        name: command.name,
        body: { targets: nextTargets },
      });
      toast(
        result.ok
          ? `${target.label} ${isEnabled ? "disabled" : "enabled"}`
          : "Sync finished with warnings",
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update sync target.");
    } finally {
      setPendingTargetKey(null);
    }
  }

  async function handleSetAllTargets(
    command: SlashCommandDto,
    target: "enabled" | "disabled",
  ): Promise<void> {
    if (!data) return;
    setActionError("");
    setPendingTargetKey(`${command.name}:all`);
    try {
      const targets = target === "enabled" ? data.targets.map((item) => item.id) : [];
      const result = await syncMutation.mutateAsync({
        name: command.name,
        body: { targets },
      });
      toast(
        result.ok
          ? target === "enabled"
            ? "Slash command enabled"
            : "Slash command disabled"
          : "Sync finished with warnings",
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update slash command.");
    } finally {
      setPendingTargetKey(null);
    }
  }

  function handleToggleChecked(name: string): void {
    setCheckedNames((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  async function handleBulkEnableAll(): Promise<void> {
    if (!data || checkedNames.size === 0) return;
    setBulkPending("enable-all");
    setActionError("");
    try {
      const targets = data.targets.map((target) => target.id);
      for (const name of checkedNames) {
        await syncMutation.mutateAsync({ name, body: { targets } });
      }
      setCheckedNames(new Set());
      toast("Slash commands enabled");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to enable slash commands.");
    } finally {
      setBulkPending(null);
    }
  }

  async function handleBulkDisableAll(): Promise<void> {
    if (checkedNames.size === 0) return;
    setBulkPending("disable-all");
    setActionError("");
    try {
      for (const name of checkedNames) {
        await syncMutation.mutateAsync({ name, body: { targets: [] } });
      }
      setCheckedNames(new Set());
      toast("Slash commands disabled");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to disable slash commands.");
    } finally {
      setBulkPending(null);
    }
  }

  async function handleBulkDelete(): Promise<void> {
    if (checkedNames.size === 0) return;
    setBulkPending("delete");
    setActionError("");
    try {
      for (const name of checkedNames) {
        await deleteMutation.mutateAsync({ name });
      }
      setCheckedNames(new Set());
      toast("Slash commands deleted");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to delete slash commands.");
    } finally {
      setBulkPending(null);
    }
  }

  async function executeDeleteCommand(): Promise<void> {
    if (!deleteCommand) return;
    setActionError("");
    try {
      await deleteMutation.mutateAsync({ name: deleteCommand.name });
      setDeleteCommand(null);
      setCheckedNames((current) => {
        const next = new Set(current);
        next.delete(deleteCommand.name);
        return next;
      });
      toast("Slash command deleted");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to delete slash command.");
    }
  }

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

      {actionError ? (
        <ErrorBanner message={actionError} onDismiss={() => setActionError("")} />
      ) : null}
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
            targets={data.targets}
            pendingName={pendingName}
            checkedNames={checkedNames}
            onEdit={openEdit}
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
            onEdit={openEdit}
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
            onEdit={openEdit}
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
            "This removes the source YAML and generated command files for every selected slash command.",
        }}
      />

      <ConfirmActionDialog
        open={deleteCommand !== null}
        title={`Delete /${deleteCommand?.name ?? "slash command"}?`}
        description="This removes the source YAML and generated command files from every synced target."
        confirmLabel="Delete"
        pendingLabel="Deleting"
        isPending={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteCommand(null);
        }}
        onConfirm={executeDeleteCommand}
      />
    </>
  );
}
