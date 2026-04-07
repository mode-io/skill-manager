import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Settings, X } from "lucide-react";

import { useManageAllFromSettingsMutation, useSettingsQuery } from "../features/settings/queries";
import { ErrorBanner } from "./ErrorBanner";
import { LoadingSpinner } from "./LoadingSpinner";

export function SettingsPopover() {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const settingsQuery = useSettingsQuery(open);
  const manageAllMutation = useManageAllFromSettingsMutation();
  const data = settingsQuery.data ?? null;
  const status: "idle" | "loading" | "ready" | "error" = settingsQuery.isPending
    ? "loading"
    : data
      ? "ready"
      : settingsQuery.error
        ? "error"
        : "idle";
  const busy = manageAllMutation.isPending;

  async function handleManageAll(): Promise<void> {
    try {
      await manageAllMutation.mutateAsync();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to manage all skills.");
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="icon-button settings-popover__trigger"
          aria-label="Open settings"
          aria-expanded={open}
        >
          <Settings size={18} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={12}
          collisionPadding={16}
          className="settings-popover__content ui-scrollbar"
        >
          <div className="settings-popover__header">
            <div>
              <h2>Settings</h2>
              <p className="settings-popover__copy">Environment diagnostics and bulk maintenance.</p>
            </div>
            <Popover.Close asChild>
              <button type="button" className="icon-button" aria-label="Close settings">
                <X size={18} />
              </button>
            </Popover.Close>
          </div>

          {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage("")} />}

          <div className="settings-popover__actions">
            <button type="button" className="btn btn-secondary" onClick={() => void settingsQuery.refetch()}>
              Refresh data
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleManageAll()}
              disabled={busy || !data?.bulkActions.canManageAll}
            >
              {busy ? <LoadingSpinner size="sm" label="Managing skills" /> : null}
              Bring all eligible skills under management
            </button>
          </div>

          {status === "loading" ? (
            <div className="settings-popover__state">
              <LoadingSpinner label="Loading settings" />
            </div>
          ) : null}

          {status === "ready" && data ? (
            <div className="settings-popover__body">
              <section className="settings-panel__section">
                <div className="settings-panel__section-heading">
                  <h3>Tools</h3>
                  <span>{data.harnesses.length}</span>
                </div>
                <div className="settings-list">
                  {data.harnesses.map((harness) => (
                    <article key={harness.harness} className="settings-item">
                      <div>
                        <h4>{harness.label}</h4>
                        <p>{harness.detected ? "Detected on this computer" : "Not detected"}</p>
                      </div>
                      <div className="settings-item__meta">
                        <span>{harness.manageable ? "Manageable" : "Read-only"}</span>
                        <span>{harness.builtinSupport ? "Built-ins supported" : "No built-ins"}</span>
                      </div>
                      <details className="settings-item__details">
                        <summary>Diagnostics</summary>
                        <dl className="definition-grid">
                          <div>
                            <dt>Discovery mode</dt>
                            <dd>{harness.diagnostics.discoveryMode}</dd>
                          </div>
                          <div>
                            <dt>Issues</dt>
                            <dd>{harness.issues.length ? harness.issues.join("; ") : "None"}</dd>
                          </div>
                          <div>
                            <dt>Detection details</dt>
                            <dd>
                              {harness.diagnostics.detectionDetails.length
                                ? harness.diagnostics.detectionDetails.join("; ")
                                : "None"}
                            </dd>
                          </div>
                        </dl>
                      </details>
                    </article>
                  ))}
                </div>
              </section>

              <section className="settings-panel__section">
                <div className="settings-panel__section-heading">
                  <h3>Store diagnostics</h3>
                </div>
                {data.storeIssues.length ? (
                  <ul className="settings-issues">
                    {data.storeIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted-text">No shared-store issues detected.</p>
                )}
              </section>
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
