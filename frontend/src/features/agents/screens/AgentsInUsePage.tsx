import "../agents.css";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { useCommonCopy } from "../../../i18n";
import {
  filterAgentsInUse,
  pillCounts,
  type InUsePillValue,
} from "../model/selectors";
import { useAgentsController } from "../model/use-agents-controller";
import { SelectionMenu } from "../../../components/ui/SelectionMenu";
import { agentsRoutes } from "../public";
import {
  MatrixHarnessCellTarget,
  MatrixHarnessHeader,
  MatrixHarnessIcon,
  MatrixTable,
} from "../../../components/matrix";
import { OverflowTooltipText } from "../../../components/ui/OverflowTooltipText";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { EditAgentDialog } from "../components/EditAgentDialog";
import { CreateAgentDialog } from "../components/CreateAgentDialog";
import { AgentDetailModal } from "../components/detail/AgentDetailModal";

export default function AgentsInUsePage() {
  const {
    status,
    inventory,
    isInitialLoading,
    queryErrorMessage,
    actionErrorMessage,
    clearActionError,
    pendingAgentKeys,
    pendingPerHarnessKeys,
    handleToggleHarness,
  } = useAgentsController();

  const [search, setSearch] = useState("");
  const [pill, setPill] = useState<InUsePillValue>("all");
  const common = useCommonCopy();

  const entries = useMemo(
    () => filterAgentsInUse(inventory, { search, pill }),
    [inventory, search, pill]
  );
  const counts = useMemo(() => pillCounts(inventory), [inventory]);
  const totalInUse = inventory?.entries.filter((e) => e.kind === "managed").length ?? 0;
  const isReady = status === "success" && Boolean(inventory);
  const columns = inventory?.columns ?? [];

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailRef, setDetailRef] = useState<string | null>(null);
  const [editRef, setEditRef] = useState<string | null>(null);

  const pillOptions = useMemo(
    () =>
      ([
        { value: "all", label: "All agents", meta: counts.all },
        { value: "enabled", label: "In use", meta: counts.enabled },
        { value: "all-harnesses", label: "All harnesses", meta: counts["all-harnesses"] },
        { value: "off", label: "Off", meta: counts.off },
      ] as const),
    [counts]
  );

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title="Agents in Use"
          subtitle={totalInUse > 0 ? `Managing ${totalInUse} agent${totalInUse === 1 ? '' : 's'}` : undefined}
          actions={
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus size={16} className="agent-icon-margin" />
              Add Agent
            </button>
          }
        />
        {totalInUse > 0 ? (
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by name or description..."
            searchLabel="Search agents"
            trailing={
              <SelectionMenu
                value={pill}
                options={pillOptions}
                active={pill !== "all"}
                ariaLabel="Filter agents"
                onChange={setPill}
              />
            }
          />
        ) : null}
      </div>

      {actionErrorMessage ? (
        <ErrorBanner message={actionErrorMessage} onDismiss={clearActionError} />
      ) : null}

      {isInitialLoading ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label="Loading agents" />
        </div>
      ) : status === "error" ? (
        <div className="panel-state">{queryErrorMessage || "Unable to load agents"}</div>
      ) : isReady && inventory ? (
        entries.length > 0 ? (
          <MatrixTable
            ariaLabel="Agents Matrix"
            harnessColumnWidth="52px"
            compactColumnWidth="140px"
            coverageColumnWidth="96px"
            minWidth="800px"
          >
            <thead className="matrix-table__head">
              <tr>
                <th className="matrix-table__th matrix-table__th--identity">Agent Name</th>
                {columns.map((column) => (
                  <MatrixHarnessHeader
                    key={column.harness}
                    label={column.label}
                    logoKey={column.logoKey}
                    harness={column.harness}
                  />
                ))}
                <th className="matrix-table__th matrix-table__th--end">Active</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isPendingAgent = pendingAgentKeys.has(entry.ref);
                const enabledCount = entry.bindings.filter(b => b.state === "enabled").length;
                return (
                  <tr key={entry.ref} className="matrix-table__row">
                    <td
                      className="matrix-table__cell matrix-table__cell--identity agent-pointer"
                      onClick={() => setDetailRef(entry.ref)}
                    >
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
                      const binding = entry.bindings.find((b) => b.harness === column.harness);
                      const pendingKey = `${entry.ref}:${column.harness}`;
                      const isPendingCell = isPendingAgent || pendingPerHarnessKeys.has(pendingKey);

                      let state: "enabled" | "disabled" | "unavailable" = "disabled";
                      let tooltip = `Enable for ${column.label}`;
                      let action: "enable" | "disable" | null = "enable";

                      if (binding) {
                        if (binding.state === "enabled") {
                          state = "enabled";
                          tooltip = `Disable for ${column.label}`;
                          action = "disable";
                        } else if (binding.state === "unsupported") {
                          state = "unavailable";
                          tooltip = `Not supported by ${column.label}`;
                          action = null;
                        }
                      }

                      return (
                        <td key={column.harness} className="matrix-table__cell matrix-table__cell--harness">
                          <UiTooltip content={tooltip}>
                            <MatrixHarnessCellTarget
                              state={state}
                              pending={isPendingCell}
                              disabled={isPendingCell || action === null}
                              ariaLabel={tooltip}
                              onClick={() => {
                                if (action === "enable") {
                                  void handleToggleHarness(entry.ref, column.harness, false);
                                } else if (action === "disable") {
                                  void handleToggleHarness(entry.ref, column.harness, true);
                                }
                              }}
                            >
                              {state === "unavailable" ? (
                                <span className="agent-opacity-half">—</span>
                              ) : (
                                <MatrixHarnessIcon
                                  label={column.label}
                                  logoKey={column.logoKey}
                                  harness={column.harness}
                                />
                              )}
                            </MatrixHarnessCellTarget>
                          </UiTooltip>
                        </td>
                      );
                    })}
                    <td className="matrix-table__cell matrix-table__cell--coverage">
                      <span className="matrix-table__coverage" aria-label={`Coverage: ${enabledCount} / ${columns.length}`}>
                        <span className="matrix-table__coverage-count">{enabledCount}</span>
                        <span className="matrix-table__coverage-total" aria-hidden="true">
                          {" / "}
                          {columns.length}
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </MatrixTable>
        ) : totalInUse > 0 ? (
          <div className="empty-panel">
            <h3 className="empty-panel__title">{common.status.noMatches}</h3>
            <p className="empty-panel__body">Adjust filters to see agents.</p>
            <div className="empty-panel__actions">
              <button
                type="button"
                className="action-pill action-pill--md"
                onClick={() => {
                  setSearch("");
                  setPill("all");
                }}
              >
                {common.actions.clearFilters}
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-panel">
            <h3 className="empty-panel__title">No agents in use</h3>
            <p className="empty-panel__body">Create your first agent to get started.</p>
            <div className="empty-panel__actions">
              <Link to={agentsRoutes.needsReview} className="action-pill action-pill--md action-pill--accent">
                {common.actions.reviewItems}
              </Link>
              <button
                type="button"
                className="action-pill action-pill--md"
                onClick={() => setCreateDialogOpen(true)}
              >
                Add Agent
              </button>
            </div>
          </div>
        )
      ) : null}

      <CreateAgentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      <AgentDetailModal
        open={Boolean(detailRef)}
        agentRef={detailRef}
        pendingPerHarnessKeys={pendingPerHarnessKeys}
        onToggleHarness={handleToggleHarness}
        onClose={() => setDetailRef(null)}
        onEdit={(ref) => {
          setDetailRef(null);
          setEditRef(ref);
        }}
      />
      {editRef && (
        <EditAgentDialog
          open={true}
          agentRef={editRef}
          onOpenChange={(open) => !open && setEditRef(null)}
        />
      )}
    </>
  );
}
