import { lazy, Suspense, useId } from "react";

import { DetailDisclosure } from "../../../../components/detail/DetailDisclosure";
import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { DetailNote } from "../../../../components/detail/DetailNote";
import { DetailSection } from "../../../../components/detail/DetailSection";
import { DetailSourceLinks, type DetailSourceLink } from "../../../../components/detail/DetailSourceLinks";
import { ErrorBanner } from "../../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { skillStatusConcept } from "../../../../lib/product-language";
import { useSkillsCopy, type SkillsCopy } from "../../i18n";
import type { StructuralSkillAction } from "../../model/pending";
import type { HarnessCell, SkillDetail, SkillSourceLinks } from "../../model/types";
import { SkillDetailHarnessMatrix } from "./SkillDetailHarnessMatrix";
import { SkillDetailRemoveAction } from "./SkillDetailRemoveAction";
import { SkillDetailUpdateControl } from "./SkillDetailUpdateControl";
import { SkillDetailShell } from "./SkillDetailShell";

const MarkdownDocument = lazy(() => import("../../../../components/MarkdownDocument"));

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
  onRequestRemove: () => void;
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
  onRequestRemove,
  onRequestDelete,
}: SkillDetailContentProps) {
  const headingId = useId();
  const copy = useSkillsCopy();
  const showSkillManagerStoreNote =
    skillStatusConcept(detail.displayStatus) === "inUse" &&
    detail.locations.some((location) => location.kind === "shared");
  const hasPendingHarnessToggles = pendingToggleHarnesses.size > 0;
  const structuralLocked = pendingStructuralAction !== null;
  const controlsDisabled = structuralLocked || hasPendingHarnessToggles;

  const errorMessage = actionErrorMessage || queryErrorMessage;
  const dismissError = actionErrorMessage ? onDismissActionError : undefined;

  const showUpdateControl = detail.actions.updateStatus !== null && detail.actions.updateStatus !== "local_changes_detected";
  const showFooter = computeShowFooter(detail);
  const showHarnessSection = detail.harnessCells.length > 0;

  return (
    <SkillDetailShell
      chrome={(
        <div className="skill-detail__chrome">
          <DetailHeader
            title={<h2 id={headingId}>{detail.name}</h2>}
            meta={detail.sourceLinks ? (
              <div className="detail-sheet__meta">
                <DetailSourceLinks
                  ariaLabel={copy.detail.sourceLinksAria(detail.sourceLinks.repoLabel)}
                  links={skillSourceLinks(detail.sourceLinks, copy)}
                />
              </div>
            ) : undefined}
            closeLabel={copy.detail.close}
            onClose={onClose}
          />
          {errorMessage ? (
            <ErrorBanner message={errorMessage} onDismiss={dismissError} />
          ) : null}
        </div>
      )}
      body={(
        <>
        <DetailSection heading={copy.detail.about}>
          <p className="skill-detail__copy">
            {detail.description || copy.detail.noDescription}
          </p>
          {detail.attentionMessage ? (
            <DetailNote>{detail.attentionMessage}</DetailNote>
          ) : null}
        </DetailSection>

        <DetailDisclosure
          title="SKILL.md"
          defaultOpen={false}
          className="skill-detail__disclosure skill-detail__disclosure--document"
        >
          <div className="skill-detail__document-surface">
            {detail.documentMarkdown ? (
              <Suspense fallback={<LoadingSpinner size="sm" label={copy.detail.loadingDocument} />}>
                <MarkdownDocument markdown={detail.documentMarkdown} />
              </Suspense>
            ) : (
              <p className="skill-detail__copy">
                {copy.detail.noDocument}
              </p>
            )}
          </div>
        </DetailDisclosure>

        {showHarnessSection ? (
          <DetailSection heading={copy.detail.harnesses}>
            <SkillDetailHarnessMatrix
              skillName={detail.name}
              cells={detail.harnessCells}
              pendingToggleHarnesses={pendingToggleHarnesses}
              pendingStructuralAction={pendingStructuralAction}
              onToggleCell={onToggleHarness}
            />
          </DetailSection>
        ) : null}

        {detail.locations.length > 0 ? (
          <DetailSection heading={copy.detail.locations}>
            {showSkillManagerStoreNote ? (
              <p className="skill-detail__context-note">
                {copy.detail.storeNote}
              </p>
            ) : null}
            <div className="skill-detail__locations">
              {detail.locations.map((location, index) => {
                const descriptor = locationDescriptor(detail, location, copy);
                return (
                  <article
                    key={`${location.kind}:${location.path ?? index}`}
                    className="skill-detail__location"
                  >
                    <div className="skill-detail__location-header">
                      <strong>{location.label}</strong>
                      {descriptor ? (
                        <span className="skill-detail__location-note">{descriptor}</span>
                      ) : null}
                    </div>
                    <p className="skill-detail__location-path">
                      {location.path ?? location.detail ?? location.sourceLocator}
                    </p>
                  </article>
                );
              })}
            </div>
          </DetailSection>
        ) : null}
        </>
      )}
      footer={showFooter ? (
        <>
          {detail.actions.canManage ? (
            <button
              type="button"
              className="action-pill action-pill--md action-pill--accent"
              disabled={controlsDisabled}
              onClick={onManage}
            >
              {pendingStructuralAction === "manage" ? (
                <LoadingSpinner size="sm" label={copy.detail.managingSkill} />
              ) : null}
              {copy.detail.addToSkillManager}
            </button>
          ) : null}
          {showUpdateControl ? (
            <SkillDetailUpdateControl
              updateStatus={detail.actions.updateStatus!}
              pending={pendingStructuralAction === "update"}
              disabled={controlsDisabled}
              onUpdate={onUpdate}
            />
          ) : null}
          {detail.actions.stopManagingStatus !== null ? (
            <SkillDetailRemoveAction
              status={detail.actions.stopManagingStatus}
              disabled={controlsDisabled}
              onRequestRemove={onRequestRemove}
            />
          ) : null}
          {detail.actions.canDelete ? (
            <button
              type="button"
              className="action-pill action-pill--md action-pill--danger"
              disabled={controlsDisabled}
              onClick={onRequestDelete}
            >
              {pendingStructuralAction === "delete" ? (
                <LoadingSpinner size="sm" label={copy.confirm.deletingSkill} />
              ) : null}
              {copy.detail.deleteSkill}
            </button>
          ) : null}
        </>
      ) : undefined}
      bodyAriaLabelledBy={headingId}
    />
  );
}

function skillSourceLinks(sourceLinks: SkillSourceLinks, copy: SkillsCopy): DetailSourceLink[] {
  const links: DetailSourceLink[] = [
    {
      href: sourceLinks.repoUrl,
      label: sourceLinks.repoLabel,
      kind: "repo",
    },
  ];
  if (sourceLinks.folderUrl) {
    links.push({
      href: sourceLinks.folderUrl,
      label: copy.detail.openSkillFolder,
      kind: "folder",
    });
  }
  return links;
}

function computeShowFooter(detail: SkillDetail): boolean {
  return (
    detail.actions.canManage ||
    (detail.actions.updateStatus !== null && detail.actions.updateStatus !== "local_changes_detected") ||
    detail.actions.stopManagingStatus !== null ||
    detail.actions.canDelete
  );
}

function locationDescriptor(
  detail: SkillDetail,
  location: SkillDetail["locations"][number],
  copy: SkillsCopy,
): string | null {
  if (skillStatusConcept(detail.displayStatus) !== "inUse") {
    return null;
  }
  if (location.kind === "shared") {
    return copy.detail.canonicalPhysicalPackage;
  }
  if (location.kind === "harness") {
    return copy.detail.symlinkToStore;
  }
  return null;
}
