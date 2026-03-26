import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { LoadingSpinner } from "../components/LoadingSpinner";
import { FoundLocalSkillsList } from "../components/skills/FoundLocalSkillsList";
import { FoundLocalSkillsOverview } from "../components/skills/FoundLocalSkillsOverview";
import { FoundLocalSkillsToolbar } from "../components/skills/FoundLocalSkillsToolbar";
import { SkillsEmptyState } from "../components/skills/SkillsEmptyState";
import {
  buildFoundLocalOverview,
  filterFoundLocalRows,
  hasActiveFoundLocalSkillsFilters,
  resetFoundLocalSkillsFilters,
  type FoundLocalSkillsFilterState,
} from "../components/skills/model";
import { useSkillsWorkspace } from "../components/skills/workspace";

export function FoundLocalSkillsPage(): JSX.Element {
  const { data, status, busyId, onManageAll, onOpenSkill, onRunPrimaryAction } = useSkillsWorkspace();
  const [filters, setFilters] = useState<FoundLocalSkillsFilterState>(() => resetFoundLocalSkillsFilters());

  const overview = useMemo(() => buildFoundLocalOverview(data), [data]);
  const rows = useMemo(() => filterFoundLocalRows(data, filters), [data, filters]);
  const hasActiveFilters = useMemo(() => hasActiveFoundLocalSkillsFilters(filters), [filters]);
  const hasFoundLocalRows = overview.foundLocally > 0;

  function updateFilters(partial: Partial<FoundLocalSkillsFilterState>): void {
    setFilters((current) => ({ ...current, ...partial }));
  }

  return (
    <section className="skills-pane">
      <div className="skills-pane__header">
        <div>
          <p className="skills-pane__eyebrow">Intake queue</p>
          <h3>Found locally</h3>
          <p className="skills-pane__copy">
            Review skills discovered in local tool folders and bring the ones you want into the shared managed store.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busyId !== null || overview.eligibleNow === 0}
          onClick={onManageAll}
        >
          {busyId === "manage-all" ? <LoadingSpinner size="sm" label="Managing all skills" /> : null}
          Bring all eligible skills under management
        </button>
      </div>

      {status === "loading" ? (
        <div className="panel-state">
          <LoadingSpinner label="Loading found local skills" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="panel-state">
          <p>Unable to load local discoveries.</p>
        </div>
      ) : null}

      {status === "ready" && data ? (
        <>
          <FoundLocalSkillsOverview overview={overview} />

          <FoundLocalSkillsToolbar
            columns={data.harnessColumns}
            filters={filters}
            hasActiveFilters={hasActiveFilters}
            onSearchChange={(value) => updateFilters({ search: value })}
            onHarnessFilterChange={(value) => updateFilters({ harnessFilter: value })}
            onSortByChange={(value) => updateFilters({ sortBy: value })}
            onResetFilters={() => setFilters(resetFoundLocalSkillsFilters())}
          />

          {rows.length > 0 ? (
            <FoundLocalSkillsList
              rows={rows}
              busyId={busyId}
              onOpenSkill={onOpenSkill}
              onRunPrimaryAction={onRunPrimaryAction}
            />
          ) : hasFoundLocalRows ? (
            <SkillsEmptyState onResetFilters={() => setFilters(resetFoundLocalSkillsFilters())} />
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
        </>
      ) : null}
    </section>
  );
}
