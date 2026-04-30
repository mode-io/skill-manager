import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { NeedsReviewRow } from "../../../components/cards/NeedsReviewRow";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { getHarnessPresentation } from "../../../components/harness/harnessPresentation";
import { SlashCommandReviewDetailSheet } from "../components/detail/SlashCommandReviewDetailSheet";
import {
  reviewActionTitle,
  primaryReviewAction,
  reviewActionLabel,
  reviewMetaText,
} from "../model/selectors";
import {
  reviewKey,
  useSlashCommandsReviewController,
} from "../model/useSlashCommandsReviewController";
import type { SlashCommandReviewDto, SlashReviewAction } from "../api/types";

export default function SlashCommandsReviewPage() {
  const controller = useSlashCommandsReviewController();
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

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title="Slash commands to review"
          subtitle={
            total > 0
              ? `${total} command${total === 1 ? "" : "s"} found outside normal managed state.`
              : "No unmanaged, changed, or missing slash command files were found."
          }
          actions={
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              disabled={eligibleImportRows.length === 0 || importAllPending}
              onClick={() => {
                void handleImportAll();
              }}
            >
              {importAllPending ? <LoadingSpinner size="sm" label="Adopting all commands" /> : null}
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
              pendingKey={pendingKey}
              onAction={handleAction}
              onOpen={openReviewDetail}
            />
          ))}
        </section>
      ) : (
        <div className="empty-panel">
          <h3 className="empty-panel__title">Nothing needs review</h3>
          <p className="empty-panel__body">
            Slash command files in target folders are already managed or no supported target folders contain commands.
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
    </>
  );
}

function SlashCommandReviewRow({
  row,
  pendingKey,
  onAction,
  onOpen,
}: {
  row: SlashCommandReviewDto;
  pendingKey: string | null;
  onAction: (row: SlashCommandReviewDto, action?: SlashReviewAction | null) => Promise<boolean>;
  onOpen: (row: SlashCommandReviewDto) => void;
}) {
  const primaryAction = primaryReviewAction(row);
  const secondaryActions = row.actions.filter((action) => action !== primaryAction);
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
      name={row.name}
      logos={<span className="harness-stack">{logo}</span>}
      metaText={reviewMetaText(row)}
      statusChip={
        secondaryActions.length > 0 ? (
          <span className="slash-review-actions">
            {secondaryActions.map((action) => (
              <button
                key={action}
                type="button"
                className="action-pill"
                title={reviewActionTitle(action)}
                disabled={pendingKey === reviewKey(row.target, row.name, action)}
                onClick={(event) => {
                  event.stopPropagation();
                  void onAction(row, action);
                }}
              >
                {reviewActionLabel(action)}
              </button>
            ))}
          </span>
        ) : undefined
      }
      description={row.description || row.path}
      actionLabel={reviewActionLabel(primaryAction)}
      actionTitle={primaryAction ? reviewActionTitle(primaryAction) : row.error ?? "Cannot update"}
      pending={primaryAction ? pendingKey === reviewKey(row.target, row.name, primaryAction) : false}
      actionDisabled={!primaryAction}
      onOpen={() => onOpen(row)}
      onAction={() => void onAction(row, primaryAction)}
    />
  );
}
