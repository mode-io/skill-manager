import { useMemo, useRef } from "react";
import { Link } from "react-router-dom";

import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { UnmanagedSkillsList } from "../components/cards/UnmanagedSkillsList";
import { BulkManageHelp } from "../components/harness/BulkManageHelp";
import { SkillsEmptyState } from "../components/pane/SkillsEmptyState";
import { SkillsPaneScaffold } from "../components/pane/SkillsPaneScaffold";
import { useSkillsWorkspace } from "../model/workspace-context";
import { countManageableUnmanagedRows, countUnmanagedRows, filterUnmanagedRows, hasActiveUnmanagedFilters } from "../model/selectors";
import { useSkillsTabScroll, useUnmanagedSkillsSession } from "../model/session";

export default function UnmanagedSkillsPage() {
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
  const { filters, updateFilters, resetFilters } = useUnmanagedSkillsSession();
  const scrollRef = useRef<HTMLDivElement>(null);

  useSkillsTabScroll("unmanaged", status === "ready", scrollRef);

  const rows = useMemo(() => filterUnmanagedRows(data, filters), [data, filters]);
  const hasActiveFilters = useMemo(() => hasActiveUnmanagedFilters(filters), [filters]);
  const unmanagedCount = useMemo(() => countUnmanagedRows(data), [data]);
  const manageableCount = useMemo(() => countManageableUnmanagedRows(data), [data]);
  const isReady = status === "ready" && Boolean(data);

  return (
    <SkillsPaneScaffold
      title="Unmanaged skills"
      actions={
        <>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pendingBulkAction !== null || manageableCount === 0}
            onClick={onManageAll}
          >
            {pendingBulkAction === "manage-all" ? <LoadingSpinner size="sm" label="Managing all skills" /> : null}
            Bring All Eligible Skills Under Management
          </button>
          <BulkManageHelp />
        </>
      }
      searchValue={filters.search}
      hasActiveFilters={hasActiveFilters}
      onSearchChange={(search) => updateFilters({ search })}
      onReset={resetFilters}
      searchLabel="Unmanaged skills filters"
      searchInputLabel="Search unmanaged skills"
      searchPlaceholder="Search unmanaged skills by name, description, or tool"
      scrollRef={scrollRef}
      isReady={isReady}
      isInitialLoading={isInitialLoading}
      hasError={status === "error"}
      loadingLabel="Loading unmanaged skills"
      errorMessage="Unable to load unmanaged skills."
    >
      {isReady && data ? (
        <>
          {rows.length > 0 ? (
            <UnmanagedSkillsList
              rows={rows}
              pendingStructuralActions={pendingStructuralActions}
              bulkActionPending={pendingBulkAction !== null}
              selectedSkillRef={selectedSkillRef}
              onOpenSkill={onOpenSkill}
              onManageSkill={onManageSkill}
            />
          ) : unmanagedCount > 0 ? (
            <SkillsEmptyState onResetFilters={resetFilters} />
          ) : (
            <div className="skills-empty-state">
              <div>
                <p className="skills-empty-state__eyebrow">Nothing waiting for management</p>
                <h3>No local discoveries need action right now.</h3>
                <p>Your local tool folders are either already managed or currently empty.</p>
              </div>
              <div className="skills-empty-state__actions">
                <Link to="/marketplace" className="btn btn-secondary">
                  Open Marketplace
                </Link>
              </div>
            </div>
          )}
        </>
      ) : null}
    </SkillsPaneScaffold>
  );
}
