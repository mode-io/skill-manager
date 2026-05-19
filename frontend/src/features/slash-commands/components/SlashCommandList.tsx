import { useMemo } from "react";
import { Loader2, Power, Trash2 } from "lucide-react";

import { CardMenu, type CardMenuItem } from "../../../components/cards/CardMenu";
import { CardSelectCheckbox } from "../../../components/cards/CardSelectCheckbox";
import { MatrixHarnessIcon } from "../../../components/matrix";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { OverflowTooltipText } from "../../../components/ui/OverflowTooltipText";
import type { SlashCommandDto, SlashSyncEntryDto, SlashTargetDto } from "../api/types";
import { useSlashCommandsCopy, type SlashCommandsCopy } from "../i18n";
import { countSyncedTargets } from "../model/selectors";

interface SlashCommandListProps {
  commands: SlashCommandDto[];
  targets: SlashTargetDto[];
  pendingName: string | null;
  pendingTarget: string | null;
  checkedNames: ReadonlySet<string>;
  onOpen: (command: SlashCommandDto) => void;
  onSetAllTargets: (command: SlashCommandDto, target: "enabled" | "disabled") => void;
  onToggleTarget: (command: SlashCommandDto, target: SlashTargetDto) => void;
  onToggleChecked: (name: string) => void;
  onDelete: (command: SlashCommandDto) => void;
}

export function SlashCommandList({
  commands,
  targets,
  pendingName,
  pendingTarget,
  checkedNames,
  onOpen,
  onSetAllTargets,
  onToggleTarget,
  onToggleChecked,
  onDelete,
}: SlashCommandListProps) {
  const copy = useSlashCommandsCopy();

  if (commands.length === 0) {
    return (
      <div className="empty-panel">
        <p className="empty-panel__title">{copy.detail.listEmptyTitle}</p>
        <p className="empty-panel__body">{copy.detail.listEmptyBody}</p>
      </div>
    );
  }

  return (
    <section className="skill-grid" aria-label={copy.detail.listAria}>
      {commands.map((command) => (
        <SlashCommandCard
          key={command.name}
          command={command}
          targets={targets}
          pending={pendingName === command.name}
          pendingTarget={pendingName === command.name ? pendingTarget : null}
          checked={checkedNames.has(command.name)}
          onOpen={onOpen}
          onSetAllTargets={onSetAllTargets}
          onToggleTarget={onToggleTarget}
          onToggleChecked={onToggleChecked}
          onDelete={onDelete}
          copy={copy}
        />
      ))}
    </section>
  );
}

function SlashCommandCard({
  command,
  targets,
  pending,
  pendingTarget,
  checked,
  onOpen,
  onSetAllTargets,
  onToggleTarget,
  onToggleChecked,
  onDelete,
  copy,
}: {
  command: SlashCommandDto;
  targets: SlashTargetDto[];
  pending: boolean;
  pendingTarget: string | null;
  checked: boolean;
  onOpen: (command: SlashCommandDto) => void;
  onSetAllTargets: (command: SlashCommandDto, target: "enabled" | "disabled") => void;
  onToggleTarget: (command: SlashCommandDto, target: SlashTargetDto) => void;
  onToggleChecked: (name: string) => void;
  onDelete: (command: SlashCommandDto) => void;
  copy: SlashCommandsCopy;
}) {
  const activeCount = countSyncedTargets(command);
  const allEnabled = targets.length > 0 && activeCount === targets.length;
  const setAllTarget: "enabled" | "disabled" = allEnabled ? "disabled" : "enabled";
  const menuItems = useMemo<CardMenuItem[]>(
    () => [
      {
        key: "delete",
        label: copy.detail.delete,
        icon: <Trash2 size={13} aria-hidden="true" />,
        destructive: true,
        onSelect: () => onDelete(command),
      },
    ],
    [command, copy.detail.delete, onDelete],
  );

  return (
    <article
      className="skill-card slash-command-card"
      data-selected={checked}
      onClick={() => onOpen(command)}
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
        <CardMenu
          label={copy.detail.moreActions(command.name)}
          items={menuItems}
          disabled={pending}
        />
        <CardSelectCheckbox
          checked={checked}
          onToggle={() => onToggleChecked(command.name)}
          label={checked ? copy.detail.deselect(command.name) : copy.detail.select(command.name)}
        />
      </div>

      {command.description ? <p className="skill-card__description">{command.description}</p> : null}

      <div className="skill-card__footer">
        <SlashTargetStack
          command={command}
          targets={targets}
          pendingTarget={pendingTarget}
          disabled={pending}
          onToggleTarget={onToggleTarget}
          copy={copy}
        />
        <span className="skill-card__harness-count" aria-label={copy.detail.activeOnTargets(activeCount, targets.length)}>
          {activeCount}/{targets.length}
        </span>
        <button
          type="button"
          className="action-pill"
          disabled={pending || targets.length === 0}
          onClick={(event) => {
            event.stopPropagation();
            onSetAllTargets(command, setAllTarget);
          }}
          aria-label={setAllTarget === "enabled" ? copy.detail.enableOnAllTargets : copy.detail.disableEverywhere}
        >
          {pending && (pendingTarget === null || pendingTarget === "all") ? (
            <Loader2 size={12} className="card-action-spinner" aria-hidden="true" />
          ) : (
            <Power size={12} aria-hidden="true" />
          )}
          {setAllTarget === "enabled" ? copy.detail.enableOnAll : copy.detail.disableEverywhere}
        </button>
      </div>
    </article>
  );
}

function SlashTargetStack({
  command,
  targets,
  pendingTarget,
  disabled,
  onToggleTarget,
  copy,
}: {
  command: SlashCommandDto;
  targets: SlashTargetDto[];
  pendingTarget: string | null;
  disabled: boolean;
  onToggleTarget: (command: SlashCommandDto, target: SlashTargetDto) => void;
  copy: SlashCommandsCopy;
}) {
  const entries = new Map(command.syncTargets.map((entry) => [entry.target, entry]));
  return (
    <span className="harness-stack slash-target-stack">
      {targets.map((target, index) => {
        const entry = entries.get(target.id);
        const synced = entry?.status === "synced";
        return (
          <UiTooltip key={target.id} content={targetTitle(target.label, entry, copy)}>
            <button
              type="button"
              className="harness-stack__item slash-target-stack__button"
              data-state={synced ? "enabled" : "disabled"}
              data-pending={pendingTarget === target.id ? "true" : undefined}
              style={{ zIndex: targets.length - index }}
              disabled={disabled || !target.enabled}
              onClick={(event) => {
                event.stopPropagation();
                onToggleTarget(command, target);
              }}
              aria-label={synced ? copy.detail.disableTargetFor(target.label, command.name) : copy.detail.enableTargetFor(target.label, command.name)}
              aria-pressed={synced}
            >
              <MatrixHarnessIcon
                label={target.label}
                logoKey={target.id === "claude" ? "claude" : target.id}
                harness={target.id}
              />
            </button>
          </UiTooltip>
        );
      })}
    </span>
  );
}

function targetTitle(label: string, entry: SlashSyncEntryDto | undefined, copy: SlashCommandsCopy): string {
  if (!entry || entry.status === "not_selected") return `${label}: ${copy.detail.notSelected}`;
  if (entry.error) return `${label}: ${entry.error}`;
  return `${label}: ${entry.status}`;
}
