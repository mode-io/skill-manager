import { useMemo } from "react";
import { Loader2, PackageOpen, Power, Trash2 } from "lucide-react";

import { CardMenu, type CardMenuItem } from "../../../../components/cards/CardMenu";
import { cellActionKey } from "../../model/pending";
import type { CellActionKey, StructuralSkillAction } from "../../model/pending";
import type { SkillListRow } from "../../model/types";
import { CardTitleRow } from "./CardTitleRow";
import { HarnessChipStack } from "./HarnessChipStack";

interface SkillInUseCardProps {
  row: SkillListRow;
  pendingToggleKeys: ReadonlySet<CellActionKey>;
  pendingStructuralAction: StructuralSkillAction | null;
  selected: boolean;
  checked: boolean;
  onOpenSkill: (skillRef: string) => void;
  onToggleChecked: (skillRef: string) => void;
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
  onSetAllHarnesses,
  onRequestRemove,
  onRequestDelete,
}: SkillInUseCardProps) {
  const menuItems = useMemo<CardMenuItem[]>(() => {
    const items: CardMenuItem[] = [];
    if (row.actions.canStopManaging) {
      items.push({
        key: "unmanage",
        label: "Remove from Skill Manager",
        icon: <PackageOpen size={13} aria-hidden="true" />,
        onSelect: () => onRequestRemove(row),
      });
    }
    if (row.actions.canDelete) {
      items.push({
        key: "delete",
        label: "Delete",
        icon: <Trash2 size={13} aria-hidden="true" />,
        destructive: true,
        onSelect: () => onRequestDelete(row),
      });
    }
    return items;
  }, [row, onRequestDelete, onRequestRemove]);

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
            label={`More actions for ${row.name}`}
            items={menuItems}
            disabled={pendingStructuralAction !== null}
          />
        }
      />

      {row.description ? <p className="skill-card__description">{row.description}</p> : null}

      <div className="skill-card__footer">
        <HarnessChipStack cells={row.cells} />
        <button
          type="button"
          className="action-pill"
          disabled={setAllDisabled}
          onClick={(event) => {
            event.stopPropagation();
            void onSetAllHarnesses(row.skillRef, target);
          }}
          aria-label={target === "enabled" ? "Enable on all harnesses" : "Disable everywhere"}
        >
          {anyCellPending ? (
            <Loader2 size={12} className="card-action-spinner" aria-hidden="true" />
          ) : (
            <Power size={12} aria-hidden="true" />
          )}
          {target === "enabled" ? "Enable on all" : "Disable everywhere"}
        </button>
      </div>
    </article>
  );
}
