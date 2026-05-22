import { CardSelectCheckbox } from "../../../../components/cards/CardSelectCheckbox";
import { OverflowTooltipText } from "../../../../components/ui/OverflowTooltipText";
import type { SkillListRow } from "../../model/types";
import type { SkillScanState } from "../../model/use-skill-scan";
import type { SkillsCopy } from "../../i18n";

interface ScanRowProps {
  row: SkillListRow;
  hasConfig: boolean;
  checked: boolean;
  scanState: SkillScanState;
  copy: SkillsCopy["scan"]["view"];
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
  copy,
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
          label={checked ? copy.deselectSkill(row.name) : copy.selectSkill(row.name)}
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
            aria-label={copy.configureAria}
          >
            {copy.configure}
          </button>
        ) : isScanning ? (
          <button
            type="button"
            className="action-pill scan-table__action"
            disabled
            aria-label={copy.scanningSkill(row.name)}
          >
            {copy.scanning}
          </button>
        ) : isDone && scanState.result ? (
          <button
            type="button"
            className="action-pill scan-table__action"
            onClick={(event) => {
              event.stopPropagation();
              onViewResult(row.skillRef);
            }}
            aria-label={copy.viewResultFor(row.name)}
          >
            {copy.viewResult}
          </button>
        ) : isError ? (
          <button
            type="button"
            className="action-pill scan-table__action"
            onClick={(event) => {
              event.stopPropagation();
              onScanSkill(row.skillRef);
            }}
            aria-label={copy.retryScanFor(row.name)}
          >
            {copy.retry}
          </button>
        ) : (
          <button
            type="button"
            className="action-pill scan-table__action"
            onClick={(event) => {
              event.stopPropagation();
              onScanSkill(row.skillRef);
            }}
            aria-label={copy.scanSkill(row.name)}
          >
            {copy.scan}
          </button>
        )}
      </td>
    </tr>
  );
}
