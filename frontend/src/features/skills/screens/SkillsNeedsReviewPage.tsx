import { useMemo } from "react";
import { Link } from "react-router-dom";

import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { SkillsNeedsReviewList } from "../components/cards/SkillsNeedsReviewList";
import { SkillsEmptyState } from "../components/pane/SkillsEmptyState";
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

  const rows = useMemo(() => filterNeedsReviewRows(data, filters), [data, filters]);
  const hasActiveFilters = useMemo(() => hasActiveNeedsReviewFilters(filters), [filters]);
  const needsReviewCount = useMemo(() => countNeedsReviewRows(data), [data]);
  const adoptableCount = useMemo(() => countAdoptableLocalSkillRows(data), [data]);
  const isReady = status === "ready" && Boolean(data);

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title="Skills to review"
          subtitle={
            needsReviewCount > 0
              ? `${needsReviewCount} skill${needsReviewCount === 1 ? "" : "s"} need${needsReviewCount === 1 ? "s" : ""} a review decision.`
              : "No local skill folders need review across your harnesses."
          }
          actions={
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              disabled={pendingBulkAction !== null || adoptableCount === 0}
              onClick={onManageAll}
            >
              {pendingBulkAction === "manage-all" ? (
                <LoadingSpinner size="sm" label="Adopting all skills" />
              ) : null}
              Adopt all eligible
            </button>
          }
        />

        {needsReviewCount > 0 ? (
          <FilterBar
            searchValue={filters.search}
            onSearchChange={(search) => updateFilters({ search })}
            searchPlaceholder="Search skills to review..."
            searchLabel="Search skills to review"
          />
        ) : null}
      </div>

      {isInitialLoading ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label="Loading skills to review" />
        </div>
      ) : status === "error" ? (
        <div className="panel-state">Unable to load skills to review.</div>
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
          <SkillsEmptyState onResetFilters={resetFilters} />
        ) : (
          <div className="empty-panel">
            <h3 className="empty-panel__title">Nothing needs review</h3>
            <p className="empty-panel__body">
              Your local harness folders are either already in use through Skill Manager or currently empty. Install
              from the marketplace to add new skills.
            </p>
            <div className="empty-panel__actions">
              <Link
                to="/marketplace/skills"
                className="action-pill action-pill--md action-pill--accent"
              >
                Open Marketplace
              </Link>
            </div>
          </div>
        )
      ) : null}

      {hasActiveFilters && rows.length === 0 ? null : null}
    </>
  );
}
