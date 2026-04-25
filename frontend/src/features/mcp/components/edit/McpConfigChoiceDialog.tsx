import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";

import { UiTooltip } from "../../../../components/ui/UiTooltip";
import type {
  McpConfigChoiceDto,
  McpEnvEntryDto,
  McpServerSpecDto,
} from "../../api/management-types";
import {
  envChipLabel,
  formatEnvKeyPreview,
  pickRecommendedConfigChoice,
  summarizeMcpConfig,
} from "../../model/selectors";

export interface McpConfigChoiceOption {
  id: string;
  sourceKind: "managed" | "harness";
  sourceHarness?: string | null;
  label: string;
  logoKey?: string | null;
  configPath?: string | null;
  payloadPreview: Record<string, unknown>;
  spec: McpServerSpecDto;
  env: McpEnvEntryDto[];
}

interface McpConfigChoiceDialogProps {
  open: boolean;
  mode: "adopt" | "resolve";
  serverName: string;
  options: McpConfigChoiceOption[];
  pending: boolean;
  onClose: () => void;
  onConfirm: (option: McpConfigChoiceOption) => Promise<void> | void;
}

export function McpConfigChoiceDialog({
  open,
  mode,
  serverName,
  options,
  pending,
  onClose,
  onConfirm,
}: McpConfigChoiceDialogProps) {
  const recommendedId = useMemo(
    () => pickRecommendedConfigChoice(options.map(toConfigChoiceDto)),
    [options],
  );
  const [chosenId, setChosenId] = useState<string>(
    () => recommendedId ?? options[0]?.id ?? "",
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setChosenId(recommendedId ?? options[0]?.id ?? "");
    setExpanded({});
  }, [serverName, options, recommendedId]);

  const chosen = options.find((option) => option.id === chosenId);
  const title = mode === "adopt" ? "Choose config to adopt" : "Resolve different configs";
  const description = mode === "adopt"
    ? "Pick the config to store as the Skill Manager config. Other harness entries will be rewritten to match it."
    : "Pick the config Skill Manager should manage. Current bindings will be rewritten to match it.";
  const confirmLabel = mode === "adopt" ? "Adopt" : "Apply config";

  async function handleCommit(): Promise<void> {
    if (!chosen) return;
    try {
      await onConfirm(chosen);
    } catch {
      // Parent controllers surface mutation failures in the shared error banner.
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="mcp-choose-version" aria-label={`${title} for ${serverName}`}>
          <header className="mcp-choose-version__head">
            <div>
              <Dialog.Title className="mcp-choose-version__title">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mcp-choose-version__subtitle">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="mcp-choose-version__close"
                aria-label="Close config choice dialog"
                disabled={pending}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>

          <div className="mcp-choose-version__body ui-scrollbar">
            {options.map((option) => {
              const selected = option.id === chosenId;
              const isRecommended = option.id === recommendedId;
              const isExpanded = expanded[option.id] ?? false;
              const summary = summarizeMcpConfig(option.spec, option.env);
              return (
                <label
                  key={option.id}
                  className="mcp-choose-version__option"
                  data-selected={selected || undefined}
                >
                  <input
                    type="radio"
                    className="u-visually-hidden"
                    name="chosen-config"
                    value={option.id}
                    checked={selected}
                    onChange={() => setChosenId(option.id)}
                    disabled={pending}
                  />
                  <span
                    className="mcp-choose-version__indicator"
                    aria-hidden="true"
                    data-selected={selected || undefined}
                  >
                    {selected ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : null}
                  </span>
                  <div className="mcp-choose-version__option-body">
                    <div className="mcp-choose-version__option-head">
                      <strong className="mcp-choose-version__option-label">{option.label}</strong>
                      {isRecommended ? (
                        <span className="chip chip--verified">Recommended</span>
                      ) : null}
                    </div>
                    <p className="mcp-choose-version__summary">{summary.primary}</p>
                    <div className="mcp-choose-version__facts">
                      {summary.credentialInUrl ? (
                        <span className="chip chip--warning mcp-choose-version__fact-chip">
                          <AlertTriangle size={11} aria-hidden="true" />
                          Credential in URL
                        </span>
                      ) : null}
                      {summary.envCount > 0 ? (
                        <>
                          <span className="chip chip--env mcp-choose-version__fact-chip">
                            {envChipLabel(summary.envCount)}
                          </span>
                          <span className="mcp-choose-version__env-keys">
                            {formatEnvKeyPreview(summary.envKeys)}
                          </span>
                        </>
                      ) : !summary.credentialInUrl ? (
                        <span className="mcp-choose-version__env-keys">
                          No environment values
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="mcp-choose-version__disclosure"
                      aria-expanded={isExpanded}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setExpanded((prev) => ({
                          ...prev,
                          [option.id]: !isExpanded,
                        }));
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown size={12} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={12} aria-hidden="true" />
                      )}
                      {isExpanded ? "Hide config preview" : "Show config preview"}
                    </button>
                    {isExpanded ? (
                      <pre className="mcp-choose-version__payload ui-scrollbar">
                        {JSON.stringify(option.payloadPreview, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>

          <footer className="mcp-choose-version__footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </button>
            <UiTooltip content={mode === "adopt" ? "Add to Skill Manager using the selected config" : "Apply the selected config to current bindings"}>
              <button
                type="button"
                className="action-pill"
                onClick={() => {
                  void handleCommit();
                }}
                disabled={pending || !chosen}
              >
                {pending ? (
                  <Loader2 size={12} className="mcp-choose-version__spinner" aria-hidden="true" />
                ) : null}
                {confirmLabel}
              </button>
            </UiTooltip>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function toConfigChoiceDto(option: McpConfigChoiceOption): McpConfigChoiceDto {
  return {
    sourceKind: option.sourceKind,
    sourceHarness: option.sourceHarness ?? null,
    label: option.label,
    logoKey: option.logoKey ?? null,
    configPath: option.configPath ?? null,
    payloadPreview: option.payloadPreview,
    spec: option.spec,
    env: option.env,
  };
}
