import { AlertTriangle } from "lucide-react";

import { CardSelectCheckbox } from "../../../components/cards/CardSelectCheckbox";
import {
  MatrixHarnessCellTarget,
  MatrixHarnessHeader,
  MatrixHarnessIcon,
  MatrixTable,
} from "../../../components/matrix";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import type { McpInventoryColumnDto, McpInventoryEntryDto } from "../api/management-types";
import {
  matrixCellFor,
  matrixColumns,
  matrixCoverage,
  type McpMatrixCellModel,
} from "../model/selectors";
import { McpHarnessLogoStack } from "./McpHarnessLogoStack";

interface McpServerMatrixViewProps {
  entries: McpInventoryEntryDto[];
  columns: McpInventoryColumnDto[];
  pendingServerKeys: ReadonlySet<string>;
  pendingPerHarnessKeys: ReadonlySet<string>;
  checkedNames: ReadonlySet<string>;
  onOpenDetail: (name: string) => void;
  onToggleChecked: (name: string) => void;
  onEnableHarness: (name: string, harness: string) => void;
  onDisableHarness: (name: string, harness: string) => void;
}

export function McpServerMatrixView({
  entries,
  columns,
  pendingServerKeys,
  pendingPerHarnessKeys,
  checkedNames,
  onOpenDetail,
  onToggleChecked,
  onEnableHarness,
  onDisableHarness,
}: McpServerMatrixViewProps) {
  const displayColumns = matrixColumns({ columns });

  return (
    <MatrixTable
      ariaLabel="MCP server harness matrix"
      harnessColumnCount={displayColumns.length}
      harnessColumnWidth="52px"
      compactColumnWidth="140px"
      coverageColumnWidth="72px"
    >
      <thead className="matrix-table__head">
        <tr>
          <th className="matrix-table__th matrix-table__th--checkbox" aria-label="Select" />
          <th className="matrix-table__th matrix-table__th--identity">Server</th>
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
          <McpMatrixRow
            key={entry.name}
            entry={entry}
            columns={displayColumns}
            pendingServer={pendingServerKeys.has(entry.name)}
            pendingPerHarnessKeys={pendingPerHarnessKeys}
            checked={checkedNames.has(entry.name)}
            onOpenDetail={onOpenDetail}
            onToggleChecked={onToggleChecked}
            onEnableHarness={onEnableHarness}
            onDisableHarness={onDisableHarness}
          />
        ))}
      </tbody>
    </MatrixTable>
  );
}

function McpMatrixRow({
  entry,
  columns,
  pendingServer,
  pendingPerHarnessKeys,
  checked,
  onOpenDetail,
  onToggleChecked,
  onEnableHarness,
  onDisableHarness,
}: {
  entry: McpInventoryEntryDto;
  columns: McpInventoryColumnDto[];
  pendingServer: boolean;
  pendingPerHarnessKeys: ReadonlySet<string>;
  checked: boolean;
  onOpenDetail: (name: string) => void;
  onToggleChecked: (name: string) => void;
  onEnableHarness: (name: string, harness: string) => void;
  onDisableHarness: (name: string, harness: string) => void;
}) {
  const coverage = matrixCoverage(entry, columns);

  return (
    <tr className="matrix-table__row" data-checked={checked ? "true" : undefined}>
      <td className="matrix-table__cell matrix-table__cell--checkbox">
        <CardSelectCheckbox
          checked={checked}
          label={checked ? `Deselect ${entry.displayName}` : `Select ${entry.displayName}`}
          onToggle={() => onToggleChecked(entry.name)}
          disabled={pendingServer}
        />
      </td>
      <td className="matrix-table__cell matrix-table__cell--identity">
        <button
          type="button"
          className="mcp-matrix__server-button"
          aria-label={`Open detail for ${entry.displayName}`}
          onClick={() => onOpenDetail(entry.name)}
        >
          <span className="matrix-table__name-row">
            <span className="matrix-table__name-text">{entry.displayName}</span>
          </span>
          <span className="matrix-table__description">
            {entry.name} · {entry.spec?.transport ?? "—"}
          </span>
        </button>
      </td>
      {columns.map((column) => {
        const cell = matrixCellFor(entry, column);
        return (
          <td key={column.harness} className="matrix-table__cell matrix-table__cell--harness">
            <McpMatrixHarnessCell
              entry={entry}
              column={column}
              cell={cell}
              pending={pendingServer || pendingPerHarnessKeys.has(cell.pendingKey)}
              onOpenDetail={onOpenDetail}
              onEnableHarness={onEnableHarness}
              onDisableHarness={onDisableHarness}
            />
          </td>
        );
      })}
      <td className="matrix-table__cell matrix-table__cell--compact">
        <McpHarnessLogoStack bindings={entry.sightings} columns={columns} />
      </td>
      <td className="matrix-table__cell matrix-table__cell--coverage">
        <span
          className="matrix-table__coverage"
          aria-label={`Enabled on ${coverage.enabled} of ${coverage.writable} writable harnesses`}
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

function McpMatrixHarnessCell({
  entry,
  column,
  cell,
  pending,
  onOpenDetail,
  onEnableHarness,
  onDisableHarness,
}: {
  entry: McpInventoryEntryDto;
  column: McpInventoryColumnDto;
  cell: McpMatrixCellModel;
  pending: boolean;
  onOpenDetail: (name: string) => void;
  onEnableHarness: (name: string, harness: string) => void;
  onDisableHarness: (name: string, harness: string) => void;
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
          onEnableHarness(entry.name, column.harness);
        } else if (cell.action === "disable") {
          onDisableHarness(entry.name, column.harness);
        } else {
          onOpenDetail(entry.name);
        }
      }}
    >
      {content}
    </MatrixHarnessCellTarget>
  );

  return <UiTooltip content={cell.tooltip}>{control}</UiTooltip>;
}

function cellContent(column: McpInventoryColumnDto, cell: McpMatrixCellModel) {
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
