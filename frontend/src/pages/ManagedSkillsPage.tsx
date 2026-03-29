import { useMemo, useRef } from "react";
import { Link } from "react-router-dom";

import { LoadingSpinner } from "../components/LoadingSpinner";
import { ManagedSkillsList } from "../components/skills/ManagedSkillsList";
import { SkillsEmptyState } from "../components/skills/SkillsEmptyState";
import { SkillsPaneChrome } from "../components/skills/SkillsPaneChrome";
import { useManagedSkillsSession, useSkillsTabScroll } from "../features/skills/session";
import {
  filterBuiltInRows,
  filterManagedRows,
  hasActiveManagedSkillsFilters,
} from "../features/skills/selectors";
import { useSkillsWorkspace } from "../components/skills/workspace";

export function ManagedSkillsPage() {
  const {
    data,
    status,
    busyId,
    selectedSkillRef,
    onManageSkill,
    onOpenSkill,
    onToggleCell,
    isInitialLoading,
  } = useSkillsWorkspace();
  const { filters, updateFilters, resetFilters } = useManagedSkillsSession();
  const scrollRef = useRef<HTMLDivElement>(null);

  useSkillsTabScroll("managed", status === "ready", scrollRef);

  const rows = useMemo(() => filterManagedRows(data, filters), [data, filters]);
  const builtInRows = useMemo(() => filterBuiltInRows(data), [data]);
  const hasActiveFilters = useMemo(() => hasActiveManagedSkillsFilters(filters), [filters]);
  const hasManagedInventory = (data?.summary.managed ?? 0) + (data?.summary.custom ?? 0) > 0;

  return (
    <section className="skills-pane">
      {status === "ready" && data ? (
        <>
          <SkillsPaneChrome
            title="Managed skills"
            actions={
              data.summary.unmanaged > 0 ? (
                <Link to="/skills/unmanaged" className="btn btn-secondary">
                  Review unmanaged
                </Link>
              ) : null
            }
            searchValue={filters.search}
            hasActiveFilters={hasActiveFilters}
            onSearchChange={(search) => updateFilters({ search })}
            onReset={resetFilters}
            searchLabel="Managed skills filters"
            searchInputLabel="Search managed skills"
            searchPlaceholder="Search managed skills by name, description, or state"
          />

          <div className="skills-pane__scroll" ref={scrollRef}>
            <div className="skills-pane__content">
              {rows.length > 0 ? (
                <ManagedSkillsList
                  columns={data.harnessColumns}
                  rows={rows}
                  busyId={busyId}
                  selectedSkillRef={selectedSkillRef}
                  onOpenSkill={onOpenSkill}
                  onManageSkill={onManageSkill}
                  onToggleCell={onToggleCell}
                />
              ) : hasManagedInventory ? (
                <SkillsEmptyState onResetFilters={resetFilters} />
              ) : (
                <div className="skills-empty-state">
                  <div>
                    <p className="skills-empty-state__eyebrow">No managed skills yet</p>
                    <h3>Your shared inventory is empty.</h3>
                    <p>Review detected local skills or install something from the marketplace to start managing coverage here.</p>
                  </div>
                  <div className="skills-empty-state__actions">
                    <Link to="/skills/unmanaged" className="btn btn-primary">
                      Review unmanaged
                    </Link>
                    <Link to="/marketplace" className="btn btn-secondary">
                      Open marketplace
                    </Link>
                  </div>
                </div>
              )}

              {builtInRows.length > 0 ? (
                <section className="skills-secondary-section">
                  <div className="skills-secondary-section__header">
                    <div>
                      <p className="skills-secondary-section__eyebrow">Reference only</p>
                      <h4>Built-in skills</h4>
                      <p>These come from harnesses directly and stay outside the shared managed flow.</p>
                    </div>
                  </div>
                  <ManagedSkillsList
                    ariaLabel="Built-in skills list"
                    columns={data.harnessColumns}
                    rows={builtInRows}
                    busyId={busyId}
                    selectedSkillRef={selectedSkillRef}
                    onOpenSkill={onOpenSkill}
                    onManageSkill={onManageSkill}
                    onToggleCell={onToggleCell}
                  />
                </section>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {isInitialLoading ? (
        <div className="panel-state skills-pane__state">
          <LoadingSpinner label="Loading managed skills" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="panel-state skills-pane__state">
          <p>Unable to load managed skills.</p>
        </div>
      ) : null}
    </section>
  );
}
