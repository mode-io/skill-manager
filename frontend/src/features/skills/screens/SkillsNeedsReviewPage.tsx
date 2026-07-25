import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, X } from "lucide-react";

import { CardSelectCheckbox } from "../../../components/cards/CardSelectCheckbox";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import {
  MatrixHarnessCellTarget,
  MatrixHarnessHeader,
  MatrixHarnessIcon,
  MatrixSortableHeader,
  MatrixTable,
} from "../../../components/matrix";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { useCommonCopy } from "../../../i18n";
import { SkillsEmptyState } from "../components/pane/SkillsEmptyState";
import { useSkillsCopy } from "../i18n";
import { useSkillsWorkspace } from "../model/workspace-context";
import {
  countAdoptableLocalSkillRows,
  countNeedsReviewRows,
  filterNeedsReviewRows,
} from "../model/selectors";
import { sortKeysEqual, sortRows, type SortKey, type SortState } from "../model/sortRows";
import { useSkillsNeedsReviewSession } from "../model/session";

const INITIAL_SORT: SortState = { key: "name", direction: "asc" };

export default function SkillsNeedsReviewPage() {
  const {
    data,
    status,
    pendingStructuralActions,
    pendingBulkAction,
    onManageAll,
    onManageSkill,
    onOpenSkill,
    isInitialLoading,
  } = useSkillsWorkspace();
  const { filters, updateFilters, resetFilters } = useSkillsNeedsReviewSession();
  const copy = useSkillsCopy();
  const common = useCommonCopy();

  const [sort, setSort] = useState<SortState>(INITIAL_SORT);
  const [selectedRefs, setSelectedRefs] = useState<ReadonlySet<string>>(() => new Set());
  const [adoptingSelected, setAdoptingSelected] = useState(false);

  const rows = useMemo(() => filterNeedsReviewRows(data, filters), [data, filters]);
  const sortedRows = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const needsReviewCount = useMemo(() => countNeedsReviewRows(data), [data]);
  const adoptableCount = useMemo(() => countAdoptableLocalSkillRows(data), [data]);
  const isReady = status === "ready" && Boolean(data);
  const harnessColumns = data?.harnessColumns ?? [];

  // Only adoptable (canManage) rows participate in multi-select adoption.
  const adoptableRefs = useMemo(
    () => new Set(sortedRows.filter((row) => row.actions.canManage).map((row) => row.skillRef)),
    [sortedRows],
  );

  // Drop any selection that is no longer a visible, adoptable row.
  useEffect(() => {
    setSelectedRefs((current) => {
      let changed = false;
      const next = new Set<string>();
      for (const ref of current) {
        if (adoptableRefs.has(ref)) {
          next.add(ref);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [adoptableRefs]);

  const requestSort = (key: SortKey) => {
    setSort((current) => {
      if (sortKeysEqual(current.key, key)) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const toggleSelected = (skillRef: string) => {
    setSelectedRefs((current) => {
      const next = new Set(current);
      if (next.has(skillRef)) {
        next.delete(skillRef);
      } else {
        next.add(skillRef);
      }
      return next;
    });
  };

  const clearSelected = () => setSelectedRefs(new Set());

  const selectedCount = selectedRefs.size;

  async function handleAdoptSelected(): Promise<void> {
    const refs = sortedRows
      .filter((row) => selectedRefs.has(row.skillRef) && row.actions.canManage)
      .map((row) => row.skillRef);
    if (refs.length === 0) {
      return;
    }
    setAdoptingSelected(true);
    try {
      for (const ref of refs) {
        try {
          // eslint-disable-next-line no-await-in-loop -- adopt sequentially so failures surface one at a time
          await onManageSkill(ref);
        } catch {
          // Failure is already surfaced via the workspace error banner; keep adopting the rest.
        }
      }
      setSelectedRefs(new Set());
    } finally {
      setAdoptingSelected(false);
    }
  }

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
        sortedRows.length > 0 ? (
          <MatrixTable
            ariaLabel="Skills to adopt"
            harnessColumnWidth="52px"
            compactColumnWidth="140px"
            coverageColumnWidth="96px"
          >
            <thead className="matrix-table__head">
              <tr>
                <th className="matrix-table__th matrix-table__th--checkbox" aria-label="Select" />
                <MatrixSortableHeader
                  label="Name"
                  align="identity"
                  active={sortKeysEqual(sort.key, "name")}
                  direction={sort.direction}
                  onClick={() => requestSort("name")}
                />
                {harnessColumns.map((column) => (
                  <MatrixHarnessHeader
                    key={column.harness}
                    label={column.label}
                    logoKey={column.logoKey}
                    harness={column.harness}
                  />
                ))}
                <th className="matrix-table__th matrix-table__th--compact" aria-label="Harnesses">
                  Harnesses
                </th>
                <th className="matrix-table__th matrix-table__th--action">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const managing = pendingStructuralActions.get(row.skillRef) === "manage";
                const actionDisabled =
                  pendingBulkAction !== null ||
                  pendingStructuralActions.get(row.skillRef) != null ||
                  !row.actions.canManage;
                const selectable = row.actions.canManage;
                const isSelected = selectedRefs.has(row.skillRef);
                const foundCount = harnessColumns.filter((column) =>
                  row.cells.some((cell) => cell.harness === column.harness && cell.state === "found"),
                ).length;
                return (
                  <tr
                    key={row.skillRef}
                    className="matrix-table__row"
                    data-checked={isSelected ? "true" : undefined}
                  >
                    <td className="matrix-table__cell matrix-table__cell--checkbox">
                      <CardSelectCheckbox
                        checked={isSelected}
                        disabled={!selectable || adoptingSelected}
                        label={isSelected ? `Deselect ${row.name}` : `Select ${row.name}`}
                        onToggle={() => toggleSelected(row.skillRef)}
                      />
                    </td>
                    <td className="matrix-table__cell matrix-table__cell--identity">
                      <button
                        type="button"
                        className="mcp-matrix__server-button"
                        aria-label={`Open ${row.name}`}
                        onClick={() => onOpenSkill(row.skillRef)}
                      >
                        <span className="matrix-table__name-row">
                          <span className="matrix-table__name-text">{row.name}</span>
                        </span>
                        {row.description ? (
                          <span className="matrix-table__description">{row.description}</span>
                        ) : null}
                      </button>
                    </td>
                    {harnessColumns.map((column) => {
                      const discovered = row.cells.some(
                        (cell) => cell.harness === column.harness && cell.state === "found",
                      );
                      return (
                        <td
                          key={column.harness}
                          className="matrix-table__cell matrix-table__cell--harness"
                        >
                          <UiTooltip
                            content={
                              discovered
                                ? `Found in ${column.label} config`
                                : `Not found in ${column.label}`
                            }
                          >
                            <MatrixHarnessCellTarget
                              state={discovered ? "observed" : "empty"}
                              ariaLabel={
                                discovered
                                  ? `Discovered in ${column.label}`
                                  : `Not found in ${column.label}`
                              }
                              disabled
                            >
                              {discovered ? (
                                <MatrixHarnessIcon
                                  label={column.label}
                                  logoKey={column.logoKey}
                                  harness={column.harness}
                                />
                              ) : (
                                "—"
                              )}
                            </MatrixHarnessCellTarget>
                          </UiTooltip>
                        </td>
                      );
                    })}
                    <td className="matrix-table__cell matrix-table__cell--compact">
                      <span
                        className="matrix-table__coverage"
                        aria-label={`Found in ${foundCount} of ${harnessColumns.length} harnesses`}
                      >
                        <span className="matrix-table__coverage-count">{foundCount}</span>
                        <span className="matrix-table__coverage-total" aria-hidden="true">
                          {" / "}
                          {harnessColumns.length}
                        </span>
                      </span>
                    </td>
                    <td className="matrix-table__cell matrix-table__cell--action">
                      <button
                        type="button"
                        className="action-pill action-pill--accent"
                        disabled={actionDisabled}
                        title={
                          row.actions.canManage
                            ? "Add this skill to Skill Manager"
                            : "This skill cannot be adopted automatically"
                        }
                        onClick={() => void onManageSkill(row.skillRef)}
                      >
                        {managing ? (
                          <Loader2 size={12} className="card-action-spinner" aria-hidden="true" />
                        ) : null}
                        Adopt
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </MatrixTable>
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

      {selectedCount > 0 ? (
        <div className="bulk-dock">
          <div className="bulk-dock__fade" />
          <div
            className="bulk-bar"
            data-state="open"
            role="toolbar"
            aria-label={common.bulk.ariaLabel}
          >
            <div className="bulk-bar__group">
              <span className="bulk-bar__count">{common.bulk.selected(selectedCount)}</span>
              <button
                type="button"
                className="bulk-bar__clear"
                onClick={clearSelected}
                disabled={adoptingSelected}
                aria-label={common.actions.clearSelection}
              >
                <X size={14} />
              </button>
            </div>

            <span className="bulk-bar__divider" aria-hidden="true" />

            <button
              type="button"
              className="bulk-bar__action"
              onClick={() => void handleAdoptSelected()}
              disabled={adoptingSelected}
            >
              {adoptingSelected ? (
                <LoadingSpinner size="sm" label={copy.review.adoptingSelected} />
              ) : (
                <Plus size={15} />
              )}
              {copy.review.adoptSelected}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
