import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { NeedsReviewRow } from "../../../components/cards/NeedsReviewRow";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { getHarnessPresentation } from "../../../components/harness/harnessPresentation";
import { SlashCommandReviewDetailSheet } from "../components/detail/SlashCommandReviewDetailSheet";
import { useSlashCommandsCopy, type SlashCommandsCopy } from "../i18n";
import {
  primaryReviewAction,
} from "../model/selectors";
import {
  reviewKey,
  useSlashCommandsReviewController,
} from "../model/useSlashCommandsReviewController";
import type { SlashCommandReviewDto, SlashReviewAction } from "../api/types";

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
        <section className="needs-review-rows" aria-label={copy.review.listAria}>
          {rows.map((row) => (
            <SlashCommandReviewRow
              key={row.reviewRef}
              row={row}
              copy={copy}
              pendingKey={pendingKey}
              onAction={handleAction}
              onOpen={openReviewDetail}
            />
          ))}
        </section>
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
    </>
  );
}

function SlashCommandReviewRow({
  row,
  copy,
  pendingKey,
  onAction,
  onOpen,
}: {
  row: SlashCommandReviewDto;
  copy: SlashCommandsCopy;
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
      metaText={copy.review.metaText(row)}
      statusChip={
        secondaryActions.length > 0 ? (
          <span className="slash-review-actions">
            {secondaryActions.map((action) => (
              <button
                key={action}
                type="button"
                className="action-pill"
                title={copy.review.actionTitle(action)}
                disabled={pendingKey === reviewKey(row.target, row.name, action)}
                onClick={(event) => {
                  event.stopPropagation();
                  void onAction(row, action);
                }}
              >
                {copy.review.actionLabel(action)}
              </button>
            ))}
          </span>
        ) : undefined
      }
      description={row.description || row.path}
      actionLabel={copy.review.actionLabel(primaryAction)}
      actionTitle={primaryAction ? copy.review.actionTitle(primaryAction) : row.error ?? copy.review.cannotUpdate}
      pending={primaryAction ? pendingKey === reviewKey(row.target, row.name, primaryAction) : false}
      actionDisabled={!primaryAction}
      onOpen={() => onOpen(row)}
      onAction={() => void onAction(row, primaryAction)}
    />
  );
}
