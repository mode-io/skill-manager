import { useMemo } from "react";
import { Link } from "react-router-dom";

import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { useCommonCopy } from "../../../i18n";
import { SkillsNeedsReviewList } from "../components/cards/SkillsNeedsReviewList";
import { SkillsEmptyState } from "../components/pane/SkillsEmptyState";
import { useSkillsCopy } from "../i18n";
import { useSkillsWorkspace } from "../model/workspace-context";
import {
  countAdoptableLocalSkillRows,
  countNeedsReviewRows,
  filterNeedsReviewRows,
  hasActiveNeedsReviewFilters,
} from "../model/selectors";
import { useSkillsNeedsReviewSession } from "../model/session";

export default function SkillsNeedsReviewPage() {
  const {
    data,
    status,
    pendingStructuralActions,
    pendingBulkAction,
    selectedSkillRef,
    onManageAll,
    onManageSkill,
    onOpenSkill,
    isInitialLoading,
  } = useSkillsWorkspace();
  const { filters, updateFilters, resetFilters } = useSkillsNeedsReviewSession();
  const copy = useSkillsCopy();
  const common = useCommonCopy();

  const rows = useMemo(() => filterNeedsReviewRows(data, filters), [data, filters]);
  const hasActiveFilters = useMemo(() => hasActiveNeedsReviewFilters(filters), [filters]);
  const needsReviewCount = useMemo(() => countNeedsReviewRows(data), [data]);
  const adoptableCount = useMemo(() => countAdoptableLocalSkillRows(data), [data]);
  const isReady = status === "ready" && Boolean(data);

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title={copy.review.title}
          subtitle={copy.review.subtitle(needsReviewCount)}
          actions={
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              disabled={pendingBulkAction !== null || adoptableCount === 0}
              onClick={onManageAll}
            >
              {pendingBulkAction === "manage-all" ? (
                <LoadingSpinner size="sm" label={copy.review.adoptingAllSkills} />
              ) : null}
              {copy.review.adoptAllEligible}
            </button>
          }
        />

        {needsReviewCount > 0 ? (
          <FilterBar
            searchValue={filters.search}
            onSearchChange={(search) => updateFilters({ search })}
            searchPlaceholder={copy.review.searchPlaceholder}
            searchLabel={copy.review.searchLabel}
          />
        ) : null}
      </div>

      {isInitialLoading ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label={copy.review.loading} />
        </div>
      ) : status === "error" ? (
        <div className="panel-state">{copy.review.unableToLoad}</div>
      ) : isReady && data ? (
        rows.length > 0 ? (
          <SkillsNeedsReviewList
            rows={rows}
            pendingStructuralActions={pendingStructuralActions}
            bulkActionPending={pendingBulkAction !== null}
            selectedSkillRef={selectedSkillRef}
            onOpenSkill={onOpenSkill}
            onManageSkill={onManageSkill}
          />
        ) : needsReviewCount > 0 ? (
          <SkillsEmptyState copy={copy.filters} onResetFilters={resetFilters} />
        ) : (
          <div className="empty-panel">
            <h3 className="empty-panel__title">{copy.review.emptyTitle}</h3>
            <p className="empty-panel__body">
              {copy.review.emptyBody}
            </p>
            <div className="empty-panel__actions">
              <Link
                to="/marketplace/skills"
                className="action-pill action-pill--md action-pill--accent"
              >
                {common.actions.openMarketplace}
              </Link>
            </div>
          </div>
        )
      ) : null}

      {hasActiveFilters && rows.length === 0 ? null : null}
    </>
  );
}
