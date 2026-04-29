import { useMemo } from "react";
import { Loader2, Power, Trash2 } from "lucide-react";

import { CardMenu, type CardMenuItem } from "../../../components/cards/CardMenu";
import { CardSelectCheckbox } from "../../../components/cards/CardSelectCheckbox";
import { MatrixHarnessIcon } from "../../../components/matrix";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { OverflowTooltipText } from "../../../components/ui/OverflowTooltipText";
import type { SlashCommandDto, SlashSyncEntryDto, SlashTargetDto } from "../api/types";

interface SlashCommandListProps {
  commands: SlashCommandDto[];
  targets: SlashTargetDto[];
  pendingName: string | null;
  pendingTarget: string | null;
  checkedNames: ReadonlySet<string>;
  onEdit: (command: SlashCommandDto) => void;
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
  onEdit,
  onSetAllTargets,
  onToggleTarget,
  onToggleChecked,
  onDelete,
}: SlashCommandListProps) {
  if (commands.length === 0) {
    return (
      <div className="empty-panel">
        <p className="empty-panel__title">No slash commands yet</p>
        <p className="empty-panel__body">Create one command and sync it into your local AI tools.</p>
      </div>
    );
  }

  return (
    <section className="skill-grid" aria-label="Slash commands in use list">
      {commands.map((command) => (
        <SlashCommandCard
          key={command.name}
          command={command}
          targets={targets}
          pending={pendingName === command.name}
          pendingTarget={pendingName === command.name ? pendingTarget : null}
          checked={checkedNames.has(command.name)}
          onEdit={onEdit}
          onSetAllTargets={onSetAllTargets}
          onToggleTarget={onToggleTarget}
          onToggleChecked={onToggleChecked}
          onDelete={onDelete}
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
  onEdit,
  onSetAllTargets,
  onToggleTarget,
  onToggleChecked,
  onDelete,
}: {
  command: SlashCommandDto;
  targets: SlashTargetDto[];
  pending: boolean;
  pendingTarget: string | null;
  checked: boolean;
  onEdit: (command: SlashCommandDto) => void;
  onSetAllTargets: (command: SlashCommandDto, target: "enabled" | "disabled") => void;
  onToggleTarget: (command: SlashCommandDto, target: SlashTargetDto) => void;
  onToggleChecked: (name: string) => void;
  onDelete: (command: SlashCommandDto) => void;
}) {
  const activeCount = countSynced(command);
  const allEnabled = targets.length > 0 && activeCount === targets.length;
  const setAllTarget: "enabled" | "disabled" = allEnabled ? "disabled" : "enabled";
  const menuItems = useMemo<CardMenuItem[]>(
    () => [
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 size={13} aria-hidden="true" />,
        destructive: true,
        onSelect: () => onDelete(command),
      },
    ],
    [command, onDelete],
  );

  return (
    <article
      className="skill-card slash-command-card"
      data-selected={checked}
      onClick={() => onEdit(command)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(command);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="skill-card__head">
        <div className="slash-command-card__title">
          <OverflowTooltipText as="h3" className="skill-card__name">
            /{command.name}
          </OverflowTooltipText>
          <OverflowTooltipText as="span" className="slash-row__codex">
            /prompts:{command.name}
          </OverflowTooltipText>
        </div>
        <span aria-hidden="true" />
        <CardMenu
          label={`More actions for ${command.name}`}
          items={menuItems}
          disabled={pending}
        />
        <CardSelectCheckbox
          checked={checked}
          onToggle={() => onToggleChecked(command.name)}
          label={checked ? `Deselect ${command.name}` : `Select ${command.name}`}
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
        />
        <span className="skill-card__harness-count" aria-label={`Active on ${activeCount} of ${targets.length} targets`}>
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
          aria-label={setAllTarget === "enabled" ? "Enable on all targets" : "Disable everywhere"}
        >
          {pending && (pendingTarget === null || pendingTarget === "all") ? (
            <Loader2 size={12} className="card-action-spinner" aria-hidden="true" />
          ) : (
            <Power size={12} aria-hidden="true" />
          )}
          {setAllTarget === "enabled" ? "Enable on all" : "Disable everywhere"}
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
}: {
  command: SlashCommandDto;
  targets: SlashTargetDto[];
  pendingTarget: string | null;
  disabled: boolean;
  onToggleTarget: (command: SlashCommandDto, target: SlashTargetDto) => void;
}) {
  const entries = new Map(command.syncTargets.map((entry) => [entry.target, entry]));
  return (
    <span className="harness-stack slash-target-stack">
      {targets.map((target, index) => {
        const entry = entries.get(target.id);
        const synced = entry?.status === "synced";
        return (
          <UiTooltip key={target.id} content={targetTitle(target.label, entry)}>
            <button
              type="button"
              className="harness-stack__item slash-target-stack__button"
              data-state={synced ? "enabled" : "disabled"}
              data-pending={pendingTarget === target.id ? "true" : undefined}
              style={{ zIndex: targets.length - index }}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onToggleTarget(command, target);
              }}
              aria-label={`${synced ? "Disable" : "Enable"} ${target.label} for ${command.name}`}
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

function countSynced(command: SlashCommandDto): number {
  return command.syncTargets.filter((entry) => entry.status === "synced").length;
}

function targetTitle(label: string, entry: SlashSyncEntryDto | undefined): string {
  if (!entry || entry.status === "not_selected") return `${label}: not selected`;
  if (entry.error) return `${label}: ${entry.error}`;
  return `${label}: ${entry.status}`;
}
