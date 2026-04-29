import { useMemo, useState } from "react";

import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { NeedsReviewRow } from "../../../components/cards/NeedsReviewRow";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { getHarnessPresentation } from "../../../components/harness/harnessPresentation";
import { useToast } from "../../../components/Toast";
import { useImportSlashCommandMutation, useSlashCommandsQuery } from "../api/queries";
import type { SlashCommandReviewDto } from "../api/types";

export default function SlashCommandsReviewPage() {
  const query = useSlashCommandsQuery();
  const importMutation = useImportSlashCommandMutation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState("");
  const [importAllPending, setImportAllPending] = useState(false);

  const rows = useMemo(() => {
    const allRows = query.data?.reviewCommands ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return allRows;
    return allRows.filter((row) =>
      `${row.name} ${row.description} ${row.targetLabel} ${row.path}`.toLowerCase().includes(needle),
    );
  }, [query.data, search]);

  async function handleImport(row: SlashCommandReviewDto): Promise<void> {
    setActionError("");
    try {
      await importMutation.mutateAsync({ target: row.target, name: row.name });
      toast("Slash command imported");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to import slash command.");
    }
  }

  const total = query.data?.reviewCommands.length ?? 0;
  const eligibleRows = query.data?.reviewCommands.filter((row) => row.canImport) ?? [];

  async function handleImportAll(): Promise<void> {
    if (eligibleRows.length === 0) return;
    setActionError("");
    setImportAllPending(true);
    try {
      for (const row of eligibleRows) {
        await importMutation.mutateAsync({ target: row.target, name: row.name });
      }
      toast("Slash commands imported");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to import slash commands.");
    } finally {
      setImportAllPending(false);
    }
  }

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title="Slash commands to review"
          subtitle={
            total > 0
              ? `${total} command${total === 1 ? "" : "s"} found outside Skill Manager.`
              : "No unmanaged slash command files were found."
          }
          actions={
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              disabled={eligibleRows.length === 0 || importMutation.isPending}
              onClick={() => {
                void handleImportAll();
              }}
            >
              {importAllPending ? <LoadingSpinner size="sm" label="Importing all commands" /> : null}
              Adopt all eligible
            </button>
          }
        />
        {total > 0 ? (
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search slash commands to review"
            searchLabel="Search slash commands to review"
          />
        ) : null}
      </div>

      {actionError ? <ErrorBanner message={actionError} onDismiss={() => setActionError("")} /> : null}
      {query.error ? (
        <ErrorBanner message={query.error instanceof Error ? query.error.message : "Unable to load slash commands."} />
      ) : null}

      {query.isPending ? (
        <div className="panel-state">
          <LoadingSpinner label="Loading slash commands to review" />
        </div>
      ) : rows.length > 0 ? (
        <section className="needs-review-rows" aria-label="Slash commands to review list">
          {rows.map((row) => (
            <SlashCommandReviewRow
              key={row.reviewRef}
              row={row}
              pending={!importAllPending && importMutation.isPending && importMutation.variables?.name === row.name}
              onImport={handleImport}
            />
          ))}
        </section>
      ) : (
        <div className="empty-panel">
          <h3 className="empty-panel__title">Nothing needs review</h3>
          <p className="empty-panel__body">
            Slash command files in target folders are either already managed or no target folders contain commands.
          </p>
        </div>
      )}
    </>
  );
}

function SlashCommandReviewRow({
  row,
  pending,
  onImport,
}: {
  row: SlashCommandReviewDto;
  pending: boolean;
  onImport: (row: SlashCommandReviewDto) => Promise<void>;
}) {
  const presentation = getHarnessPresentation(row.target === "claude" ? "claude" : row.target);
  const logo = (
    <UiTooltip content={row.targetLabel}>
      <span className="harness-stack__item">
        {presentation ? (
          <img src={presentation.logoSrc} alt="" aria-hidden="true" />
        ) : (
          <span className="harness-stack__fallback">{row.targetLabel.slice(0, 1)}</span>
        )}
      </span>
    </UiTooltip>
  );

  return (
    <NeedsReviewRow
      name={`/${row.name}`}
      logos={<span className="harness-stack">{logo}</span>}
      metaText={`Found in ${row.targetLabel}`}
      description={row.description || row.path}
      actionLabel="Import"
      actionTitle={row.canImport ? "Add this slash command to Skill Manager" : row.error ?? "Cannot import"}
      pending={pending}
      actionDisabled={!row.canImport}
      onOpen={() => undefined}
      onAction={() => void onImport(row)}
    />
  );
}
