import { useMemo, useRef } from "react";
import { Link } from "react-router-dom";

import { ManagedSkillsList } from "../components/cards/ManagedSkillsList";
import { SkillsEmptyState } from "../components/pane/SkillsEmptyState";
import { SkillsPaneScaffold } from "../components/pane/SkillsPaneScaffold";
import { useManagedSkillsSession, useSkillsTabScroll } from "../model/session";
import {
  filterBuiltInRows,
  filterManagedRows,
  hasActiveManagedSkillsFilters,
} from "../model/selectors";
import { useSkillsWorkspace } from "../model/workspace-context";

export default function ManagedSkillsPage() {
  const {
    data,
    status,
    pendingToggleKeys,
    pendingStructuralActions,
    selectedSkillRef,
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
  const isReady = status === "ready" && Boolean(data);

  return (
    <SkillsPaneScaffold
      title="Managed skills"
      actions={
        data?.summary.unmanaged ? (
          <Link to="/skills/unmanaged" className="btn btn-secondary">
            Review Unmanaged
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
      scrollRef={scrollRef}
      isReady={isReady}
      isInitialLoading={isInitialLoading}
      hasError={status === "error"}
      loadingLabel="Loading managed skills"
      errorMessage="Unable to load managed skills."
    >
      {isReady && data ? (
        <>
          {rows.length > 0 ? (
            <ManagedSkillsList
              columns={data.harnessColumns}
              rows={rows}
              pendingToggleKeys={pendingToggleKeys}
              pendingStructuralActions={pendingStructuralActions}
              selectedSkillRef={selectedSkillRef}
              onOpenSkill={onOpenSkill}
              onToggleCell={onToggleCell}
            />
          ) : hasManagedInventory ? (
            <SkillsEmptyState onResetFilters={resetFilters} />
          ) : (
            <div className="skills-empty-state">
              <div>
                <p className="skills-empty-state__eyebrow">No managed skills yet</p>
                <h3>Your shared inventory is empty.</h3>
                <p>Review unmanaged skills found in supported global roots or install something from the marketplace to start managing coverage here.</p>
              </div>
              <div className="skills-empty-state__actions">
                <Link to="/skills/unmanaged" className="btn btn-primary">
                  Review Unmanaged
                </Link>
                <Link to="/marketplace" className="btn btn-secondary">
                  Open Marketplace
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
                pendingToggleKeys={pendingToggleKeys}
                pendingStructuralActions={pendingStructuralActions}
                selectedSkillRef={selectedSkillRef}
                onOpenSkill={onOpenSkill}
                onToggleCell={onToggleCell}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </SkillsPaneScaffold>
  );
}
