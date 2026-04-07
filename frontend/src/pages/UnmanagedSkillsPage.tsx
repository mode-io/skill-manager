import { useMemo, useRef } from "react";
import { Link } from "react-router-dom";

import { LoadingSpinner } from "../components/LoadingSpinner";
import { BulkManageHelp } from "../components/skills/BulkManageHelp";
import { SkillsEmptyState } from "../components/skills/SkillsEmptyState";
import { SkillsPaneChrome } from "../components/skills/SkillsPaneChrome";
import { UnmanagedSkillsList } from "../components/skills/UnmanagedSkillsList";
import { useSkillsWorkspace } from "../components/skills/workspace";
import { countManageableUnmanagedRows, countUnmanagedRows, filterUnmanagedRows, hasActiveUnmanagedFilters } from "../features/skills/selectors";
import { useSkillsTabScroll, useUnmanagedSkillsSession } from "../features/skills/session";

export function UnmanagedSkillsPage() {
  const {
    data,
    status,
    busyId,
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

  return (
    <section className="skills-pane">
      {status === "ready" && data ? (
        <>
          <SkillsPaneChrome
            title="Unmanaged skills"
            actions={
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyId !== null || manageableCount === 0}
                  onClick={onManageAll}
                >
                  {busyId === "manage-all" ? <LoadingSpinner size="sm" label="Managing all skills" /> : null}
                  Bring all eligible skills under management
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
          />

          <div className="skills-pane__scroll ui-scrollbar" ref={scrollRef}>
            <div className="skills-pane__content">
              {rows.length > 0 ? (
                <UnmanagedSkillsList
                  rows={rows}
                  busyId={busyId}
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
                      Open marketplace
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {isInitialLoading ? (
        <div className="panel-state skills-pane__state">
          <LoadingSpinner label="Loading unmanaged skills" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="panel-state skills-pane__state">
          <p>Unable to load unmanaged skills.</p>
        </div>
      ) : null}
    </section>
  );
}
