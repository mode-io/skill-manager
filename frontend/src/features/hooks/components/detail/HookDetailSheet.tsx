import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Trash2, X } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { DetailBindingIdentity } from "../../../../components/detail/DetailBindingIdentity";
import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { DetailSection } from "../../../../components/detail/DetailSection";
import { ErrorBanner } from "../../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { useHookDetailQuery } from "../../api/management-queries";
import { useHooksCopy } from "../../i18n";
import { isHooksHarnessAddressable } from "../../model/selectors";

interface HookDetailSheetProps {
  id: string | null;
  columns: any[];
  pendingPerHarness: ReadonlySet<string>;
  isServerPending: boolean;
  isUninstalling: boolean;
  onClose: () => void;
  onEnableHarness: (harness: string) => void;
  onDisableHarness: (harness: string) => void;
  onResolveConfig: (args: {
    sourceKind: "managed" | "harness";
    observedHarness?: string | null;
    harnesses?: string[];
  }) => Promise<void>;
  onUninstall: () => void;
}

export function HookDetailSheet({
  id,
  columns,
  pendingPerHarness,
  isServerPending,
  isUninstalling,
  onClose,
  onEnableHarness,
  onDisableHarness,
  onResolveConfig,
  onUninstall,
}: HookDetailSheetProps) {
  const headingId = useId();
  const copy = useHooksCopy();
  const detailQuery = useHookDetailQuery(id);
  const [resolvePending, setResolvePending] = useState(false);
  const [resolveError, setResolveError] = useState("");

  if (!id) return null;

  const detail = detailQuery.data ?? null;
  const spec = detail?.spec ?? null;
  const displayName = detail?.displayName ?? id;
  const errorMessage = detailQuery.error instanceof Error ? detailQuery.error.message : "";

  async function handleResolve(sourceKind: "managed" | "harness", observedHarness: string): Promise<void> {
    setResolveError("");
    setResolvePending(true);
    try {
      await onResolveConfig({
        sourceKind,
        observedHarness,
        harnesses: [observedHarness],
      });
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : "Reconciliation failed");
    } finally {
      setResolvePending(false);
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="detail-sheet hook-detail-modal" aria-describedby="hook-detail-desc">
          <div id="hook-detail-desc" className="u-visually-hidden">
            Hook detail panel showing hook specs and enabled status across harnesses.
          </div>
          
          <DetailHeader
            title={<h2 id={headingId}>{displayName}</h2>}
            closeLabel={copy.detail.close}
            onClose={onClose}
          />

          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
          {resolveError ? <ErrorBanner message={resolveError} onDismiss={() => setResolveError("")} /> : null}

          {detailQuery.isPending ? (
            <div className="panel-state">
              <LoadingSpinner label={copy.detail.loading} />
            </div>
          ) : detail ? (
            <div className="detail-sheet__body">
              <DetailSection heading={copy.detail.about}>
                <dl className="detail-sheet__description-list">
                  {spec?.description ? (
                    <div className="description-list-item description-list-item--full">
                      <dt className="description-list-item__term">Description</dt>
                      <dd className="description-list-item__definition">{spec.description}</dd>
                    </div>
                  ) : null}
                  <div className="description-list-item">
                    <dt className="description-list-item__term">{copy.detail.event}</dt>
                    <dd className="description-list-item__definition">{spec?.event}</dd>
                  </div>
                  {spec?.match ? (
                    <div className="description-list-item">
                      <dt className="description-list-item__term">{copy.detail.match}</dt>
                      <dd className="description-list-item__definition">{spec.match}</dd>
                    </div>
                  ) : null}
                  {spec?.timeout ? (
                    <div className="description-list-item">
                      <dt className="description-list-item__term">{copy.detail.timeout}</dt>
                      <dd className="description-list-item__definition">{spec.timeout}s</dd>
                    </div>
                  ) : null}
                  <div className="description-list-item description-list-item--full">
                    <dt className="description-list-item__term">{copy.detail.command}</dt>
                    <dd className="description-list-item__definition">
                      <code>{spec?.command}</code>
                    </dd>
                  </div>
                </dl>
              </DetailSection>

              <DetailSection heading={copy.detail.bindings}>
                <div className="detail-sheet__bindings">
                  {columns.map((column) => {
                    const binding = detail.sightings.find((s) => s.harness === column.harness);
                    const state = binding?.state ?? "missing";
                    const pending = pendingPerHarness.has(column.harness) || isServerPending;
                    const canWriteConfig = isHooksHarnessAddressable(column);

                    const stateLabel = () => {
                      if (state === "managed") return "Enabled";
                      if (state === "drifted") return "Different config";
                      if (state === "unmanaged") return "Found in harness";
                      return "Disabled";
                    };

                    const stateTone = () => {
                      if (state === "managed") return "enabled";
                      if (state === "drifted" || state === "unmanaged") return "warning";
                      return "disabled";
                    };

                    return (
                      <div
                        key={column.harness}
                        className="detail-sheet__binding-row"
                        data-state={state}
                        data-pending={pending || undefined}
                      >
                        <DetailBindingIdentity
                          harness={column.harness}
                          label={column.label}
                          logoKey={column.logoKey}
                          statusLabel={stateLabel()}
                          tone={stateTone()}
                          visibleStatus={state === "drifted" ? "Different config" : null}
                          detail={state === "drifted" ? binding?.driftDetail : null}
                        />
                        <div className="detail-sheet__binding-actions">
                          {state === "missing" ? (
                            <button
                              type="button"
                              className={detail.canEnable && canWriteConfig ? "action-pill action-pill--accent" : "action-pill"}
                              onClick={() => {
                                if (detail.canEnable && canWriteConfig) onEnableHarness(column.harness);
                              }}
                              disabled={pending || !detail.canEnable || !canWriteConfig}
                            >
                              {pending ? <Loader2 size={12} className="card-action-spinner" aria-hidden="true" /> : null}
                              {detail.canEnable && canWriteConfig ? "Enable" : "Unavailable"}
                            </button>
                          ) : null}

                          {state === "managed" ? (
                            <button
                              type="button"
                              className="action-pill action-pill--danger"
                              onClick={() => onDisableHarness(column.harness)}
                              disabled={pending}
                            >
                              {pending ? <Loader2 size={12} className="card-action-spinner" aria-hidden="true" /> : null}
                              Disable
                            </button>
                          ) : null}

                          {state === "drifted" ? (
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button
                                type="button"
                                className="action-pill action-pill--accent"
                                onClick={() => handleResolve("managed", column.harness)}
                                disabled={pending || resolvePending}
                              >
                                Use central spec
                              </button>
                              <button
                                type="button"
                                className="action-pill"
                                onClick={() => handleResolve("harness", column.harness)}
                                disabled={pending || resolvePending}
                              >
                                Adopt harness spec
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DetailSection>

              <div className="detail-sheet__footer-actions">
                <button
                  type="button"
                  className="action-pill action-pill--danger-outline"
                  onClick={onUninstall}
                  disabled={isUninstalling || isServerPending}
                >
                  <Trash2 size={14} className="action-pill__icon" />
                  {copy.detail.uninstall}
                </button>
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
