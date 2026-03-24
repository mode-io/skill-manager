import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { fetchSettings, manageAllSkills } from "../api/client";
import type { SettingsData } from "../api/types";
import { ErrorBanner } from "./ErrorBanner";
import { LoadingSpinner } from "./LoadingSpinner";

interface SettingsDrawerProps {
  open: boolean;
  refreshToken: number;
  onClose: () => void;
  onDataChanged: () => void;
}

export function SettingsDrawer({
  open,
  refreshToken,
  onClose,
  onDataChanged,
}: SettingsDrawerProps): JSX.Element | null {
  const [data, setData] = useState<SettingsData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setErrorMessage("");
    void fetchSettings()
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setErrorMessage(error.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, refreshToken]);

  if (!open) {
    return null;
  }

  async function handleManageAll(): Promise<void> {
    try {
      setBusy(true);
      await manageAllSkills();
      onDataChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to manage all skills.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="drawer-backdrop" aria-label="Close settings" onClick={onClose} />
      <aside className="drawer" aria-label="Settings drawer">
        <div className="drawer__header">
          <div>
            <p className="drawer__eyebrow">Operations</p>
            <h2>Settings</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage("")} />}

        <div className="drawer__actions">
          <button type="button" className="btn btn-secondary" onClick={onDataChanged}>
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

        {status === "loading" && (
          <div className="panel-state">
            <LoadingSpinner label="Loading settings" />
          </div>
        )}

        {status === "ready" && data && (
          <div className="drawer__body">
            <section className="panel-section">
              <div className="section-heading">
                <h3>Tools</h3>
                <span>{data.harnesses.length}</span>
              </div>
              <div className="settings-list">
                {data.harnesses.map((harness) => (
                  <article key={harness.harness} className="settings-row">
                    <div>
                      <h4>{harness.label}</h4>
                      <p>{harness.detected ? "Detected on this computer" : "Not detected"}</p>
                    </div>
                    <div className="settings-row__meta">
                      <span>{harness.manageable ? "Manageable" : "Read-only"}</span>
                      <span>{harness.builtinSupport ? "Built-ins supported" : "No built-ins"}</span>
                    </div>
                    <details className="details-block">
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

            <section className="panel-section">
              <div className="section-heading">
                <h3>Store diagnostics</h3>
              </div>
              {data.storeIssues.length ? (
                <ul className="issue-list">
                  {data.storeIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted-text">No shared-store issues detected.</p>
              )}
            </section>
          </div>
        )}
      </aside>
    </>
  );
}
