import { AlertTriangle } from "lucide-react";

import { CardSelectCheckbox } from "../../../components/cards/CardSelectCheckbox";
import {
  MatrixHarnessCellTarget,
  MatrixHarnessHeader,
  MatrixHarnessIcon,
  MatrixTable,
} from "../../../components/matrix";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import type { HookInventoryColumnDto, HookInventoryEntryDto } from "../api/management-types";
import { useHooksCopy, type HooksCopy } from "../i18n";
import {
  matrixCellFor,
  matrixColumns,
  matrixCoverage,
  type HooksMatrixCellModel,
} from "../model/selectors";
import { HooksHarnessLogoStack } from "./HooksHarnessLogoStack";

interface HooksMatrixViewProps {
  entries: HookInventoryEntryDto[];
  columns: HookInventoryColumnDto[];
  pendingHookKeys: ReadonlySet<string>;
  pendingPerHarnessKeys: ReadonlySet<string>;
  checkedIds: ReadonlySet<string>;
  onOpenDetail: (id: string) => void;
  onToggleChecked: (id: string) => void;
  onEnableHarness: (id: string, harness: string) => void;
  onDisableHarness: (id: string, harness: string) => void;
}

export function HooksMatrixView({
  entries,
  columns,
  pendingHookKeys,
  pendingPerHarnessKeys,
  checkedIds,
  onOpenDetail,
  onToggleChecked,
  onEnableHarness,
  onDisableHarness,
}: HooksMatrixViewProps) {
  const copy = useHooksCopy();
  const displayColumns = matrixColumns({ columns });

  return (
    <MatrixTable
      ariaLabel="Hooks Matrix"
      harnessColumnCount={displayColumns.length}
      harnessColumnWidth="52px"
      compactColumnWidth="140px"
      coverageColumnWidth="72px"
    >
      <thead className="matrix-table__head">
        <tr>
          <th className="matrix-table__th matrix-table__th--checkbox" aria-label="Select Column" />
          <th className="matrix-table__th matrix-table__th--identity">Hook ID</th>
          {displayColumns.map((column) => (
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
          <th className="matrix-table__th matrix-table__th--end">Enabled</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <HooksMatrixRow
            key={entry.id}
            entry={entry}
            columns={displayColumns}
            pendingHook={pendingHookKeys.has(entry.id)}
            pendingPerHarnessKeys={pendingPerHarnessKeys}
            checked={checkedIds.has(entry.id)}
            onOpenDetail={onOpenDetail}
            onToggleChecked={onToggleChecked}
            onEnableHarness={onEnableHarness}
            onDisableHarness={onDisableHarness}
            copy={copy}
          />
        ))}
      </tbody>
    </MatrixTable>
  );
}

function HooksMatrixRow({
  entry,
  columns,
  pendingHook,
  pendingPerHarnessKeys,
  checked,
  onOpenDetail,
  onToggleChecked,
  onEnableHarness,
  onDisableHarness,
  copy,
}: {
  entry: HookInventoryEntryDto;
  columns: HookInventoryColumnDto[];
  pendingHook: boolean;
  pendingPerHarnessKeys: ReadonlySet<string>;
  checked: boolean;
  onOpenDetail: (id: string) => void;
  onToggleChecked: (id: string) => void;
  onEnableHarness: (id: string, harness: string) => void;
  onDisableHarness: (id: string, harness: string) => void;
  copy: HooksCopy;
}) {
  const coverage = matrixCoverage(entry, columns);

  return (
    <tr className="matrix-table__row" data-checked={checked ? "true" : undefined}>
      <td className="matrix-table__cell matrix-table__cell--checkbox">
        <CardSelectCheckbox
          checked={checked}
          label={checked ? copy.detail.deselect(entry.displayName) : copy.detail.select(entry.displayName)}
          onToggle={() => onToggleChecked(entry.id)}
          disabled={pendingHook}
        />
      </td>
      <td className="matrix-table__cell matrix-table__cell--identity">
        <button
          type="button"
          className="mcp-matrix__server-button"
          aria-label={copy.detail.openDetail(entry.displayName)}
          onClick={() => onOpenDetail(entry.id)}
        >
          <span className="matrix-table__name-row">
            <span className="matrix-table__name-text">{entry.displayName}</span>
          </span>
          <span className="matrix-table__description">
            <code>{entry.spec?.command ?? "—"}</code> · {entry.spec?.event ?? "—"}
          </span>
        </button>
      </td>
      {columns.map((column) => {
        const cell = matrixCellFor(entry, column, copy);
        return (
          <td key={column.harness} className="matrix-table__cell matrix-table__cell--harness">
            <HooksMatrixHarnessCell
              entry={entry}
              column={column}
              cell={cell}
              pending={pendingHook || pendingPerHarnessKeys.has(cell.pendingKey)}
              onOpenDetail={onOpenDetail}
              onEnableHarness={onEnableHarness}
              onDisableHarness={onDisableHarness}
            />
          </td>
        );
      })}
      <td className="matrix-table__cell matrix-table__cell--compact">
        <HooksHarnessLogoStack bindings={entry.sightings} columns={columns} />
      </td>
      <td className="matrix-table__cell matrix-table__cell--coverage">
        <span
          className="matrix-table__coverage"
          aria-label={`Coverage: ${coverage.enabled} / ${coverage.writable}`}
        >
          <span className="matrix-table__coverage-count">{coverage.enabled}</span>
          <span className="matrix-table__coverage-total" aria-hidden="true">
            {" / "}
            {coverage.writable}
          </span>
        </span>
      </td>
    </tr>
  );
}

function HooksMatrixHarnessCell({
  entry,
  column,
  cell,
  pending,
  onOpenDetail,
  onEnableHarness,
  onDisableHarness,
}: {
  entry: HookInventoryEntryDto;
  column: HookInventoryColumnDto;
  cell: HooksMatrixCellModel;
  pending: boolean;
  onOpenDetail: (id: string) => void;
  onEnableHarness: (id: string, harness: string) => void;
  onDisableHarness: (id: string, harness: string) => void;
}) {
  const content = cellContent(column, cell);
  const disabled = pending || cell.action === null;

  const control = cell.action === null ? (
    <MatrixHarnessCellTarget
      state={cell.state}
      ariaLabel={cell.ariaLabel}
      disabled
      title={cell.tooltip}
    >
      {content}
    </MatrixHarnessCellTarget>
  ) : (
    <MatrixHarnessCellTarget
      state={cell.state}
      pending={pending}
      disabled={disabled}
      ariaLabel={cell.ariaLabel}
      title={cell.tooltip}
      onClick={() => {
        if (cell.action === "enable") {
          onEnableHarness(entry.id, column.harness);
        } else if (cell.action === "disable") {
          onDisableHarness(entry.id, column.harness);
        } else {
          onOpenDetail(entry.id);
        }
      }}
    >
      {content}
    </MatrixHarnessCellTarget>
  );

  return <UiTooltip content={cell.tooltip}>{control}</UiTooltip>;
}

function cellContent(column: HookInventoryColumnDto, cell: HooksMatrixCellModel) {
  if (cell.state === "unavailable") {
    return <AlertTriangle size={14} aria-hidden="true" />;
  }
  return (
    <MatrixHarnessIcon
      label={column.label}
      logoKey={column.logoKey}
      harness={column.harness}
    />
  );
}
