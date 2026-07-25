import "../agents.css";
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
import { agentsRoutes } from "../public";
import { filterAgentsNeedsReview } from "../model/selectors";
import { useAgentsController } from "../model/use-agents-controller";
import { AdoptConflictDialog } from "../components/AdoptConflictDialog";
import { useToast } from "../../../components/Toast";
import type { AgentAdoptConflict } from "../api/types";

export default function AgentsNeedsReviewPage() {
  const {
    inventory,
    isInitialLoading,
    queryErrorMessage,
    adoptMutation,
    adoptAllMutation,
  } = useAgentsController();

  const [search, setSearch] = useState("");
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const entries = useMemo(() => filterAgentsNeedsReview(inventory, search), [inventory, search]);
  const totalReview = useMemo(() => filterAgentsNeedsReview(inventory, "").length, [inventory]);
  const columns = inventory?.columns ?? [];

  const common = useCommonCopy();
  const { toast } = useToast();
  const [selectedRefs, setSelectedRefs] = useState<ReadonlySet<string>>(() => new Set());
  const [adoptingSelected, setAdoptingSelected] = useState(false);
  const [conflict, setConflict] = useState<AgentAdoptConflict | null>(null);
  const [conflictPending, setConflictPending] = useState(false);

  useEffect(() => {
    setSelectedRefs((current) => {
      let changed = false;
      const next = new Set<string>();
      const entryRefs = new Set(entries.map((e) => e.ref));
      for (const ref of current) {
        if (entryRefs.has(ref)) next.add(ref);
        else changed = true;
      }
      return changed ? next : current;
    });
  }, [entries]);

  const toggleSelected = (ref: string) => {
    setSelectedRefs((current) => {
      const next = new Set(current);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  const clearSelected = () => setSelectedRefs(new Set());

  const handleAdoptSelected = async () => {
    const refs = entries.filter((e) => selectedRefs.has(e.ref)).map((e) => e.ref);
    if (refs.length === 0) return;
    setAdoptingSelected(true);
    try {
      for (const ref of refs) {
        try {
          const res = await adoptMutation.mutateAsync({ ref });
          if (res && "conflict" in res) {
            toast(`Skipped ${ref}: conflict`);
          }
        } catch {
        }
      }
      setSelectedRefs(new Set());
    } finally {
      setAdoptingSelected(false);
    }
  };

  const handleAdoptAll = async () => {
    setAdoptingSelected(true);
    try {
      const res = await adoptAllMutation.mutateAsync();
      if (res.skipped.length > 0) {
        toast(`Skipped ${res.skipped.length} agents due to conflicts. Resolve them individually.`);
      } else {
        toast(`Adopted ${res.adopted.length} agents.`);
      }
      setSelectedRefs(new Set());
    } finally {
      setAdoptingSelected(false);
    }
  };

  const selectedCount = selectedRefs.size;
  const adoptableCount = entries.length;

  const handleAdopt = async (ref: string) => {
    setPendingRef(ref);
    setErrorMessage("");
    try {
      const res = await adoptMutation.mutateAsync({ ref });
      if (res && "conflict" in res) {
        setConflict(res);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not adopt agent");
    } finally {
      setPendingRef(null);
    }
  };

  const handleResolveConflict = async (onConflict: "keep_store" | "replace_store") => {
    if (!conflict) return;
    setConflictPending(true);
    try {
      await adoptMutation.mutateAsync({ ref: conflict.slug, onConflict });
      setConflict(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not resolve conflict");
      setConflict(null);
    } finally {
      setConflictPending(false);
    }
  };

  const loadError = queryErrorMessage;

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title="Agents to review"
          subtitle="Agents found in your harness configs that skill-manager does not yet track."
          actions={
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              disabled={adoptingSelected || adoptableCount === 0}
              onClick={() => void handleAdoptAll()}
            >
              <Plus size={16} className="agent-icon-margin" />
              Adopt all eligible
            </button>
          }
        />
        {totalReview > 0 ? (
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by name or description..."
            searchLabel="Search agents to review"
          />
        ) : null}
      </div>

      {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage("")} /> : null}

      {isInitialLoading ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label="Loading agents" />
        </div>
      ) : loadError ? (
        <div className="panel-state">{loadError}</div>
      ) : totalReview === 0 ? (
        <div className="empty-panel">
          <h3 className="empty-panel__title">No agents need review</h3>
          <p className="empty-panel__body">
            Your harness configs only reference agents that skill-manager already tracks.
          </p>
          <div className="empty-panel__actions">
            <Link to={agentsRoutes.inUse} className="action-pill action-pill--md action-pill--accent">
              View Agents in Use
            </Link>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-panel">
          <h3 className="empty-panel__title">No matches</h3>
          <p className="empty-panel__body">Adjust the search to see other agents.</p>
          <div className="empty-panel__actions">
            <button type="button" className="action-pill action-pill--md" onClick={() => setSearch("")}>
              Clear search
            </button>
          </div>
        </div>
      ) : (
        <MatrixTable
          ariaLabel="Agents to review"
          harnessColumnWidth="52px"
          compactColumnWidth="140px"
          coverageColumnWidth="96px"
          minWidth="800px"
        >
          <thead className="matrix-table__head">
            <tr>
              <th className="matrix-table__th matrix-table__th--checkbox" aria-label="Select" />
              <th className="matrix-table__th matrix-table__th--identity">Agent Name</th>
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
              const pending = pendingRef === entry.ref;
              const isSelected = selectedRefs.has(entry.ref);
              return (
                <tr
                  key={entry.ref}
                  className="matrix-table__row"
                  data-checked={isSelected ? "true" : undefined}
                >
                  <td className="matrix-table__cell matrix-table__cell--checkbox">
                    <CardSelectCheckbox
                      checked={isSelected}
                      disabled={adoptingSelected || pending}
                      label={isSelected ? `Deselect ${entry.name}` : `Select ${entry.name}`}
                      onToggle={() => toggleSelected(entry.ref)}
                    />
                  </td>
                  <td className="matrix-table__cell matrix-table__cell--identity">
                    <div className="matrix-table__name-row">
                      <OverflowTooltipText as="span" className="matrix-table__name-text">
                        {entry.name}
                      </OverflowTooltipText>
                    </div>
                    <OverflowTooltipText as="p" className="matrix-table__description">
                      {entry.description}
                    </OverflowTooltipText>
                  </td>
                  {columns.map((column) => {
                    const discovered = entry.bindings.some(
                      (b) => b.harness === column.harness && entry.harnessPath
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
                      disabled={pending || !entry.actions.canAdopt}
                      onClick={() => void handleAdopt(entry.ref)}
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
                <LoadingSpinner size="sm" label="Adopting selected agents..." />
              ) : (
                <Plus size={15} />
              )}
              Adopt selected
            </button>
          </div>
        </div>
      ) : null}

      <AdoptConflictDialog
        open={conflict !== null}
        slug={conflict?.slug ?? ""}
        storePath={conflict?.storePath ?? ""}
        harnessPath={conflict?.harnessPath ?? ""}
        isPending={conflictPending}
        onOpenChange={(open) => {
          if (!open) setConflict(null);
        }}
        onConfirm={handleResolveConflict}
      />
    </>
  );
}
