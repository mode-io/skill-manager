import { useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { DetailDisclosure } from "../../../../components/detail/DetailDisclosure";
import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { DetailSourceLinks } from "../../../../components/detail/DetailSourceLinks";
import { ErrorBanner } from "../../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import type { StructuralSkillAction } from "../../model/pending";
import type { HarnessCell, SkillDetail } from "../../model/types";
import { skillStatusTone } from "../../model/status-mappings";
import { SkillDetailActionBar } from "./SkillDetailActionBar";
import { SkillDetailHarnessMatrix } from "./SkillDetailHarnessMatrix";

interface SkillDetailContentProps {
  detail: SkillDetail;
  actionErrorMessage: string;
  queryErrorMessage: string;
  pendingToggleHarnesses: ReadonlySet<string>;
  pendingStructuralAction: StructuralSkillAction | null;
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
  actionErrorMessage,
  queryErrorMessage,
  pendingToggleHarnesses,
  pendingStructuralAction,
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
  const hasPendingHarnessToggles = pendingToggleHarnesses.size > 0;
  const structuralLocked = pendingStructuralAction !== null;

  return (
    <>
      <div className="skill-detail__chrome">
        <DetailHeader
          title={<h2 id={headingId}>{detail.name}</h2>}
          titleAction={
            detail.actions.canManage ? (
              <button
                type="button"
                className="btn btn-primary skill-detail__manage-button"
                disabled={structuralLocked || hasPendingHarnessToggles}
                onClick={onManage}
              >
                {pendingStructuralAction === "manage" ? <LoadingSpinner size="sm" label="Managing skill" /> : null}
                Bring Under Management
              </button>
            ) : undefined
          }
          meta={
            detail.sourceLinks ? <DetailSourceLinks sourceLinks={detail.sourceLinks} /> : undefined
          }
          closeLabel="Close skill details"
          onClose={onClose}
        />

        <SkillDetailHarnessMatrix
          skillName={detail.name}
          cells={detail.harnessCells}
          pendingToggleHarnesses={pendingToggleHarnesses}
          pendingStructuralAction={pendingStructuralAction}
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
          pendingStructuralAction={pendingStructuralAction}
          hasPendingHarnessToggles={hasPendingHarnessToggles}
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

        <DetailDisclosure
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
        </DetailDisclosure>

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
