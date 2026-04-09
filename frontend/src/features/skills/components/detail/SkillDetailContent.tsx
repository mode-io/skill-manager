import { useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ErrorBanner } from "../../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import type { HarnessCell, SkillDetail } from "../../model/types";
import { skillStatusTone } from "../../model/status-mappings";
import { SkillDetailDisclosure } from "./SkillDetailDisclosure";
import { SkillDetailActionBar } from "./SkillDetailActionBar";
import { SkillDetailHarnessMatrix } from "./SkillDetailHarnessMatrix";
import { SkillDetailHeader } from "./SkillDetailHeader";
import { SkillDetailSourceLinks } from "./SkillDetailSourceLinks";

interface SkillDetailContentProps {
  detail: SkillDetail;
  isRefreshing: boolean;
  actionErrorMessage: string;
  queryErrorMessage: string;
  busyAction: string | null;
  onClose: () => void;
  onDismissActionError: () => void;
  onManage: () => void;
  onToggleHarness: (cell: HarnessCell) => void;
  onUpdate: () => void;
  onRequestStopManaging: () => void;
  onRequestDelete: () => void;
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
  onToggleHarness,
  onUpdate,
  onRequestStopManaging,
  onRequestDelete,
}: SkillDetailContentProps) {
  const headingId = useId();
  const showStatusBadge = detail.displayStatus === "Custom" || detail.displayStatus === "Built-in";
  const showManagedStoreNote =
    (detail.displayStatus === "Managed" || detail.displayStatus === "Custom")
    && detail.locations.some((location) => location.kind === "shared");

  return (
    <>
      <div className="skill-detail__chrome">
        <SkillDetailHeader
          title={<h2 id={headingId}>{detail.name}</h2>}
          titleAction={
            detail.actions.canManage ? (
              <button
                type="button"
                className="btn btn-primary skill-detail__manage-button"
                disabled={busyAction !== null}
                onClick={onManage}
              >
                {busyAction === "manage" ? <LoadingSpinner size="sm" label="Managing skill" /> : null}
                Bring Under Management
              </button>
            ) : undefined
          }
          meta={
            detail.sourceLinks ? <SkillDetailSourceLinks sourceLinks={detail.sourceLinks} /> : undefined
          }
          utility={
            isRefreshing ? (
              <div className="skill-detail__refresh" aria-live="polite">
                <LoadingSpinner size="sm" label="Refreshing skill details" />
              </div>
            ) : undefined
          }
          onClose={onClose}
        />

        <SkillDetailHarnessMatrix
          skillName={detail.name}
          cells={detail.harnessCells}
          disabled={busyAction !== null}
          onToggleCell={onToggleHarness}
        />

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

        <SkillDetailActionBar
          actions={detail.actions}
          busyAction={busyAction}
          onUpdate={onUpdate}
          onRequestStopManaging={onRequestStopManaging}
          onRequestDelete={onRequestDelete}
        />
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
