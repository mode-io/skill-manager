import { useEffect, useMemo, useState } from "react";

import { Shield, X } from "lucide-react";

import { MatrixSortableHeader } from "../../../../components/matrix";
import type { ScanConfigItem } from "../../../../api/scan";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { ScanRow } from "./ScanRow";
import { ScanResultModal } from "./ScanResultModal";
import { ScanConfigDetailModal } from "./ScanConfigDetailModal";
import { sortRows, sortKeysEqual, type SortKey, type SortState } from "../../model/sortRows";
import type { SkillScanState, ScanStateMap, LLMScanConfig, LLMScanConfigInput } from "../../model/use-skill-scan";
import type { SkillListRow } from "../../model/types";

interface ScanViewProps {
  rows: SkillListRow[];
  scanStateMap: ScanStateMap;
  getScanState: (skillRef: string) => SkillScanState;
  llmConfig: LLMScanConfig | null;
  configs: ScanConfigItem[];
  activeConfigId: number | null;
  showConfig: boolean;
  onOpenSkill: (skillRef: string) => void;
  onScanSkill: (skillRef: string) => void;
  onOpenConfig: () => void;
  onCloseConfig: () => void;
  onSelectConfig: (id: number) => Promise<void>;
  onAddConfig: (config: LLMScanConfigInput) => Promise<unknown>;
  onEditConfig: (id: number, config: LLMScanConfigInput) => Promise<void>;
  onRevealApiKey: (id: number) => Promise<string>;
  onValidateConfig: (config: LLMScanConfigInput & { existingConfigId?: number }) => Promise<{
    ok: boolean;
    message: string;
    provider: string | null;
    model: string | null;
    durationMs: number | null;
    errorCode: string | null;
  }>;
}

const INITIAL_SORT: SortState = { key: "name", direction: "asc" };

export function ScanView({
  rows,
  scanStateMap,
  getScanState,
  llmConfig,
  configs,
  activeConfigId,
  showConfig,
  onOpenSkill,
  onScanSkill,
  onOpenConfig,
  onCloseConfig,
  onSelectConfig,
  onAddConfig,
  onEditConfig,
  onRevealApiKey,
  onValidateConfig,
}: ScanViewProps) {
  const [sort, setSort] = useState<SortState>(INITIAL_SORT);
  const [viewingSkillRef, setViewingSkillRef] = useState<string | null>(null);
  const [checkedRefs, setCheckedRefs] = useState<Set<string>>(() => new Set());

  const sortedRows = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const visibleRefs = useMemo(() => new Set(rows.map((row) => row.skillRef)), [rows]);
  const activeConfig = useMemo(
    () => configs.find((config) => config.id === activeConfigId) ?? configs.find((config) => config.isActive) ?? null,
    [activeConfigId, configs],
  );

  const requestSort = (key: SortKey) => {
    setSort((current) => {
      if (sortKeysEqual(current.key, key)) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const viewingState = viewingSkillRef ? scanStateMap[viewingSkillRef] : null;
  const viewingResult = viewingState?.result ?? null;
  const hasConfig = llmConfig !== null;
  const anyScanning = sortedRows.some((row) => getScanState(row.skillRef).status === "scanning");
  const checkedRows = sortedRows.filter((row) => checkedRefs.has(row.skillRef));
  const canScanChecked = hasConfig && checkedRows.length > 0 && !anyScanning;

  useEffect(() => {
    setCheckedRefs((current) => {
      if (current.size === 0) return current;
      let changed = false;
      const next = new Set<string>();
      for (const ref of current) {
        if (visibleRefs.has(ref)) {
          next.add(ref);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [visibleRefs]);

  async function addAndActivateConfig(config: LLMScanConfigInput) {
    const item = await onAddConfig(config) as { id?: number } | undefined;
    if (item?.id) {
      await onSelectConfig(item.id);
    }
    return item;
  }

  async function editActiveConfig(id: number, config: LLMScanConfigInput) {
    await onEditConfig(id, config);
    await onSelectConfig(id);
  }

  function toggleChecked(skillRef: string) {
    setCheckedRefs((current) => {
      const next = new Set(current);
      if (next.has(skillRef)) {
        next.delete(skillRef);
      } else {
        next.add(skillRef);
      }
      return next;
    });
  }

  function clearChecked() {
    setCheckedRefs((current) => (current.size === 0 ? current : new Set()));
  }

  function scanCheckedSkills() {
    if (!canScanChecked) return;
    void Promise.all(checkedRows.map((row) => Promise.resolve(onScanSkill(row.skillRef)))).then(() => {
      clearChecked();
    });
  }

  return (
    <>
      <div className="matrix-table-wrapper scan-table-wrapper">
        <table className="matrix-table scan-table" aria-label="Skills scan table">
          <colgroup>
            <col className="matrix-table__col-checkbox" />
            <col className="scan-table__col-identity" />
            <col className="scan-table__col-action" />
          </colgroup>
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
              <th className="matrix-table__th matrix-table__th--action" aria-label="Actions">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <ScanRow
                key={row.skillRef}
                row={row}
                hasConfig={hasConfig}
                checked={checkedRefs.has(row.skillRef)}
                scanState={getScanState(row.skillRef)}
                onOpenSkill={onOpenSkill}
                onToggleChecked={toggleChecked}
                onScanSkill={onScanSkill}
                onConfigure={onOpenConfig}
                onViewResult={setViewingSkillRef}
              />
            ))}
          </tbody>
        </table>
      </div>

      <ScanResultModal
        open={viewingSkillRef !== null}
        result={viewingResult}
        completedAt={viewingState?.completedAt ?? null}
        llmConfig={llmConfig}
        onClose={() => setViewingSkillRef(null)}
      />

      <ScanConfigDetailModal
        open={showConfig}
        mode={activeConfig ? "edit" : "create"}
        config={activeConfig}
        onClose={onCloseConfig}
        onAddConfig={addAndActivateConfig}
        onEditConfig={editActiveConfig}
        onRevealApiKey={onRevealApiKey}
        onValidateConfig={onValidateConfig}
      />

      {checkedRefs.size > 0 ? (
        <div className="bulk-dock" aria-hidden={false}>
          <div className="bulk-dock__fade" />
          <div className="bulk-bar" data-state="open" role="toolbar" aria-label="Scan bulk actions">
            <div className="bulk-bar__group">
              <span className="bulk-bar__count">
                <strong>{checkedRefs.size}</strong> selected
              </span>
              <button
                type="button"
                className="bulk-bar__clear"
                onClick={clearChecked}
                disabled={anyScanning}
                aria-label="Clear selection"
              >
                <X size={14} />
              </button>
            </div>

            <span className="bulk-bar__divider" aria-hidden="true" />

            <button
              type="button"
              className="bulk-bar__action"
              onClick={scanCheckedSkills}
              disabled={!canScanChecked}
            >
              {anyScanning ? <LoadingSpinner size="sm" label="Scanning" /> : <Shield size={15} />}
              {checkedRows.length === rows.length ? "Scan all" : "Scan selected"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
