import { useEffect, useMemo, useState } from "react";

import type { MultiSelectAction } from "../../../components/BulkActionBar";
import { useToast } from "../../../components/Toast";
import {
  useCreateSlashCommandMutation,
  useDeleteSlashCommandMutation,
  useSlashCommandsQuery,
  useSyncSlashCommandMutation,
  useUpdateSlashCommandMutation,
} from "../api/queries";
import type { SlashCommandDto, SlashTargetDto, SlashTargetId } from "../api/types";
import {
  bucketSlashCommands,
  filterSlashCommands,
  syncedTargetIds,
} from "./selectors";
import { useSlashCommandsViewMode } from "./useSlashCommandsViewMode";

export function useSlashCommandsController() {
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
  const [selectedCommandName, setSelectedCommandName] = useState<string | null>(null);
  const [savedCommandSnapshot, setSavedCommandSnapshot] = useState<SlashCommandDto | null>(null);
  const [viewMode, setViewMode] = useSlashCommandsViewMode();

  const data = query.data;
  const listSelectedCommand = useMemo(
    () =>
      selectedCommandName
        ? data?.commands.find((command) => command.name === selectedCommandName) ?? null
        : null,
    [data?.commands, selectedCommandName],
  );
  const selectedCommand =
    selectedCommandName && savedCommandSnapshot?.name === selectedCommandName
      ? savedCommandSnapshot
      : listSelectedCommand;
  const commands = useMemo(
    () => filterSlashCommands(data?.commands ?? [], search),
    [data?.commands, search],
  );
  const buckets = useMemo(
    () => bucketSlashCommands(commands, data?.targets.length ?? 0),
    [commands, data?.targets.length],
  );

  const pendingName = syncMutation.isPending
    ? syncMutation.variables?.name ?? null
    : updateMutation.isPending
      ? updateMutation.variables?.name ?? null
      : deleteMutation.isPending
        ? deleteMutation.variables?.name ?? null
        : null;
  const pendingTarget = pendingName ? pendingTargetKey?.split(":")[1] ?? null : null;
  const formPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!savedCommandSnapshot) return;
    const listCommand = data?.commands.find((command) => command.name === savedCommandSnapshot.name);
    if (
      listCommand &&
      listCommand.description === savedCommandSnapshot.description &&
      listCommand.prompt === savedCommandSnapshot.prompt
    ) {
      setSavedCommandSnapshot(null);
    }
  }, [data?.commands, savedCommandSnapshot]);

  function openCreate(): void {
    setSelectedCommandName(null);
    setSavedCommandSnapshot(null);
    setEditingCommand(null);
    setFormMode("create");
  }

  function openDetail(command: SlashCommandDto): void {
    setActionError("");
    setSelectedCommandName(command.name);
    setSavedCommandSnapshot(null);
    setEditingCommand(null);
    setFormMode(null);
  }

  function closeDetail(): void {
    setSelectedCommandName(null);
    setSavedCommandSnapshot(null);
  }

  function openEdit(command: SlashCommandDto): void {
    setSelectedCommandName(null);
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
      const savedCommand = commandSnapshotFromSubmit(
        result,
        formMode === "edit" && editingCommand ? editingCommand.name : value.name.trim(),
        value,
      );
      setSavedCommandSnapshot(savedCommand);
      setSelectedCommandName(savedCommand.name);
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
    const syncedTargets = Array.from(syncedTargetIds(command)) as SlashTargetId[];
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
      const targets = target === "enabled" ? data.targets.filter((item) => item.enabled).map((item) => item.id) : [];
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
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function runBulkAction(
    action: MultiSelectAction,
    task: (name: string) => Promise<unknown>,
    successMessage: string,
    failureMessage: string,
  ): Promise<void> {
    if (checkedNames.size === 0) return;
    const names = Array.from(checkedNames);
    setBulkPending(action);
    setActionError("");
    try {
      const results = await Promise.allSettled(names.map((name) => task(name)));
      const failures = results
        .map((result, index) => ({ name: names[index], result }))
        .filter((item) => item.result.status === "rejected");
      if (failures.length > 0) {
        setActionError(
          failures
            .map((failure) => {
              const reason = (failure.result as PromiseRejectedResult).reason;
              return `${failure.name}: ${reason instanceof Error ? reason.message : String(reason)}`;
            })
            .join("; "),
        );
      } else {
        setCheckedNames(new Set());
        toast(successMessage);
      }
    } catch {
      setActionError(failureMessage);
    } finally {
      setBulkPending(null);
    }
  }

  async function handleBulkEnableAll(): Promise<void> {
    if (!data) return;
    const targets = data.targets.filter((target) => target.enabled).map((target) => target.id);
    await runBulkAction(
      "enable-all",
      (name) => syncMutation.mutateAsync({ name, body: { targets } }),
      "Slash commands enabled",
      "Unable to enable slash commands.",
    );
  }

  async function handleBulkDisableAll(): Promise<void> {
    await runBulkAction(
      "disable-all",
      (name) => syncMutation.mutateAsync({ name, body: { targets: [] } }),
      "Slash commands disabled",
      "Unable to disable slash commands.",
    );
  }

  async function handleBulkDelete(): Promise<void> {
    await runBulkAction(
      "delete",
      (name) => deleteMutation.mutateAsync({ name }),
      "Slash commands deleted",
      "Unable to delete slash commands.",
    );
  }

  async function executeDeleteCommand(): Promise<void> {
    if (!deleteCommand) return;
    setActionError("");
    try {
      const result = await deleteMutation.mutateAsync({ name: deleteCommand.name });
      if (!result.ok) {
        setActionError("Delete blocked by changed managed command files.");
        return;
      }
      setDeleteCommand(null);
      setSelectedCommandName(null);
      setSavedCommandSnapshot(null);
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

  return {
    actionError,
    buckets,
    bulkPending,
    checkedNames,
    commands,
    data,
    deleteCommand,
    deletePending: deleteMutation.isPending,
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
  };
}

export type SlashCommandsController = ReturnType<typeof useSlashCommandsController>;

function commandSnapshotFromSubmit(
  result: { command: SlashCommandDto | null; sync: SlashCommandDto["syncTargets"] },
  fallbackName: string,
  value: {
    description: string;
    prompt: string;
  },
): SlashCommandDto {
  return result.command ?? {
    name: fallbackName,
    description: value.description,
    prompt: value.prompt,
    syncTargets: result.sync,
  };
}
