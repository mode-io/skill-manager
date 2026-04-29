import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";

import { DetailBindingIdentity } from "../../../components/detail/DetailBindingIdentity";
import type { SlashCommandDto, SlashSyncEntryDto, SlashTargetDto, SlashTargetId } from "../api/types";

interface SlashCommandFormValue {
  name: string;
  description: string;
  prompt: string;
  targets: SlashTargetId[];
}

interface SlashCommandFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  command: SlashCommandDto | null;
  targets: SlashTargetDto[];
  defaultTargets: SlashTargetId[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: SlashCommandFormValue) => Promise<void> | void;
}

export function SlashCommandFormDialog({
  open,
  mode,
  command,
  targets,
  defaultTargets,
  pending,
  onOpenChange,
  onSubmit,
}: SlashCommandFormDialogProps) {
  const initialTargets = useMemo(() => {
    if (!command) return defaultTargets;
    return command.syncTargets
      .filter((entry) => entry.status === "synced")
      .map((entry) => entry.target);
  }, [command, defaultTargets]);
  const targetById = useMemo(
    () => new Map(targets.map((target) => [target.id, target])),
    [targets],
  );
  const writtenEntries = useMemo(() => {
    if (!command) return [];
    const order = new Map(targets.map((target, index) => [target.id, index]));
    return [...command.syncTargets]
      .filter((entry) => entry.status === "synced")
      .sort((left, right) => (order.get(left.target) ?? 99) - (order.get(right.target) ?? 99));
  }, [command, targets]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<SlashTargetId[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(command?.name ?? "");
    setDescription(command?.description ?? "");
    setPrompt(command?.prompt ?? "");
    setSelectedTargets(initialTargets);
  }, [command, initialTargets, open]);

  const trimmedName = name.trim();
  const nameError = trimmedName && !isValidCommandName(trimmedName)
    ? "Use lowercase letters, numbers, and hyphens, for example code-review."
    : "";
  const canSubmit = trimmedName && !nameError && description.trim() && prompt.trim();
  const title = mode === "create" ? "New slash command" : "Edit slash command";

  function toggleTarget(target: SlashTargetId): void {
    setSelectedTargets((current) =>
      current.includes(target)
        ? current.filter((item) => item !== target)
        : [...current, target],
    );
  }

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return;
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      prompt,
      targets: selectedTargets,
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content slash-dialog">
          <div className="dialog-header slash-dialog__header">
            <div>
              <Dialog.Title className="dialog-title">{title}</Dialog.Title>
              <Dialog.Description className="dialog-description">
                Save one prompt and sync it into selected global command folders.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="icon-button" aria-label="Close" disabled={pending}>
                <X size={16} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="slash-form">
            <label className="slash-field">
              <span>Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={pending || mode === "edit"}
                placeholder="code-review"
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? "slash-command-name-error" : undefined}
              />
              {nameError ? (
                <small id="slash-command-name-error" className="slash-field__error">
                  {nameError}
                </small>
              ) : null}
            </label>

            <label className="slash-field">
              <span>Description</span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={pending}
                placeholder="Review code for bugs and security risks"
              />
            </label>

            <label className="slash-field">
              <span>Prompt</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                disabled={pending}
                placeholder="Review the following content:\n\n$ARGUMENTS"
                rows={10}
              />
            </label>

            <fieldset className="slash-target-picker">
              <legend>Harnesses</legend>
              <div className="detail-sheet__bindings">
                {targets.map((target) => {
                  const checked = selectedTargets.includes(target.id);
                  return (
                    <div
                      key={target.id}
                      className="detail-sheet__binding-row slash-target-binding-row"
                      data-state={checked ? "enabled" : "disabled"}
                    >
                      <DetailBindingIdentity
                        harness={target.id}
                        label={target.label}
                        logoKey={target.id === "claude" ? "claude" : target.id}
                        statusLabel={checked ? "Enabled" : "Disabled"}
                        tone={checked ? "enabled" : "disabled"}
                      />
                      <div className="detail-sheet__binding-actions">
                        <button
                          type="button"
                          className={`action-pill ${checked ? "action-pill--danger" : "action-pill--accent"}`}
                          disabled={pending}
                          onClick={() => toggleTarget(target.id)}
                          aria-pressed={checked}
                          aria-label={`${checked ? "Disable" : "Enable"} ${target.label}`}
                        >
                          {checked ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            {writtenEntries.length > 0 ? (
              <section className="slash-written-locations" aria-labelledby="slash-written-locations-title">
                <h3 id="slash-written-locations-title">Write locations</h3>
                <div className="detail-sheet__bindings">
                  {writtenEntries.map((entry) => (
                    <SlashWrittenLocationRow
                      key={`${entry.target}:${entry.path}`}
                      entry={entry}
                      target={targetById.get(entry.target)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending || !canSubmit}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {pending ? <Loader2 size={13} className="slash-spinner" aria-hidden="true" /> : null}
              {mode === "create" ? "Create" : "Save"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SlashWrittenLocationRow({
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
        logoKey={entry.target === "claude" ? "claude" : entry.target}
        statusLabel="Written"
        tone="enabled"
        visibleStatus="Written"
      />
      <p className="slash-written-location-row__path">{entry.path}</p>
    </div>
  );
}

function isValidCommandName(name: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
}
