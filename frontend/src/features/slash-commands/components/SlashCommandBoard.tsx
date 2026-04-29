import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { CardSelectCheckbox } from "../../../components/cards/CardSelectCheckbox";
import { getHarnessPresentation } from "../../../components/harness/harnessPresentation";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { OverflowTooltipText } from "../../../components/ui/OverflowTooltipText";
import type { SlashCommandDto, SlashTargetDto } from "../api/types";
import {
  bucketForSlashCommand,
  enabledTargetsForCommand,
  type SlashBucket,
  type SlashCommandBuckets,
  type SlashTerminalBucket,
} from "../model/selectors";

interface SlashCommandBoardProps {
  commands: SlashCommandDto[];
  buckets: SlashCommandBuckets;
  targets: SlashTargetDto[];
  pendingName: string | null;
  checkedNames: ReadonlySet<string>;
  onOpen: (command: SlashCommandDto) => void;
  onToggleChecked: (name: string) => void;
  onSetAllTargets: (command: SlashCommandDto, target: SlashTerminalBucket) => Promise<void> | void;
}

const TERMINAL_BUCKETS: ReadonlySet<SlashBucket> = new Set(["disabled", "enabled"]);

function isTerminalBucket(value: unknown): value is SlashTerminalBucket {
  return value === "disabled" || value === "enabled";
}

export function SlashCommandBoard({
  commands,
  buckets: baseBuckets,
  targets,
  pendingName,
  checkedNames,
  onOpen,
  onToggleChecked,
  onSetAllTargets,
}: SlashCommandBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [transitionTarget, setTransitionTarget] = useState<Map<string, SlashTerminalBucket>>(
    () => new Map(),
  );

  useEffect(() => {
    if (transitionTarget.size === 0) return;
    setTransitionTarget((current) => {
      const next = new Map(current);
      for (const name of current.keys()) {
        if (name !== pendingName) {
          next.delete(name);
        }
      }
      return next;
    });
  }, [pendingName, transitionTarget.size]);

  const buckets = useMemo(() => {
    const base = baseBuckets;
    if (transitionTarget.size === 0) return base;

    const pinned = new Map<string, SlashCommandDto>();
    for (const command of commands) {
      if (transitionTarget.has(command.name)) {
        pinned.set(command.name, command);
      }
    }
    if (pinned.size === 0) return base;

    const strip = (list: SlashCommandDto[]) =>
      list.filter((command) => !pinned.has(command.name));
    const rebucketed: Record<SlashBucket, SlashCommandDto[]> = {
      disabled: strip(base.disabled),
      selective: strip(base.selective),
      enabled: strip(base.enabled),
    };
    for (const [name, command] of pinned) {
      rebucketed[transitionTarget.get(name)!].push(command);
    }
    return rebucketed;
  }, [baseBuckets, commands, transitionTarget]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !isTerminalBucket(over.id)) return;

      const activeName = String(active.id);
      const command = commands.find((candidate) => candidate.name === activeName);
      if (!command) return;

      const targetBucket = over.id;
      const currentBucket = bucketForSlashCommand(command, targets.length);
      if (TERMINAL_BUCKETS.has(currentBucket) && currentBucket === targetBucket) {
        return;
      }

      setTransitionTarget((current) => {
        const next = new Map(current);
        next.set(activeName, targetBucket);
        return next;
      });
      void onSetAllTargets(command, targetBucket);
    },
    [commands, onSetAllTargets, targets.length],
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="skill-board" role="group" aria-label="Slash commands board">
        <SlashBoardColumn
          kind="disabled"
          title="Disabled everywhere"
          description="Not active on any harness."
          count={buckets.disabled.length}
          emptyMessage="No slash commands are disabled everywhere."
        >
          {buckets.disabled.map((command) => (
            <SlashBoardCard
              key={command.name}
              command={command}
              targets={targets}
              pending={pendingName === command.name}
              checked={checkedNames.has(command.name)}
              onOpen={onOpen}
              onToggleChecked={onToggleChecked}
            />
          ))}
        </SlashBoardColumn>

        <SlashBoardColumn
          kind="selective"
          title="Selective"
          description="Enabled on some harnesses, not others."
          count={buckets.selective.length}
          emptyMessage="No slash commands are partially enabled. Open a card to pick specific harnesses."
        >
          {buckets.selective.map((command) => (
            <SlashBoardCard
              key={command.name}
              command={command}
              targets={targets}
              pending={pendingName === command.name}
              checked={checkedNames.has(command.name)}
              onOpen={onOpen}
              onToggleChecked={onToggleChecked}
            />
          ))}
        </SlashBoardColumn>

        <SlashBoardColumn
          kind="enabled"
          title="Enabled everywhere"
          description="Active on every available harness."
          count={buckets.enabled.length}
          emptyMessage="No slash commands are enabled everywhere yet."
        >
          {buckets.enabled.map((command) => (
            <SlashBoardCard
              key={command.name}
              command={command}
              targets={targets}
              pending={pendingName === command.name}
              checked={checkedNames.has(command.name)}
              onOpen={onOpen}
              onToggleChecked={onToggleChecked}
            />
          ))}
        </SlashBoardColumn>
      </div>
    </DndContext>
  );
}

function SlashBoardColumn({
  kind,
  title,
  description,
  count,
  emptyMessage,
  children,
}: {
  kind: SlashBucket;
  title: string;
  description: string;
  count: number;
  emptyMessage: string;
  children: ReactNode;
}) {
  const labelId = `slash-board-column-${kind}-label`;
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
            <span className="board-column__count" aria-label={`${count} slash commands`}>
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

function SlashBoardCard({
  command,
  targets,
  pending,
  checked,
  onOpen,
  onToggleChecked,
}: {
  command: SlashCommandDto;
  targets: SlashTargetDto[];
  pending: boolean;
  checked: boolean;
  onOpen: (command: SlashCommandDto) => void;
  onToggleChecked: (name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: command.name,
  });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="skill-card skill-card--board slash-board-card"
      data-checked={checked}
      data-dragging={isDragging ? "true" : undefined}
      data-pending={pending ? "true" : undefined}
      style={style}
      onClick={() => {
        if (!isDragging) onOpen(command);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(command);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="skill-card__head">
        <div className="slash-command-card__title">
          <OverflowTooltipText as="h3" className="skill-card__name">
            {command.name}
          </OverflowTooltipText>
        </div>
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <CardSelectCheckbox
          checked={checked}
          onToggle={() => onToggleChecked(command.name)}
          label={checked ? `Deselect ${command.name}` : `Select ${command.name}`}
        />
      </div>

      {command.description ? (
        <p className="skill-card__description skill-card__description--compact">{command.description}</p>
      ) : null}

      <SlashBoardTargetStack command={command} targets={targets} />
    </article>
  );
}

function SlashBoardTargetStack({
  command,
  targets,
}: {
  command: SlashCommandDto;
  targets: SlashTargetDto[];
}) {
  const enabledTargets = enabledTargetsForCommand(command, targets);
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
