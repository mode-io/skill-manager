import { useId } from "react";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { SkillDetail } from "../api/types";
import { SkillDetailDisclosure } from "./SkillDetailDisclosure";
import { ErrorBanner } from "./ErrorBanner";
import { LoadingSpinner } from "./LoadingSpinner";
import { StatusBadge } from "./ui/StatusBadge";
import { skillStatusTone } from "./ui/statusMappings";

interface SkillDetailContentProps {
  detail: SkillDetail;
  isRefreshing: boolean;
  actionErrorMessage: string;
  queryErrorMessage: string;
  busyAction: string | null;
  onClose: () => void;
  onDismissActionError: () => void;
  onManage: () => void;
  onUpdate: () => void;
}

export function SkillDetailContent({
  detail,
  isRefreshing,
  actionErrorMessage,
  queryErrorMessage,
  busyAction,
  onClose,
  onDismissActionError,
  onManage,
  onUpdate,
}: SkillDetailContentProps) {
  const headingId = useId();
  const showStatusBadge = detail.displayStatus !== "Managed";
  const showPrimaryActions = detail.actions.canManage || detail.actions.canUpdate;
  const showManagedStoreNote =
    (detail.displayStatus === "Managed" || detail.displayStatus === "Custom")
    && detail.locations.some((location) => location.kind === "shared");

  return (
    <>
      <div className="skill-detail__chrome">
        <div className="skill-detail__header">
          <div className="skill-detail__heading-block">
            <p className="skill-detail__eyebrow">Skill details</p>
            <h2 id={headingId}>{detail.name}</h2>
          </div>
          <div className="skill-detail__header-actions">
            {isRefreshing ? (
              <div className="skill-detail__refresh" aria-live="polite">
                <LoadingSpinner size="sm" label="Refreshing skill details" />
              </div>
            ) : null}
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close skill details">
              <X size={18} />
            </button>
          </div>
        </div>

        {actionErrorMessage ? (
          <ErrorBanner message={actionErrorMessage} onDismiss={onDismissActionError} />
        ) : null}
        {!actionErrorMessage && queryErrorMessage ? (
          <ErrorBanner message={queryErrorMessage} />
        ) : null}

        {showStatusBadge ? (
          <div className="skill-detail__badge-row">
            <StatusBadge label={detail.displayStatus} tone={skillStatusTone(detail.displayStatus)} />
          </div>
        ) : null}

        {showPrimaryActions ? (
          <div className="skill-detail__primary-actions">
            <div className="skill-detail__actions">
              {detail.actions.canManage ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyAction !== null}
                  onClick={onManage}
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
                  onClick={onUpdate}
                >
                  {busyAction === "update" ? <LoadingSpinner size="sm" label="Updating skill" /> : null}
                  {detail.actions.updateAvailable ? "Update from source" : "No update available"}
                </button>
              ) : null}
            </div>
            {detail.actions.canUpdate && detail.actions.updateAvailable === null ? (
              <p className="muted-text">Update availability could not be checked right now.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="skill-detail__body" aria-labelledby={headingId}>
        <section className="skill-detail__intro">
          <p className="skill-detail__copy">{detail.description || "No description provided."}</p>
          {detail.attentionMessage ? <p className="skill-detail__alert">{detail.attentionMessage}</p> : null}
        </section>

        <SkillDetailDisclosure
          title="SKILL.md"
          eyebrow="Primary document"
          defaultOpen
          className="skill-detail__disclosure skill-detail__disclosure--document"
        >
          <div className="skill-detail__document-surface">
            {detail.documentMarkdown ? (
              <div className="skill-detail__markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {detail.documentMarkdown}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="skill-detail__copy">No SKILL.md document is available for this entry.</p>
            )}
          </div>
        </SkillDetailDisclosure>

        {detail.locations.length > 0 ? (
          <section className="skill-detail__context">
            <div className="skill-detail__context-heading">
              <h3>Locations</h3>
            </div>
            {showManagedStoreNote ? (
              <p className="skill-detail__context-note">
                Shared Store is the canonical physical package. Tool locations are symlinks to it when enabled.
              </p>
            ) : null}
            <div className="skill-detail__locations">
              {detail.locations.map((location, index) => {
                const descriptor = locationDescriptor(detail, location);
                return (
                  <article key={`${location.kind}:${location.path ?? index}`} className="skill-detail__location">
                    <div className="skill-detail__location-header">
                      <strong>{location.label}</strong>
                      {descriptor ? <span className="skill-detail__location-note">{descriptor}</span> : null}
                    </div>
                    <p className="skill-detail__location-path">{location.path ?? location.detail ?? location.sourceLocator}</p>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <SkillDetailDisclosure
          title="Advanced details"
          eyebrow="Technical metadata"
          className="skill-detail__disclosure skill-detail__disclosure--advanced"
        >
          <dl className="definition-grid">
            <div>
              <dt>Source kind</dt>
              <dd>{detail.advanced.sourceKind}</dd>
            </div>
            <div>
              <dt>Source locator</dt>
              <dd>{detail.advanced.sourceLocator}</dd>
            </div>
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
        </SkillDetailDisclosure>
      </div>
    </>
  );
}

function locationDescriptor(detail: SkillDetail, location: SkillDetail["locations"][number]): string | null {
  if (detail.displayStatus !== "Managed" && detail.displayStatus !== "Custom") {
    return null;
  }
  if (location.kind === "shared") {
    return "Canonical physical package";
  }
  if (location.kind === "harness") {
    return "Symlink to Shared Store";
  }
  return null;
}
