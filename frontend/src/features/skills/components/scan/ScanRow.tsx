import { CardSelectCheckbox } from "../../../../components/cards/CardSelectCheckbox";
import { OverflowTooltipText } from "../../../../components/ui/OverflowTooltipText";
import type { SkillListRow } from "../../model/types";
import type { SkillScanState } from "../../model/use-skill-scan";

interface ScanRowProps {
  row: SkillListRow;
  hasConfig: boolean;
  checked: boolean;
  scanState: SkillScanState;
  onOpenSkill: (skillRef: string) => void;
  onToggleChecked: (skillRef: string) => void;
  onScanSkill: (skillRef: string) => void;
  onConfigure: () => void;
  onViewResult: (skillRef: string) => void;
}

export function ScanRow({
  row,
  hasConfig,
  checked,
  scanState,
  onOpenSkill,
  onToggleChecked,
  onScanSkill,
  onConfigure,
  onViewResult,
}: ScanRowProps) {
  const isScanning = scanState.status === "scanning";
  const isDone = scanState.status === "done";
  const isError = scanState.status === "error";

  return (
    <tr className="matrix-table__row" data-checked={checked ? "true" : undefined}>
      <td className="matrix-table__cell matrix-table__cell--checkbox">
        <CardSelectCheckbox
          checked={checked}
          label={checked ? `Deselect ${row.name}` : `Select ${row.name}`}
          disabled={isScanning}
          onToggle={() => onToggleChecked(row.skillRef)}
        />
      </td>

      <td
        className="matrix-table__cell matrix-table__cell--identity"
        onClick={() => onOpenSkill(row.skillRef)}
      >
        <div className="matrix-table__name-row">
          <OverflowTooltipText as="span" className="matrix-table__name-text">
            {row.name}
          </OverflowTooltipText>
        </div>
        {row.description ? (
          <OverflowTooltipText as="p" className="matrix-table__description">
            {row.description}
          </OverflowTooltipText>
        ) : null}
      </td>

      <td className="matrix-table__cell matrix-table__cell--action">
        {!hasConfig ? (
          <button
            type="button"
            className="action-pill scan-table__action"
            onClick={(event) => {
              event.stopPropagation();
              onConfigure();
            }}
            aria-label="Configure LLM scan"
          >
            Configure
          </button>
        ) : isScanning ? (
          <button
            type="button"
            className="action-pill scan-table__action"
            disabled
            aria-label={`Scanning ${row.name}`}
          >
            Scanning
          </button>
        ) : isDone && scanState.result ? (
          <button
            type="button"
            className="action-pill scan-table__action"
            onClick={(event) => {
              event.stopPropagation();
              onViewResult(row.skillRef);
            }}
            aria-label={`View scan results for ${row.name}`}
          >
            View Result
          </button>
        ) : isError ? (
          <button
            type="button"
            className="action-pill scan-table__action"
            onClick={(event) => {
              event.stopPropagation();
              onScanSkill(row.skillRef);
            }}
            aria-label={`Retry scan for ${row.name}`}
          >
            Retry
          </button>
        ) : (
          <button
            type="button"
            className="action-pill scan-table__action"
            onClick={(event) => {
              event.stopPropagation();
              onScanSkill(row.skillRef);
            }}
            aria-label={`Scan ${row.name}`}
          >
            Scan
          </button>
        )}
      </td>
    </tr>
  );
}
