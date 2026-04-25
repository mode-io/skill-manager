import type { ReactNode } from "react";
import { useDndContext, useDroppable } from "@dnd-kit/core";

export type BoardColumnKind = "disabled" | "selective" | "enabled";

interface BoardColumnProps {
  kind: BoardColumnKind;
  title: string;
  description: string;
  count: number;
  emptyMessage: string;
  children: ReactNode;
}

export function BoardColumn({ kind, title, description, count, emptyMessage, children }: BoardColumnProps) {
  const labelId = `board-column-${kind}-label`;
  const isDropTarget = kind !== "selective";
  const { setNodeRef, isOver } = useDroppable({ id: kind, disabled: !isDropTarget });
  const { active } = useDndContext();
  const dragInProgress = active !== null;

  return (
    <div
      ref={setNodeRef}
      className={`board-column-slot board-column-slot--${kind}`}
      data-kind={kind}
      data-drop-active={isDropTarget && isOver ? "true" : undefined}
      data-drop-target={isDropTarget ? "true" : "false"}
      data-drag-global={dragInProgress ? "true" : undefined}
    >
      <section className={`board-column board-column--${kind}`} aria-labelledby={labelId}>
        <header className="board-column__head">
          <div className="board-column__title-row">
            <h3 className="board-column__title" id={labelId}>
              {title}
            </h3>
            <span className="board-column__count" aria-label={`${count} skills`}>
              {count}
            </span>
          </div>
          <p className="board-column__description">{description}</p>
        </header>
        <div className="board-column__body">
          {count === 0 ? <p className="board-column__empty">{emptyMessage}</p> : children}
        </div>
      </section>
    </div>
  );
}
