import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { disableSkill, enableSkill, fetchSkillDetail, manageSkill, updateSkill } from "../api/client";
import type { SkillDetail } from "../api/types";
import { ErrorBanner } from "./ErrorBanner";
import { LoadingSpinner } from "./LoadingSpinner";
import { StatusBadge } from "./ui/StatusBadge";
import { Switch } from "./ui/Switch";
import { passiveHarnessStateBadge, skillStatusTone } from "./ui/statusMappings";

interface SkillDetailDrawerProps {
  skillRef: string | null;
  refreshToken: number;
  onClose: () => void;
  onDataChanged: () => void;
}

export function SkillDetailDrawer({
  skillRef,
  refreshToken,
  onClose,
  onDataChanged,
}: SkillDetailDrawerProps): JSX.Element | null {
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    if (!skillRef) {
      setDetail(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setErrorMessage("");
    void fetchSkillDetail(skillRef)
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload);
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
  }, [skillRef, refreshToken]);

  if (!skillRef) {
    return null;
  }

  async function runAction(
    actionKey: string,
    task: () => Promise<unknown>,
  ): Promise<void> {
    try {
      setBusyAction(actionKey);
      await task();
      onDataChanged();
      const payload = await fetchSkillDetail(skillRef);
      setDetail(payload);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete the action.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <button type="button" className="drawer-backdrop" aria-label="Close skill details" onClick={onClose} />
      <aside className="drawer drawer--detail" aria-label="Skill details drawer">
        <div className="drawer__header">
          <div>
            <p className="drawer__eyebrow">Skill details</p>
            <h2>{detail?.name ?? "Loading..."}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close skill details">
            <X size={18} />
          </button>
        </div>

        {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage("")} />}

        {status === "loading" && (
          <div className="panel-state">
            <LoadingSpinner label="Loading skill details" />
          </div>
        )}

        {status === "ready" && detail && (
          <div className="drawer__body">
            <section className="panel-section">
              <div className="section-heading">
                <h3>Status</h3>
              </div>
              <StatusBadge label={detail.displayStatus} tone={skillStatusTone(detail.displayStatus)} />
              <p className="detail-copy">{detail.statusMessage}</p>
              {detail.attentionMessage ? <p className="detail-alert">{detail.attentionMessage}</p> : null}
              <dl className="definition-grid">
                <div>
                  <dt>Source</dt>
                  <dd>{detail.source.label}</dd>
                </div>
                <div>
                  <dt>Locator</dt>
                  <dd>{detail.source.locator}</dd>
                </div>
              </dl>
            </section>

            <section className="panel-section">
              <div className="section-heading">
                <h3>Actions</h3>
              </div>
              <div className="drawer__actions">
                {detail.actions.canManage ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyAction !== null}
                    onClick={() => void runAction("manage", () => manageSkill(detail.skillRef))}
                  >
                    {busyAction === "manage" ? <LoadingSpinner size="sm" label="Managing skill" /> : null}
                    Bring under management
                  </button>
                ) : null}
                {detail.actions.canUpdate ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busyAction !== null || detail.actions.updateAvailable !== true}
                    onClick={() => void runAction("update", () => updateSkill(detail.skillRef))}
                  >
                    {busyAction === "update" ? <LoadingSpinner size="sm" label="Updating skill" /> : null}
                    {detail.actions.updateAvailable ? "Update from source" : "No update available"}
                  </button>
                ) : null}
              </div>
              {detail.actions.canUpdate && detail.actions.updateAvailable === null ? (
                <p className="muted-text">Update availability could not be checked right now.</p>
              ) : null}
            </section>

            <section className="panel-section">
              <div className="section-heading">
                <h3>Tool coverage</h3>
              </div>
              <div className="detail-harness-list">
                {detail.harnesses.map((harness) => (
                  <div key={harness.harness} className="detail-harness-row">
                    <div>
                      <strong>{harness.label}</strong>
                      <p>{harness.paths.length ? harness.paths.join(", ") : "Not present"}</p>
                    </div>
                    <div className="detail-harness-row__control">
                      {detail.actions.canToggle && (harness.state === "enabled" || harness.state === "disabled") ? (
                        <>
                          <Switch
                            checked={harness.state === "enabled"}
                            disabled={busyAction !== null}
                            ariaLabel={`${harness.state === "enabled" ? "Disable" : "Enable"} ${detail.name} for ${harness.label}`}
                            onCheckedChange={() => void runAction(
                              `toggle:${harness.harness}`,
                              () => harness.state === "enabled"
                                ? disableSkill(detail.skillRef, harness.harness)
                                : enableSkill(detail.skillRef, harness.harness),
                            )}
                          />
                          {busyAction === `toggle:${harness.harness}` ? <LoadingSpinner size="sm" label={`Updating ${harness.label}`} /> : null}
                        </>
                      ) : passiveHarnessStateBadge(harness.state) ? (
                        <StatusBadge
                          label={passiveHarnessStateBadge(harness.state)!.label}
                          tone={passiveHarnessStateBadge(harness.state)!.tone}
                        />
                      ) : (
                        <span className="detail-harness-row__empty">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel-section">
              <div className="section-heading">
                <h3>Description</h3>
              </div>
              <p className="detail-copy">{detail.description || "No description provided."}</p>
            </section>

            <details className="details-block">
              <summary>Advanced details</summary>
              <dl className="definition-grid">
                <div>
                  <dt>Package directory</dt>
                  <dd>{detail.advanced.packageDir ?? "N/A"}</dd>
                </div>
                <div>
                  <dt>Current revision</dt>
                  <dd>{detail.advanced.currentRevision ?? "N/A"}</dd>
                </div>
                <div>
                  <dt>Recorded revision</dt>
                  <dd>{detail.advanced.recordedRevision ?? "N/A"}</dd>
                </div>
                <div>
                  <dt>Package path</dt>
                  <dd>{detail.advanced.packagePath ?? "N/A"}</dd>
                </div>
              </dl>
              <div className="location-list">
                {detail.locations.map((location, index) => (
                  <article key={`${location.kind}:${location.path ?? index}`} className="location-row">
                    <strong>{location.label}</strong>
                    <p>{location.path ?? location.detail ?? location.sourceLocator}</p>
                  </article>
                ))}
              </div>
            </details>
          </div>
        )}
      </aside>
    </>
  );
}
