import { useMemo, useState } from "react";

import { useToast } from "../../../components/Toast";
import {
  useImportSlashCommandMutation,
  useResolveSlashCommandReviewMutation,
  useSlashCommandsQuery,
} from "../api/queries";
import type { SlashCommandDto, SlashCommandReviewDto, SlashReviewAction } from "../api/types";
import {
  filterSlashReviewRows,
  primaryReviewAction,
} from "./selectors";

export function useSlashCommandsReviewController() {
  const query = useSlashCommandsQuery();
  const importMutation = useImportSlashCommandMutation();
  const resolveMutation = useResolveSlashCommandReviewMutation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState("");
  const [importAllPending, setImportAllPending] = useState(false);
  const [selectedReviewRef, setSelectedReviewRef] = useState<string | null>(null);

  const allRows = query.data?.reviewCommands ?? [];
  const rows = useMemo(() => filterSlashReviewRows(allRows, search), [allRows, search]);
  const selectedRow = useMemo(
    () => allRows.find((row) => row.reviewRef === selectedReviewRef) ?? null,
    [allRows, selectedReviewRef],
  );
  const selectedCanonicalCommand = useMemo<SlashCommandDto | null>(() => {
    if (!selectedRow?.commandExists) return null;
    return query.data?.commands.find((command) => command.name === selectedRow.name) ?? null;
  }, [query.data?.commands, selectedRow]);
  const eligibleImportRows = allRows.filter((row) => row.actions.includes("import") && !row.error);
  const pendingKey =
    importMutation.isPending && importMutation.variables
      ? reviewKey(importMutation.variables.target, importMutation.variables.name, "import")
      : resolveMutation.isPending && resolveMutation.variables
        ? reviewKey(
            resolveMutation.variables.target,
            resolveMutation.variables.name,
            resolveMutation.variables.action,
          )
        : null;

  function openReviewDetail(row: SlashCommandReviewDto): void {
    setActionError("");
    setSelectedReviewRef(row.reviewRef);
  }

  function closeReviewDetail(): void {
    setActionError("");
    setSelectedReviewRef(null);
  }

  async function handleAction(row: SlashCommandReviewDto, action = primaryReviewAction(row)): Promise<boolean> {
    if (!action) return false;
    setActionError("");
    try {
      if (action === "import") {
        await importMutation.mutateAsync({ target: row.target, name: row.name });
      } else {
        await resolveMutation.mutateAsync({ target: row.target, name: row.name, action });
      }
      toast(reviewSuccessMessage(action));
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update slash command review item.");
      return false;
    }
  }

  async function handleImportAll(): Promise<void> {
    if (eligibleImportRows.length === 0) return;
    setActionError("");
    setImportAllPending(true);
    try {
      const results = await Promise.allSettled(
        eligibleImportRows.map((row) => importMutation.mutateAsync({ target: row.target, name: row.name })),
      );
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        setActionError(`${failures.length} slash command adoption${failures.length === 1 ? "" : "s"} failed.`);
      } else {
        toast("Slash commands adopted");
      }
    } finally {
      setImportAllPending(false);
    }
  }

  return {
    actionError,
    eligibleImportRows,
    importAllPending,
    pendingKey,
    query,
    rows,
    search,
    selectedCanonicalCommand,
    selectedReviewRef,
    selectedRow,
    closeReviewDetail,
    openReviewDetail,
    setActionError,
    setSearch,
    handleAction,
    handleImportAll,
  };
}

export function reviewKey(target: string, name: string, action: SlashReviewAction): string {
  return `${target}:${name}:${action}`;
}

function reviewSuccessMessage(action: SlashReviewAction): string {
  if (action === "restore_managed") return "Slash command restored";
  if (action === "adopt_target") return "Slash command adopted";
  if (action === "remove_binding") return "Slash command binding removed";
  return "Slash command adopted";
}

export type SlashCommandsReviewController = ReturnType<typeof useSlashCommandsReviewController>;
