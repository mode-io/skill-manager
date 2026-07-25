import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { MatrixTable } from "../../../components/matrix";
import { SlashCommandReviewDetailSheet } from "../components/detail/SlashCommandReviewDetailSheet";
import { SlashCommandReviewMatrixView } from "../components/SlashCommandReviewMatrixView";
import { primaryReviewAction } from "../model/selectors";
import { useSlashCommandsCopy } from "../i18n";
import { useSlashCommandsReviewController } from "../model/useSlashCommandsReviewController";

export default function SlashCommandsReviewPage() {
  const controller = useSlashCommandsReviewController();
  const copy = useSlashCommandsCopy();
  const {
    actionError,
    eligibleImportRows,
    importAllPending,
    pendingKey,
    query,
    rows,
    search,
    selectedCanonicalCommand,
    selectedRow,
    closeReviewDetail,
    openReviewDetail,
    setActionError,
    setSearch,
    handleAction,
    handleImportAll,
  } = controller;

  const total = query.data?.reviewCommands.length ?? 0;

  const [selectedRefs, setSelectedRefs] = useState<ReadonlySet<string>>(() => new Set());
  const [adoptingSelected, setAdoptingSelected] = useState(false);

  useEffect(() => {
    setSelectedRefs((current) => {
      let changed = false;
      const next = new Set<string>();
      const validRefs = new Set(rows.map(r => r.reviewRef));
      for (const ref of current) {
        if (validRefs.has(ref)) next.add(ref);
        else changed = true;
      }
      return changed ? next : current;
    });
  }, [rows]);

  const toggleSelected = (ref: string) => {
    setSelectedRefs((current) => {
      const next = new Set(current);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  const clearSelected = () => setSelectedRefs(new Set());

  const handleAdoptSelected = async () => {
    const selectedRows = rows.filter(r => selectedRefs.has(r.reviewRef) && primaryReviewAction(r) === "import");
    if (selectedRows.length === 0) return;
    setAdoptingSelected(true);
    try {
      for (const row of selectedRows) {
        try {
          await handleAction(row, "import");
        } catch {}
      }
      setSelectedRefs(new Set());
    } finally {
      setAdoptingSelected(false);
    }
  };

  const selectedCount = selectedRefs.size;


  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title={copy.review.title}
          subtitle={copy.review.subtitle(total)}
          actions={
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              disabled={eligibleImportRows.length === 0 || importAllPending}
              onClick={() => {
                void handleImportAll();
              }}
            >
              {importAllPending ? <LoadingSpinner size="sm" label={copy.review.adoptingAllCommands} /> : null}
              {copy.review.adoptAllEligible}
            </button>
          }
        />
        {total > 0 ? (
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={copy.review.searchPlaceholder}
            searchLabel={copy.review.searchLabel}
          />
        ) : null}
      </div>

      {actionError ? <ErrorBanner message={actionError} onDismiss={() => setActionError("")} /> : null}
      {query.error ? (
        <ErrorBanner message={query.error instanceof Error ? query.error.message : copy.inUse.unableToLoad} />
      ) : null}

      {query.isPending ? (
        <div className="panel-state">
          <LoadingSpinner label={copy.review.loading} />
        </div>
      ) : rows.length > 0 ? (
        <SlashCommandReviewMatrixView
          rows={rows}
          targets={query.data?.targets ?? []}
          pendingKey={pendingKey}
          onAction={handleAction}
          onOpen={openReviewDetail}
          selectedRefs={selectedRefs}
          onToggleSelected={toggleSelected}
        />
      ) : (
        <div className="empty-panel">
          <h3 className="empty-panel__title">{copy.review.emptyTitle}</h3>
          <p className="empty-panel__body">
            {copy.review.emptyBody}
          </p>
        </div>
      )}

      <SlashCommandReviewDetailSheet
        row={selectedRow}
        canonicalCommand={selectedCanonicalCommand}
        targets={query.data?.targets ?? []}
        pendingKey={pendingKey}
        actionError={actionError}
        onClose={closeReviewDetail}
        onAction={handleAction}
      />

      {selectedCount > 0 ? (
        <div className="bulk-dock">
          <div className="bulk-dock__fade" />
          <div
            className="bulk-bar"
            data-state="open"
            role="toolbar"
            aria-label="Bulk actions"
          >
            <div className="bulk-bar__group">
              <span className="bulk-bar__count">{selectedCount} selected</span>
              <button
                type="button"
                className="bulk-bar__clear"
                onClick={clearSelected}
                disabled={adoptingSelected}
                aria-label="Clear selection"
              >
                <X size={14} />
              </button>
            </div>

            <span className="bulk-bar__divider" aria-hidden="true" />

            <button
              type="button"
              className="bulk-bar__action"
              onClick={() => void handleAdoptSelected()}
              disabled={adoptingSelected}
            >
              {adoptingSelected ? (
                <LoadingSpinner size="sm" label="Adopting selected commands..." />
              ) : (
                <Plus size={15} />
              )}
              Adopt selected
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
