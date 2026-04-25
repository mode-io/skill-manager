import type { CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { CardTitleRow } from "../cards/CardTitleRow";
import { HarnessChipStack } from "../cards/HarnessChipStack";
import type { SkillListRow } from "../../model/types";

interface BoardSkillCardProps {
  row: SkillListRow;
  checked: boolean;
  pending?: boolean;
  multiDragCount?: number;
  onOpenSkill: (skillRef: string) => void;
  onToggleChecked: (skillRef: string) => void;
}

export function BoardSkillCard({
  row,
  checked,
  pending = false,
  multiDragCount,
  onOpenSkill,
  onToggleChecked,
}: BoardSkillCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: row.skillRef,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  const showMultiDragBadge = isDragging && checked && (multiDragCount ?? 0) > 1;

  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="skill-card skill-card--board"
      data-checked={checked}
      data-dragging={isDragging ? "true" : undefined}
      data-multi-drag={showMultiDragBadge ? "true" : undefined}
      data-pending={pending ? "true" : undefined}
      style={style}
      onClick={() => {
        if (isDragging) return;
        onOpenSkill(row.skillRef);
      }}
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
      />

      {row.description ? (
        <p className="skill-card__description skill-card__description--compact">{row.description}</p>
      ) : null}

      <HarnessChipStack cells={row.cells} />

      {showMultiDragBadge ? (
        <span className="skill-card__multi-badge" aria-hidden="true">
          +{multiDragCount! - 1}
        </span>
      ) : null}
    </article>
  );
}
