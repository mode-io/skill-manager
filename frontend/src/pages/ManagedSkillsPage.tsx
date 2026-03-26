import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { LoadingSpinner } from "../components/LoadingSpinner";
import { ManagedSkillsList } from "../components/skills/ManagedSkillsList";
import { ManagedSkillsOverview } from "../components/skills/ManagedSkillsOverview";
import { ManagedSkillsToolbar } from "../components/skills/ManagedSkillsToolbar";
import { SkillsEmptyState } from "../components/skills/SkillsEmptyState";
import {
  buildManagedOverview,
  filterBuiltInRows,
  filterManagedRows,
  hasActiveManagedSkillsFilters,
  resetManagedSkillsFilters,
  type ManagedSkillsFilterState,
} from "../components/skills/model";
import { useSkillsWorkspace } from "../components/skills/workspace";

export function ManagedSkillsPage(): JSX.Element {
  const { data, status, busyId, onOpenSkill, onToggleCell, onRunPrimaryAction } = useSkillsWorkspace();
  const [filters, setFilters] = useState<ManagedSkillsFilterState>(() => resetManagedSkillsFilters());

  const overview = useMemo(() => buildManagedOverview(data), [data]);
  const rows = useMemo(() => filterManagedRows(data, filters), [data, filters]);
  const builtInRows = useMemo(() => filterBuiltInRows(data, filters.showBuiltIns), [data, filters.showBuiltIns]);
  const hasActiveFilters = useMemo(() => hasActiveManagedSkillsFilters(filters), [filters]);
  const hasManagedInventory = overview.managed + overview.custom > 0;

  function updateFilters(partial: Partial<ManagedSkillsFilterState>): void {
    setFilters((current) => ({ ...current, ...partial }));
  }

  return (
    <section className="skills-pane">
      <div className="skills-pane__header">
        <div>
          <p className="skills-pane__eyebrow">Operate what you manage</p>
          <h3>Managed skills</h3>
          <p className="skills-pane__copy">
            Enable shared skills per tool, review custom edits, and use the drawer for updates and deeper diagnostics.
          </p>
        </div>
        {data && data.summary.foundLocally > 0 ? (
          <Link to="/skills/found-local" className="btn btn-secondary">
            Review found locally
          </Link>
        ) : null}
      </div>

      {status === "loading" ? (
        <div className="panel-state">
          <LoadingSpinner label="Loading managed skills" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="panel-state">
          <p>Unable to load managed skills.</p>
        </div>
      ) : null}

      {status === "ready" && data ? (
        <>
          <ManagedSkillsOverview overview={overview} />

          <ManagedSkillsToolbar
            columns={data.harnessColumns}
            filters={filters}
            hasActiveFilters={hasActiveFilters}
            onSearchChange={(value) => updateFilters({ search: value })}
            onStatusFilterChange={(value) => updateFilters({ statusFilter: value })}
            onHarnessFilterChange={(value) => updateFilters({ harnessFilter: value })}
            onSortByChange={(value) => updateFilters({ sortBy: value })}
            onShowBuiltInsChange={(value) => updateFilters({ showBuiltIns: value })}
            onResetFilters={() => setFilters(resetManagedSkillsFilters())}
          />

          {rows.length > 0 ? (
            <ManagedSkillsList
              columns={data.harnessColumns}
              rows={rows}
              busyId={busyId}
              onOpenSkill={onOpenSkill}
              onToggleCell={onToggleCell}
              onRunPrimaryAction={onRunPrimaryAction}
            />
          ) : hasManagedInventory ? (
            <SkillsEmptyState onResetFilters={() => setFilters(resetManagedSkillsFilters())} />
          ) : (
            <div className="skills-empty-state">
              <div>
                <p className="skills-empty-state__eyebrow">No managed skills yet</p>
                <h3>Your shared inventory is empty.</h3>
                <p>Review detected local skills or install something from the marketplace to start managing coverage here.</p>
              </div>
              <div className="skills-empty-state__actions">
                <Link to="/skills/found-local" className="btn btn-primary">
                  Review found locally
                </Link>
                <Link to="/marketplace" className="btn btn-secondary">
                  Open marketplace
                </Link>
              </div>
            </div>
          )}

          {filters.showBuiltIns ? (
            builtInRows.length > 0 ? (
              <section className="skills-secondary-section">
                <div className="skills-secondary-section__header">
                  <div>
                    <p className="skills-secondary-section__eyebrow">Reference only</p>
                    <h4>Built-in skills</h4>
                    <p>These come from harnesses directly and stay outside the shared managed flow.</p>
                  </div>
                </div>
                <ManagedSkillsList
                  columns={data.harnessColumns}
                  rows={builtInRows}
                  busyId={busyId}
                  onOpenSkill={onOpenSkill}
                  onToggleCell={onToggleCell}
                  onRunPrimaryAction={onRunPrimaryAction}
                />
              </section>
            ) : (
              <section className="skills-secondary-section">
                <div className="skills-secondary-section__header">
                  <div>
                    <p className="skills-secondary-section__eyebrow">Reference only</p>
                    <h4>Built-in skills</h4>
                    <p>No built-in skills were detected in the current environment.</p>
                  </div>
                </div>
              </section>
            )
          ) : null}
        </>
      ) : null}
    </section>
  );
}
