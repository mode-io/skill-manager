import { useId, useMemo } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";

import { DetailBindingIdentity } from "../../../../components/detail/DetailBindingIdentity";
import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { DetailSection } from "../../../../components/detail/DetailSection";
import type { SlashCommandDto, SlashSyncEntryDto, SlashTargetDto } from "../../api/types";
import { syncedTargetIds } from "../../model/selectors";
import { SlashCommandContentSections } from "./SlashCommandContentBlocks";

interface SlashCommandDetailViewProps {
  command: SlashCommandDto;
  targets: SlashTargetDto[];
  pendingName: string | null;
  pendingTarget: string | null;
  onClose: () => void;
  onEdit: (command: SlashCommandDto) => void;
  onDelete: (command: SlashCommandDto) => void;
  onToggleTarget: (command: SlashCommandDto, target: SlashTargetDto) => void;
}

export function SlashCommandDetailView({
  command,
  targets,
  pendingName,
  pendingTarget,
  onClose,
  onEdit,
  onDelete,
  onToggleTarget,
}: SlashCommandDetailViewProps) {
  const headingId = useId();
  const commandPending = pendingName === command.name;
  const enabledTargetIds = useMemo(() => syncedTargetIds(command), [command]);
  const writtenEntries = useMemo(
    () => writtenLocationEntries(command.syncTargets, targets),
    [command.syncTargets, targets],
  );

  return (
    <>
      <div className="slash-command-detail-shell__chrome">
        <DetailHeader
          title={<h2 id={headingId}>{command.name}</h2>}
          closeLabel="Close slash command detail"
          onClose={onClose}
        />
      </div>

      <div className="slash-command-detail-shell__body ui-scrollbar" aria-labelledby={headingId}>
        <div className="detail-sheet__body">
          <SlashCommandContentSections
            description={command.description}
            prompt={command.prompt}
          />

          <HarnessesSection
            command={command}
            targets={targets}
            enabledTargetIds={enabledTargetIds}
            commandPending={commandPending}
            pendingTarget={pendingTarget}
            onToggleTarget={onToggleTarget}
          />

          <LocationsSection entries={writtenEntries} targets={targets} />
        </div>
      </div>

      <footer className="slash-command-detail-shell__footer" aria-label="Slash command actions">
        <button
          type="button"
          className="action-pill action-pill--md"
          disabled={commandPending}
          onClick={() => onEdit(command)}
        >
          <Pencil size={13} aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          className="action-pill action-pill--md action-pill--danger"
          disabled={commandPending}
          onClick={() => onDelete(command)}
        >
          <Trash2 size={13} aria-hidden="true" />
          Delete
        </button>
      </footer>
    </>
  );
}

function HarnessesSection({
  command,
  targets,
  enabledTargetIds,
  commandPending,
  pendingTarget,
  onToggleTarget,
}: {
  command: SlashCommandDto;
  targets: SlashTargetDto[];
  enabledTargetIds: ReadonlySet<string>;
  commandPending: boolean;
  pendingTarget: string | null;
  onToggleTarget: (command: SlashCommandDto, target: SlashTargetDto) => void;
}) {
  return (
    <DetailSection heading="Harnesses">
      <div className="detail-sheet__bindings" aria-label={`Harnesses for ${command.name}`}>
        {targets.map((target) => {
          const enabled = enabledTargetIds.has(target.id);
          const targetPending = commandPending && pendingTarget === target.id;
          return (
            <div
              key={target.id}
              className="detail-sheet__binding-row"
              data-state={enabled ? "enabled" : "disabled"}
              data-pending={targetPending ? "true" : undefined}
            >
              <DetailBindingIdentity
                harness={target.id}
                label={target.label}
                logoKey={logoKeyForHarness(target.id)}
                statusLabel={enabled ? "Enabled" : "Disabled"}
                tone={enabled ? "enabled" : "disabled"}
                visibleStatus={enabled ? "Enabled" : null}
              />
              <div className="detail-sheet__binding-actions">
                <button
                  type="button"
                  className={`action-pill ${enabled ? "action-pill--danger" : "action-pill--accent"}`}
                  disabled={commandPending || !target.enabled}
                  onClick={() => onToggleTarget(command, target)}
                  aria-pressed={enabled}
                  aria-label={`${enabled ? "Disable" : "Enable"} ${target.label} for ${command.name}`}
                >
                  {targetPending ? (
                    <Loader2 size={12} className="card-action-spinner" aria-hidden="true" />
                  ) : null}
                  {enabled ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </DetailSection>
  );
}

function LocationsSection({
  entries,
  targets,
}: {
  entries: SlashSyncEntryDto[];
  targets: SlashTargetDto[];
}) {
  const targetById = new Map(targets.map((target) => [target.id, target]));
  return (
    <DetailSection heading="Locations">
      {entries.length > 0 ? (
        <div className="detail-sheet__bindings">
          {entries.map((entry) => (
            <SlashCommandLocationRow
              key={`${entry.target}:${entry.path}`}
              entry={entry}
              target={targetById.get(entry.target)}
            />
          ))}
        </div>
      ) : (
        <p className="slash-review-detail__empty">No harness locations are enabled.</p>
      )}
    </DetailSection>
  );
}

function SlashCommandLocationRow({
  entry,
  target,
}: {
  entry: SlashSyncEntryDto;
  target: SlashTargetDto | undefined;
}) {
  const label = target?.label ?? entry.target;
  return (
    <div className="detail-sheet__binding-row slash-written-location-row">
      <DetailBindingIdentity
        harness={entry.target}
        label={label}
        logoKey={logoKeyForHarness(entry.target)}
        statusLabel="Written"
        tone="enabled"
        visibleStatus="Written"
      />
      <p className="slash-written-location-row__path">{entry.path}</p>
    </div>
  );
}

function writtenLocationEntries(
  entries: SlashSyncEntryDto[],
  targets: SlashTargetDto[],
): SlashSyncEntryDto[] {
  const order = new Map(targets.map((target, index) => [target.id, index]));
  return [...entries]
    .filter((entry) => entry.status === "synced")
    .sort((left, right) => (order.get(left.target) ?? 99) - (order.get(right.target) ?? 99));
}

function logoKeyForHarness(id: string): string {
  return id === "claude" ? "claude" : id;
}
