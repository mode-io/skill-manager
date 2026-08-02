import { useMemo } from "react";
import { Loader2, PackageOpen, Power, Trash2 } from "lucide-react";

import { CardMenu, type CardMenuItem } from "../../../../components/cards/CardMenu";
import { UiTooltip } from "../../../../components/ui/UiTooltip";
import { getHarnessPresentation } from "../../../../components/harness/harnessPresentation";
import { useSkillsCopy } from "../../i18n";
import { cellActionKey } from "../../model/pending";
import type { CellActionKey, StructuralSkillAction } from "../../model/pending";
import type { HarnessCell, SkillListRow } from "../../model/types";
import { CardTitleRow } from "./CardTitleRow";

interface SkillInUseCardProps {
  row: SkillListRow;
  pendingToggleKeys: ReadonlySet<CellActionKey>;
  pendingStructuralAction: StructuralSkillAction | null;
  selected: boolean;
  checked: boolean;
  onOpenSkill: (skillRef: string) => void;
  onToggleChecked: (skillRef: string) => void;
  onToggleHarness: (row: SkillListRow, cell: HarnessCell) => void;
  onSetAllHarnesses: (
    skillRef: string,
    target: "enabled" | "disabled",
  ) => Promise<unknown> | void;
  onRequestRemove: (row: SkillListRow) => void;
  onRequestDelete: (row: SkillListRow) => void;
}

export function SkillInUseCard({
  row,
  pendingToggleKeys,
  pendingStructuralAction,
  selected,
  checked,
  onOpenSkill,
  onToggleChecked,
  onToggleHarness,
  onSetAllHarnesses,
  onRequestRemove,
  onRequestDelete,
}: SkillInUseCardProps) {
  const copy = useSkillsCopy();
  const menuItems = useMemo<CardMenuItem[]>(() => {
    const items: CardMenuItem[] = [];
    if (row.actions.canStopManaging) {
      items.push({
        key: "unmanage",
        label: copy.detail.removeFromSkillManager,
        icon: <PackageOpen size={13} aria-hidden="true" />,
        onSelect: () => onRequestRemove(row),
      });
    }
    if (row.actions.canDelete) {
      items.push({
        key: "delete",
        label: copy.detail.delete,
        icon: <Trash2 size={13} aria-hidden="true" />,
        destructive: true,
        onSelect: () => onRequestDelete(row),
      });
    }
    return items;
  }, [copy.detail.delete, copy.detail.removeFromSkillManager, row, onRequestDelete, onRequestRemove]);

  const interactiveCells = row.cells.filter((cell) => cell.interactive);
  const enabled = interactiveCells.filter((cell) => cell.state === "enabled").length;
  const total = interactiveCells.length;
  const allEnabled = total > 0 && enabled === total;
  const target: "enabled" | "disabled" = allEnabled ? "disabled" : "enabled";
  const anyCellPending = row.cells.some((cell) =>
    pendingToggleKeys.has(cellActionKey(row.skillRef, cell.harness)),
  );
  const setAllDisabled =
    total === 0 || anyCellPending || pendingStructuralAction !== null;

  return (
    <article
      className="skill-card"
      data-selected={selected}
      onClick={() => onOpenSkill(row.skillRef)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenSkill(row.skillRef);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardTitleRow
        name={row.name}
        checked={checked}
        onToggleChecked={() => onToggleChecked(row.skillRef)}
        menu={
          <CardMenu
            label={copy.detail.moreActions(row.name)}
            items={menuItems}
            disabled={pendingStructuralAction !== null}
          />
        }
      />

      {row.description ? <p className="skill-card__description">{row.description}</p> : null}

      <div className="skill-card__footer">
        <HarnessToggleStack
          row={row}
          pendingToggleKeys={pendingToggleKeys}
          disabled={pendingStructuralAction !== null}
          onToggleHarness={onToggleHarness}
        />
        <button
          type="button"
          className="action-pill"
          disabled={setAllDisabled}
          onClick={(event) => {
            event.stopPropagation();
            void onSetAllHarnesses(row.skillRef, target);
          }}
          aria-label={target === "enabled" ? copy.detail.enableOnAllAria : copy.detail.disableEverywhere}
        >
          {anyCellPending ? (
            <Loader2 size={12} className="card-action-spinner" aria-hidden="true" />
          ) : (
            <Power size={12} aria-hidden="true" />
          )}
          {target === "enabled" ? copy.detail.enableOnAll : copy.detail.disableEverywhere}
        </button>
      </div>
    </article>
  );
}

function HarnessToggleStack({
  row,
  pendingToggleKeys,
  disabled,
  onToggleHarness,
}: {
  row: SkillListRow;
  pendingToggleKeys: ReadonlySet<CellActionKey>;
  disabled: boolean;
  onToggleHarness: (row: SkillListRow, cell: HarnessCell) => void;
}) {
  const copy = useSkillsCopy().inUse;
  const cells = row.cells.filter((cell) => cell.interactive);
  const enabledCount = cells.filter((cell) => cell.state === "enabled").length;

  return (
    <div className="skill-card__harness-row">
      <div
        className="harness-stack skill-card__harness-toggle-stack"
        aria-label={copy.harnessToggleAria(enabledCount, cells.length)}
      >
        {cells.map((cell, index) => {
          const enabled = cell.state === "enabled";
          const pending = pendingToggleKeys.has(cellActionKey(row.skillRef, cell.harness));
          const presentation = getHarnessPresentation(cell.logoKey ?? cell.harness);
          return (
            <UiTooltip key={cell.harness} content={copy.harnessToggleTooltip(cell.label, enabled)}>
              <button
                type="button"
                className="harness-stack__item skill-card__harness-toggle"
                data-state={enabled ? "enabled" : "disabled"}
                data-pending={pending ? "true" : undefined}
                style={{ zIndex: cells.length - index }}
                disabled={disabled || pending}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleHarness(row, cell);
                }}
                aria-label={
                  enabled
                    ? copy.disableHarnessAria(row.name, cell.label)
                    : copy.enableHarnessAria(row.name, cell.label)
                }
                aria-pressed={enabled}
              >
                {presentation ? (
                  <img src={presentation.logoSrc} alt="" aria-hidden="true" />
                ) : (
                  <span className="harness-stack__fallback">{cell.label.slice(0, 1)}</span>
                )}
              </button>
            </UiTooltip>
          );
        })}
      </div>
      <span className="skill-card__harness-count">
        {enabledCount}/{cells.length}
      </span>
    </div>
  );
}
