import { useMemo, useState } from "react";
import { Columns3, FolderPlus, LayoutGrid, Rows3, Shield } from "lucide-react";
import { Link } from "react-router-dom";

import { SkillActionConfirmDialog } from "../components/dialogs/SkillActionConfirmDialog";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { useToast } from "../../../components/Toast";
import { SelectionMenu } from "../../../components/ui/SelectionMenu";
import { ViewModeToggle, type ViewModeOption } from "../../../components/ViewModeToggle";
import { useCommonCopy } from "../../../i18n";
import { BoardView } from "../components/board/BoardView";
import { SkillsInUseList } from "../components/cards/SkillsInUseList";
import { MatrixView } from "../components/matrix/MatrixView";
import { SkillsEmptyState } from "../components/pane/SkillsEmptyState";
import { ScanView } from "../components/scan/ScanView";
import { useSkillsCopy } from "../i18n";
import { useSkillScan } from "../model/use-skill-scan";
import { useSkillsInUseSession } from "../model/session";
import {
  filterSkillsInUseRows,
  hasActiveSkillsInUseFilters,
} from "../model/selectors";
import { useInUseViewMode, type InUseViewMode } from "../model/useInUseViewMode";
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
    pendingStructuralActions,
    selectedSkillRef,
    multiSelectedRefs,
    onOpenSkill,
    onToggleCell,
    onToggleMultiSelect,
    onClearMultiSelect,
    onSetSkillAllHarnesses,
    onSetManySkillsAllHarnesses,
    onRemoveSkill,
    onDeleteSkill,
    isInitialLoading,
  } = useSkillsWorkspace();
  const { filters, updateFilters, resetFilters } = useSkillsInUseSession();
  const { toast } = useToast();
  const copy = useSkillsCopy();
  const common = useCommonCopy();
  const [pill, setPill] = useState<InUsePillValue>("all");
  const [viewMode, setViewMode] = useInUseViewMode();
  const [showScanConfig, setShowScanConfig] = useState(false);
  const scan = useSkillScan();
  const [pendingConfirm, setPendingConfirm] = useState<{
    action: "unmanage" | "delete";
    skillRef: string;
    skillName: string;
    harnessLabels: string[];
  } | null>(null);

  const baseRows = useMemo(() => filterSkillsInUseRows(data, filters), [data, filters]);

  const harnessCount = data?.harnessColumns.length ?? 0;
  // The pill filter only applies in Grid view. Board view already answers the
  // "coverage" question visually via its columns, so re-applying the pill would
  // collapse the board to a single column and invite confusion. We preserve the
  // pill state so a user flipping back to Grid keeps their prior filter.
  const rows = useMemo(
    () => (viewMode === "grid" ? applyPillFilter(baseRows, pill, harnessCount) : baseRows),
    [baseRows, pill, harnessCount, viewMode],
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
  const viewModeOptions: readonly ViewModeOption<InUseViewMode>[] = useMemo(
    () => [
      { value: "grid", label: copy.inUse.viewModes.grid, icon: LayoutGrid },
      { value: "board", label: copy.inUse.viewModes.board, icon: Columns3 },
      { value: "matrix", label: copy.inUse.viewModes.matrix, icon: Rows3 },
      { value: "scan", label: copy.inUse.viewModes.scan, icon: Shield },
    ],
    [copy],
  );

  const hasActiveFilters =
    hasActiveSkillsInUseFilters(filters) || (viewMode === "grid" && pill !== "all");
  const hasInUseInventory = (data?.summary.managed ?? 0) > 0;
  const isReady = status === "ready" && Boolean(data);
  const pendingConfirmAction =
    pendingConfirm === null
      ? null
      : pendingStructuralActions.get(pendingConfirm.skillRef) ?? null;

  function enabledHarnessLabels(row: SkillListRow): string[] {
    return row.cells
      .filter((cell) => cell.state === "enabled")
      .map((cell) => cell.label);
  }

  function requestSkillConfirm(action: "unmanage" | "delete", row: SkillListRow): void {
    setPendingConfirm({
      action,
      skillRef: row.skillRef,
      skillName: row.name,
      harnessLabels: enabledHarnessLabels(row),
    });
  }

  async function handleConfirmAction(): Promise<void> {
    if (!pendingConfirm) {
      return;
    }
    try {
      if (pendingConfirm.action === "unmanage") {
        await onRemoveSkill(pendingConfirm.skillRef);
      } else {
        await onDeleteSkill(pendingConfirm.skillRef);
      }
      setPendingConfirm(null);
    } catch {
      // The workspace controller already routes list-surface failures into the
      // shared action error banner; keep the dialog open so the user can retry.
    }
  }

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title={copy.inUse.title}
          actions={
            <>
              <ViewModeToggle
                mode={viewMode}
                options={viewModeOptions}
                ariaLabel={copy.inUse.viewModeAria}
                onChange={setViewMode}
              />
              <button
                type="button"
                className="action-pill action-pill--md"
                onClick={() => toast(copy.inUse.importFolderComingSoon)}
              >
                <FolderPlus size={14} />
                {copy.inUse.importFolder}
              </button>
            </>
          }
        />

        <FilterBar
          searchValue={filters.search}
          onSearchChange={(search) => updateFilters({ search })}
          searchPlaceholder={copy.inUse.searchPlaceholder}
          searchLabel={copy.inUse.searchLabel}
          trailing={
            viewMode === "grid" ? (
              <SelectionMenu
                value={pill}
                options={pillOptions}
                active={pill !== "all"}
                ariaLabel={copy.inUse.filterAria(pillLabel(copy, pill))}
                onChange={setPill}
              />
            ) : undefined
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
        <>
          {rows.length > 0 ? (
            viewMode === "scan" ? (
              <ScanView
                rows={rows}
                scanStateMap={scan.scanState}
                getScanState={scan.getScanState}
                llmConfig={scan.llmConfig}
                configs={scan.configs}
                activeConfigId={scan.activeConfigId}
                showConfig={showScanConfig}
                onOpenSkill={onOpenSkill}
                onScanSkill={(skillRef) => void scan.scanSkill(skillRef)}
                onOpenConfig={() => setShowScanConfig(true)}
                onCloseConfig={() => setShowScanConfig(false)}
                onSelectConfig={scan.selectConfig}
                onAddConfig={scan.addConfig}
                onEditConfig={scan.editConfig}
                onRevealApiKey={scan.revealConfigApiKey}
                onValidateConfig={scan.validateConfig}
              />
            ) : viewMode === "board" ? (
              <BoardView
                rows={rows}
                checkedRefs={multiSelectedRefs}
                pendingToggleKeys={pendingToggleKeys}
                onOpenSkill={onOpenSkill}
                onToggleChecked={onToggleMultiSelect}
                onClearMultiSelect={onClearMultiSelect}
                onSetSkillAllHarnesses={onSetSkillAllHarnesses}
                onSetManySkillsAllHarnesses={onSetManySkillsAllHarnesses}
              />
            ) : viewMode === "matrix" ? (
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
            ) : (
              <SkillsInUseList
                rows={rows}
                pendingToggleKeys={pendingToggleKeys}
                pendingStructuralActions={pendingStructuralActions}
                selectedSkillRef={selectedSkillRef}
                checkedRefs={multiSelectedRefs}
                onOpenSkill={onOpenSkill}
                onToggleChecked={onToggleMultiSelect}
                onToggleHarness={onToggleCell}
                onSetAllHarnesses={onSetSkillAllHarnesses}
                onRequestRemove={(row) => requestSkillConfirm("unmanage", row)}
                onRequestDelete={(row) => requestSkillConfirm("delete", row)}
              />
            )
          ) : hasInUseInventory || hasActiveFilters ? (
            <SkillsEmptyState copy={copy.filters} onResetFilters={() => {
              resetFilters();
              setPill("all");
            }} />
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
          )}

        </>
      ) : null}

      {pendingConfirm ? (
        <SkillActionConfirmDialog
          open
          action={pendingConfirm.action}
          skillName={pendingConfirm.skillName}
          harnessLabels={pendingConfirm.harnessLabels}
          isPending={pendingConfirmAction === pendingConfirm.action}
          onOpenChange={(open) => {
            if (!open) {
              setPendingConfirm(null);
            }
          }}
          onConfirm={handleConfirmAction}
        />
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
