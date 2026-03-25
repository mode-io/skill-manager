import { useEffect, useMemo, useState } from "react";

import { disableSkill, enableSkill, fetchSkillsPage, manageAllSkills, manageSkill } from "../api/client";
import type { HarnessCell, SkillTableRow, SkillsPageData } from "../api/types";
import { SkillsEmptyState } from "../components/skills/SkillsEmptyState";
import { SkillsOverviewStrip } from "../components/skills/SkillsOverviewStrip";
import { SkillsTable } from "../components/skills/SkillsTable";
import { SkillsToolbar } from "../components/skills/SkillsToolbar";
import {
  filterSkillsRows,
  hasActiveSkillsFilters,
  nextStatusFilterForMetric,
  resetSkillsFilters,
  type SkillsFilterState,
} from "../components/skills/model";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { SkillDetailDrawer } from "../components/SkillDetailDrawer";

interface SkillsPageProps {
  refreshToken: number;
  onDataChanged: () => void;
}

export function SkillsPage({ refreshToken, onDataChanged }: SkillsPageProps): JSX.Element {
  const [data, setData] = useState<SkillsPageData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [filters, setFilters] = useState<SkillsFilterState>(() => resetSkillsFilters());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedSkillRef, setSelectedSkillRef] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMessage("");
    void fetchSkillsPage()
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setErrorMessage(error.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const visibleRows = useMemo(() => filterSkillsRows(data, filters), [data, filters]);
  const hasActiveFilters = useMemo(() => hasActiveSkillsFilters(filters), [filters]);

  async function runAction(actionId: string, task: () => Promise<unknown>): Promise<void> {
    try {
      setBusyId(actionId);
      await task();
      onDataChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete the action.");
    } finally {
      setBusyId(null);
    }
  }

  function updateFilters(partial: Partial<SkillsFilterState>): void {
    setFilters((current) => ({ ...current, ...partial }));
  }

  function handleOverviewMetric(metric: "needsAction" | "managed" | "foundLocally" | "custom" | "builtIn"): void {
    if (metric === "builtIn") {
      setFilters((current) => ({ ...current, showBuiltIns: !current.showBuiltIns }));
      return;
    }
    setFilters((current) => ({ ...current, statusFilter: nextStatusFilterForMetric(metric, current.statusFilter) }));
  }

  function handleToggleCell(row: SkillTableRow, cell: HarnessCell): void {
    void runAction(
      `${row.skillRef}:${cell.harness}`,
      () => cell.state === "enabled"
        ? disableSkill(row.skillRef, cell.harness)
        : enableSkill(row.skillRef, cell.harness),
    );
  }

  function handlePrimaryAction(row: SkillTableRow): void {
    if (row.primaryAction.kind === "manage") {
      void runAction(`manage:${row.skillRef}`, () => manageSkill(row.skillRef));
      return;
    }
    setSelectedSkillRef(row.skillRef);
  }

  return (
    <>
      <section className="page-panel skills-page">
        <div className="skills-page__header">
          <div>
            <p className="page-header__eyebrow">Primary workspace</p>
            <h2>Skills</h2>
            <p className="page-header__copy">
              Manage one shared skill inventory, enable it per tool, and bring local copies under management.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busyId !== null || !data?.summary.foundLocally}
            onClick={() => void runAction("manage-all", manageAllSkills)}
          >
            {busyId === "manage-all" ? <LoadingSpinner size="sm" label="Managing all skills" /> : null}
            Bring all eligible skills under management
          </button>
        </div>

        {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage("")} />}

        {data ? (
          <SkillsOverviewStrip summary={data.summary} filters={filters} onSelectMetric={handleOverviewMetric} />
        ) : null}

        <SkillsToolbar
          columns={data?.harnessColumns ?? []}
          filters={filters}
          hasActiveFilters={hasActiveFilters}
          onSearchChange={(value) => updateFilters({ search: value })}
          onStatusFilterChange={(value) => updateFilters({ statusFilter: value })}
          onHarnessFilterChange={(value) => updateFilters({ harnessFilter: value })}
          onSortByChange={(value) => updateFilters({ sortBy: value })}
          onShowBuiltInsChange={(value) => updateFilters({ showBuiltIns: value })}
          onResetFilters={() => setFilters(resetSkillsFilters())}
        />

        {status === "loading" ? (
          <div className="panel-state">
            <LoadingSpinner label="Loading skills" />
          </div>
        ) : null}

        {status === "ready" && data ? (
          visibleRows.length > 0 ? (
            <SkillsTable
              columns={data.harnessColumns}
              rows={visibleRows}
              busyId={busyId}
              onOpenSkill={setSelectedSkillRef}
              onToggleCell={handleToggleCell}
              onRunPrimaryAction={handlePrimaryAction}
            />
          ) : (
            <SkillsEmptyState onResetFilters={() => setFilters(resetSkillsFilters())} />
          )
        ) : null}

        {status === "error" ? (
          <div className="panel-state">
            <p>Unable to load the skills inventory.</p>
          </div>
        ) : null}
      </section>

      <SkillDetailDrawer
        skillRef={selectedSkillRef}
        refreshToken={refreshToken}
        onClose={() => setSelectedSkillRef(null)}
        onDataChanged={onDataChanged}
      />
    </>
  );
}
