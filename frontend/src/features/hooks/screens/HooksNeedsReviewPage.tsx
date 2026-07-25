import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, X } from "lucide-react";

import { CardSelectCheckbox } from "../../../components/cards/CardSelectCheckbox";
import { useCommonCopy } from "../../../i18n";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import {
  MatrixHarnessCellTarget,
  MatrixHarnessHeader,
  MatrixHarnessIcon,
  MatrixTable,
} from "../../../components/matrix";
import { OverflowTooltipText } from "../../../components/ui/OverflowTooltipText";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { hooksRoutes } from "../public";
import {
  useHooksInventoryQuery,
  usePromoteHookMutation,
} from "../api/management-queries";
import { filterHooksNeedsReview } from "../model/selectors";
import { HooksStatusChip } from "../components/HooksStatusChip";

export default function HooksNeedsReviewPage() {
  const inventoryQuery = useHooksInventoryQuery();
  const promoteMutation = usePromoteHookMutation();

  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const inventory = inventoryQuery.data ?? null;
  const entries = useMemo(() => filterHooksNeedsReview(inventory, search), [inventory, search]);
  const totalReview = useMemo(() => filterHooksNeedsReview(inventory, "").length, [inventory]);
  const columns = inventory?.columns ?? [];


  const common = useCommonCopy();
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [adoptingSelected, setAdoptingSelected] = useState(false);

  useEffect(() => {
    setSelectedIds((current) => {
      let changed = false;
      const next = new Set<string>();
      const entryIds = new Set(entries.map((e) => e.id));
      for (const id of current) {
        if (entryIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : current;
    });
  }, [entries]);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelected = () => setSelectedIds(new Set());

  const handleAdoptSelected = async () => {
    const ids = entries.filter((e) => selectedIds.has(e.id)).map((e) => e.id);
    if (ids.length === 0) return;
    setAdoptingSelected(true);
    try {
      for (const id of ids) {
        try {
          await promoteMutation.mutateAsync({ id });
        } catch {
        }
      }
      setSelectedIds(new Set());
    } finally {
      setAdoptingSelected(false);
    }
  };

  const handleAdoptAll = async () => {
    const ids = entries.map((e) => e.id);
    if (ids.length === 0) return;
    setAdoptingSelected(true);
    try {
      for (const id of ids) {
        try {
          await promoteMutation.mutateAsync({ id });
        } catch {
        }
      }
      setSelectedIds(new Set());
    } finally {
      setAdoptingSelected(false);
    }
  };

  const selectedCount = selectedIds.size;
  const adoptableCount = entries.length;

  const isInitialLoading = inventoryQuery.isPending && !inventory;
  const loadError = inventoryQuery.error instanceof Error ? inventoryQuery.error.message : "";

  const handlePromote = async (id: string) => {
    setPendingId(id);
    setErrorMessage("");
    try {
      await promoteMutation.mutateAsync({ id });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not promote hook");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title="Hooks to review"
          subtitle="Hooks found in your harness configs that skill-manager does not yet track. Promote the ones you want to manage globally."
        actions={
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              disabled={adoptingSelected || adoptableCount === 0}
              onClick={() => void handleAdoptAll()}
            >
              Adopt all eligible
            </button>
          }
        />
        {totalReview > 0 ? (
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by event or command..."
            searchLabel="Search hooks to review"
          />
        ) : null}
      </div>

      {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage("")} /> : null}

      {isInitialLoading ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label="Loading hooks" />
        </div>
      ) : loadError ? (
        <div className="panel-state">{loadError}</div>
      ) : totalReview === 0 ? (
        <div className="empty-panel">
          <h3 className="empty-panel__title">No hooks need review</h3>
          <p className="empty-panel__body">
            Your harness configs only reference hooks that skill-manager already tracks.
          </p>
          <div className="empty-panel__actions">
            <Link to={hooksRoutes.inUse} className="action-pill action-pill--md action-pill--accent">
              View Hooks in Use
            </Link>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-panel">
          <h3 className="empty-panel__title">No matches</h3>
          <p className="empty-panel__body">Adjust the search to see other hooks.</p>
          <div className="empty-panel__actions">
            <button type="button" className="action-pill action-pill--md" onClick={() => setSearch("")}>
              Clear search
            </button>
          </div>
        </div>
      ) : (
        <MatrixTable
          ariaLabel="Hooks to review"
          harnessColumnWidth="52px"
          compactColumnWidth="140px"
          coverageColumnWidth="96px"
          minWidth="800px"
        >
          <thead className="matrix-table__head">
            <tr>
              <th className="matrix-table__th matrix-table__th--checkbox" aria-label="Select" />
              <th className="matrix-table__th matrix-table__th--identity">Hook ID</th>
              {columns.map((column) => (
                <MatrixHarnessHeader
                  key={column.harness}
                  label={column.label}
                  logoKey={column.logoKey}
                  harness={column.harness}
                />
              ))}
              <th className="matrix-table__th matrix-table__th--action">Action</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const pending = pendingId === entry.id;
              const isSelected = selectedIds.has(entry.id);
              return (
                <tr
                  key={entry.id}
                  className="matrix-table__row"
                  data-checked={isSelected ? "true" : undefined}
                >
                  <td className="matrix-table__cell matrix-table__cell--checkbox">
                    <CardSelectCheckbox
                      checked={isSelected}
                      disabled={adoptingSelected || pending}
                      label={isSelected ? `Deselect ${entry.displayName}` : `Select ${entry.displayName}`}
                      onToggle={() => toggleSelected(entry.id)}
                    />
                  </td>
                  <td className="matrix-table__cell matrix-table__cell--identity">
                    <div className="matrix-table__name-row">
                      <OverflowTooltipText as="span" className="matrix-table__name-text">
                        {entry.displayName}
                      </OverflowTooltipText>
                      {entry.spec && <HooksStatusChip event={entry.spec.event} />}
                    </div>
                    <OverflowTooltipText as="p" className="matrix-table__description">
                      <code>{entry.spec?.command ?? "—"}</code>
                    </OverflowTooltipText>
                  </td>
                  {columns.map((column) => {
                    const discovered = entry.sightings.some(
                      (b) => b.harness === column.harness && b.state === "unmanaged",
                    );
                    return (
                      <td key={column.harness} className="matrix-table__cell matrix-table__cell--harness">
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
                  <td className="matrix-table__cell matrix-table__cell--action">
                    <button
                      type="button"
                      className="action-pill action-pill--accent"
                      disabled={pending}
                      onClick={() => void handlePromote(entry.id)}
                    >
                      {pending ? (
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
      )}

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
                <LoadingSpinner size="sm" label="Adopting selected hooks..." />
              ) : (
                <Plus size={15} />
              )}
              Adopt selected
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
