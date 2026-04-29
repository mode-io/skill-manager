import { useMemo, useState } from "react";

import { CardSelectCheckbox } from "../../../components/cards/CardSelectCheckbox";
import {
  MatrixHarnessCellTarget,
  MatrixHarnessIcon,
  MatrixSortableHeader,
  MatrixTable,
  type MatrixSortDirection,
} from "../../../components/matrix";
import { getHarnessPresentation } from "../../../components/harness/harnessPresentation";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { OverflowTooltipText } from "../../../components/ui/OverflowTooltipText";
import type { SlashCommandDto, SlashTargetDto } from "../api/types";

type SortKey = "name" | "coverage" | { target: string };

interface SortState {
  key: SortKey;
  direction: MatrixSortDirection;
}

interface SlashCommandMatrixProps {
  commands: SlashCommandDto[];
  targets: SlashTargetDto[];
  pendingName: string | null;
  pendingTarget: string | null;
  checkedNames: ReadonlySet<string>;
  onEdit: (command: SlashCommandDto) => void;
  onToggleChecked: (name: string) => void;
  onToggleTarget: (command: SlashCommandDto, target: SlashTargetDto) => void;
}

const INITIAL_SORT: SortState = { key: "name", direction: "asc" };

export function SlashCommandMatrix({
  commands,
  targets,
  pendingName,
  pendingTarget,
  checkedNames,
  onEdit,
  onToggleChecked,
  onToggleTarget,
}: SlashCommandMatrixProps) {
  const [sort, setSort] = useState<SortState>(INITIAL_SORT);
  const sortedCommands = useMemo(
    () => sortCommands(commands, sort),
    [commands, sort],
  );

  function requestSort(key: SortKey): void {
    setSort((current) => {
      if (sortKeysEqual(current.key, key)) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }

  return (
    <MatrixTable
      ariaLabel="Slash commands target matrix"
      harnessColumnCount={targets.length}
      harnessColumnWidth="52px"
      compactColumnWidth="140px"
      coverageColumnWidth="72px"
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
          {targets.map((target) => {
            const key: SortKey = { target: target.id };
            return (
              <MatrixSortableHeader
                key={target.id}
                label={target.label}
                align="harness"
                active={sortKeysEqual(sort.key, key)}
                direction={sort.direction}
                logoOnly
                leading={
                  <MatrixHarnessIcon
                    label={target.label}
                    logoKey={target.id === "claude" ? "claude" : target.id}
                    harness={target.id}
                  />
                }
                srLabel={`Sort by ${target.label}`}
                onClick={() => requestSort(key)}
              />
            );
          })}
          <th className="matrix-table__th matrix-table__th--compact" aria-label="Targets">
            Targets
          </th>
          <MatrixSortableHeader
            label="Active"
            align="end"
            active={sortKeysEqual(sort.key, "coverage")}
            direction={sort.direction}
            onClick={() => requestSort("coverage")}
          />
        </tr>
      </thead>
      <tbody>
        {sortedCommands.map((command) => (
          <SlashCommandMatrixRow
            key={command.name}
            command={command}
            targets={targets}
            pending={pendingName === command.name}
            pendingTarget={pendingName === command.name ? pendingTarget : null}
            checked={checkedNames.has(command.name)}
            onEdit={onEdit}
            onToggleChecked={onToggleChecked}
            onToggleTarget={onToggleTarget}
          />
        ))}
      </tbody>
    </MatrixTable>
  );
}

function SlashCommandMatrixRow({
  command,
  targets,
  pending,
  pendingTarget,
  checked,
  onEdit,
  onToggleChecked,
  onToggleTarget,
}: {
  command: SlashCommandDto;
  targets: SlashTargetDto[];
  pending: boolean;
  pendingTarget: string | null;
  checked: boolean;
  onEdit: (command: SlashCommandDto) => void;
  onToggleChecked: (name: string) => void;
  onToggleTarget: (command: SlashCommandDto, target: SlashTargetDto) => void;
}) {
  const enabled = syncedTargetIds(command);
  const enabledCount = enabled.size;
  const totalCount = targets.length;

  return (
    <tr className="matrix-table__row" data-checked={checked ? "true" : undefined}>
      <td className="matrix-table__cell matrix-table__cell--checkbox">
        <CardSelectCheckbox
          checked={checked}
          label={checked ? `Deselect ${command.name}` : `Select ${command.name}`}
          onToggle={() => onToggleChecked(command.name)}
        />
      </td>

      <td
        className="matrix-table__cell matrix-table__cell--identity"
        onClick={() => onEdit(command)}
      >
        <div className="matrix-table__name-row slash-matrix-name-row">
          <OverflowTooltipText as="span" className="matrix-table__name-text">
            /{command.name}
          </OverflowTooltipText>
          <OverflowTooltipText as="span" className="slash-row__codex">
            /prompts:{command.name}
          </OverflowTooltipText>
        </div>
        {command.description ? (
          <OverflowTooltipText as="p" className="matrix-table__description">
            {command.description}
          </OverflowTooltipText>
        ) : null}
      </td>

      {targets.map((target) => {
        const isEnabled = enabled.has(target.id);
        return (
          <td key={target.id} className="matrix-table__cell matrix-table__cell--harness">
            <MatrixHarnessCellTarget
              ariaLabel={`${isEnabled ? "Disable" : "Enable"} ${target.label} for ${command.name}`}
              state={isEnabled ? "enabled" : "disabled"}
              pending={pending && pendingTarget === target.id}
              disabled={pending}
              ariaPressed={isEnabled}
              onClick={() => onToggleTarget(command, target)}
            >
              <MatrixHarnessIcon
                label={target.label}
                logoKey={target.id === "claude" ? "claude" : target.id}
                harness={target.id}
              />
            </MatrixHarnessCellTarget>
          </td>
        );
      })}

      <td className="matrix-table__cell matrix-table__cell--compact">
        <SlashMatrixTargetStack command={command} targets={targets} />
      </td>

      <td className="matrix-table__cell matrix-table__cell--coverage">
        <span className="matrix-table__coverage" aria-label={`Active on ${enabledCount} of ${totalCount} targets`}>
          <span className="matrix-table__coverage-count">{enabledCount}</span>
          <span className="matrix-table__coverage-total" aria-hidden="true">
            {" / "}
            {totalCount}
          </span>
        </span>
      </td>
    </tr>
  );
}

function SlashMatrixTargetStack({
  command,
  targets,
}: {
  command: SlashCommandDto;
  targets: SlashTargetDto[];
}) {
  const enabled = syncedTargetIds(command);
  const enabledTargets = targets.filter((target) => enabled.has(target.id));
  return (
    <div className="skill-card__harness-row">
      <div className="harness-stack" aria-label={`Enabled on ${enabledTargets.length} targets`}>
        {enabledTargets.map((target, index) => {
          const presentation = getHarnessPresentation(target.id === "claude" ? "claude" : target.id);
          return (
            <UiTooltip key={target.id} content={target.label}>
              <span
                className="harness-stack__item"
                style={{ zIndex: enabledTargets.length - index }}
              >
                {presentation ? (
                  <img src={presentation.logoSrc} alt="" aria-hidden="true" />
                ) : (
                  <span className="harness-stack__fallback">{target.label.slice(0, 1)}</span>
                )}
              </span>
            </UiTooltip>
          );
        })}
      </div>
      <span className="skill-card__harness-count">
        {enabledTargets.length}/{targets.length}
      </span>
    </div>
  );
}

function syncedTargetIds(command: SlashCommandDto): Set<string> {
  return new Set(
    command.syncTargets
      .filter((entry) => entry.status === "synced")
      .map((entry) => entry.target),
  );
}

function sortCommands(commands: SlashCommandDto[], sort: SortState): SlashCommandDto[] {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...commands].sort((left, right) => {
    const comparison = compareBySortKey(left, right, sort.key);
    if (comparison !== 0) return comparison * direction;
    return left.name.localeCompare(right.name);
  });
}

function compareBySortKey(left: SlashCommandDto, right: SlashCommandDto, key: SortKey): number {
  if (key === "name") return left.name.localeCompare(right.name);
  if (key === "coverage") return syncedTargetIds(left).size - syncedTargetIds(right).size;
  const leftEnabled = syncedTargetIds(left).has(key.target) ? 1 : 0;
  const rightEnabled = syncedTargetIds(right).has(key.target) ? 1 : 0;
  return leftEnabled - rightEnabled;
}

function sortKeysEqual(left: SortKey, right: SortKey): boolean {
  if (typeof left === "string" || typeof right === "string") {
    return left === right;
  }
  return left.target === right.target;
}
