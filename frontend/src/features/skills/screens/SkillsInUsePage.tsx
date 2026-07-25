import { useMemo, useState } from "react";
import { FolderPlus } from "lucide-react";
import { Link } from "react-router-dom";

import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { useToast } from "../../../components/Toast";
import { SelectionMenu } from "../../../components/ui/SelectionMenu";
import { useCommonCopy } from "../../../i18n";
import { MatrixView } from "../components/matrix/MatrixView";
import { SkillsEmptyState } from "../components/pane/SkillsEmptyState";
import { useSkillsCopy } from "../i18n";
import { useSkillsInUseSession } from "../model/session";
import {
  filterSkillsInUseRows,
  hasActiveSkillsInUseFilters,
} from "../model/selectors";
import { useSkillsWorkspace } from "../model/workspace-context";
import type { SkillListRow } from "../model/types";

type InUsePillValue = "all" | "enabled" | "all-harnesses" | "off";

function countEnabledCells(row: SkillListRow): number {
  return row.cells.filter((cell) => cell.state === "enabled").length;
}

function applyPillFilter(rows: SkillListRow[], pill: InUsePillValue, harnessCount: number): SkillListRow[] {
  if (pill === "all") return rows;
  if (pill === "enabled") return rows.filter((row) => countEnabledCells(row) > 0);
  if (pill === "all-harnesses") return rows.filter((row) => countEnabledCells(row) === harnessCount && harnessCount > 0);
  if (pill === "off") return rows.filter((row) => countEnabledCells(row) === 0);
  return rows;
}

export default function SkillsInUsePage() {
  const {
    data,
    status,
    pendingToggleKeys,
    selectedSkillRef,
    multiSelectedRefs,
    onOpenSkill,
    onToggleCell,
    onToggleMultiSelect,
    isInitialLoading,
  } = useSkillsWorkspace();
  const { filters, updateFilters, resetFilters } = useSkillsInUseSession();
  const { toast } = useToast();
  const copy = useSkillsCopy();
  const common = useCommonCopy();
  const [pill, setPill] = useState<InUsePillValue>("all");

  const baseRows = useMemo(() => filterSkillsInUseRows(data, filters), [data, filters]);

  const harnessCount = data?.harnessColumns.length ?? 0;
  const rows = useMemo(
    () => applyPillFilter(baseRows, pill, harnessCount),
    [baseRows, pill, harnessCount],
  );

  const pillCounts: Record<InUsePillValue, number> = useMemo(() => {
    return {
      all: baseRows.length,
      enabled: baseRows.filter((r) => countEnabledCells(r) > 0).length,
      "all-harnesses": baseRows.filter((r) => countEnabledCells(r) === harnessCount && harnessCount > 0).length,
      off: baseRows.filter((r) => countEnabledCells(r) === 0).length,
    };
  }, [baseRows, harnessCount]);
  const pillOptions = useMemo(
    () =>
      (["all", "enabled", "all-harnesses", "off"] as const).map((value) => ({
        value,
        label: pillLabel(copy, value),
        meta: pillCounts[value],
      })),
    [copy, pillCounts],
  );

  const hasActiveFilters = hasActiveSkillsInUseFilters(filters) || pill !== "all";
  const hasInUseInventory = (data?.summary.managed ?? 0) > 0;
  const isReady = status === "ready" && Boolean(data);

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title={copy.inUse.title}
          subtitle={hasInUseInventory ? copy.inUse.subtitle(data?.summary.managed ?? 0) : undefined}
          actions={
            <button
              type="button"
              className="action-pill action-pill--md"
              onClick={() => toast(copy.inUse.importFolderComingSoon)}
            >
              <FolderPlus size={14} />
              {copy.inUse.importFolder}
            </button>
          }
        />

        <FilterBar
          searchValue={filters.search}
          onSearchChange={(search) => updateFilters({ search })}
          searchPlaceholder={copy.inUse.searchPlaceholder}
          searchLabel={copy.inUse.searchLabel}
          trailing={
            <SelectionMenu
              value={pill}
              options={pillOptions}
              active={pill !== "all"}
              ariaLabel={copy.inUse.filterAria(pillLabel(copy, pill))}
              onChange={setPill}
            />
          }
        />
      </div>

      {isInitialLoading ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label={copy.inUse.loading} />
        </div>
      ) : status === "error" ? (
        <div className="panel-state">{copy.inUse.unableToLoad}</div>
      ) : isReady && data ? (
        rows.length > 0 ? (
          <MatrixView
            rows={rows}
            harnessColumns={data.harnessColumns}
            checkedRefs={multiSelectedRefs}
            selectedSkillRef={selectedSkillRef}
            pendingToggleKeys={pendingToggleKeys}
            onOpenSkill={onOpenSkill}
            onToggleChecked={onToggleMultiSelect}
            onToggleCell={onToggleCell}
          />
        ) : hasInUseInventory || hasActiveFilters ? (
          <SkillsEmptyState
            copy={copy.filters}
            onResetFilters={() => {
              resetFilters();
              setPill("all");
            }}
          />
        ) : (
          <div className="empty-panel">
            <h3 className="empty-panel__title">{copy.inUse.emptyTitle}</h3>
            <p className="empty-panel__body">
              {copy.inUse.emptyBody}
            </p>
            <div className="empty-panel__actions">
              <Link
                to="/skills/review"
                className="action-pill action-pill--md action-pill--accent"
              >
                {common.actions.reviewItems}
              </Link>
              <Link
                to="/marketplace/skills"
                className="action-pill action-pill--md"
              >
                {common.actions.openMarketplace}
              </Link>
            </div>
          </div>
        )
      ) : null}
    </>
  );
}

function pillLabel(copy: ReturnType<typeof useSkillsCopy>, value: InUsePillValue): string {
  if (value === "all") return copy.inUse.pills.all;
  if (value === "enabled") return copy.inUse.pills.enabled;
  if (value === "all-harnesses") return copy.inUse.pills.allHarnesses;
  return copy.inUse.pills.off;
}
