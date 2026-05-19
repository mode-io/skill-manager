import { useId } from "react";
import { Loader2, Plus } from "lucide-react";

import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { DetailSection } from "../../../../components/detail/DetailSection";
import { ErrorBanner } from "../../../../components/ErrorBanner";
import { HarnessAvatar } from "../../../../components/harness/HarnessAvatar";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { UiTooltip } from "../../../../components/ui/UiTooltip";
import type { McpIdentityGroupDto, McpIdentitySightingDto } from "../../api/management-types";
import { useMcpCopy } from "../../i18n";
import { McpDetailShell } from "./McpDetailShell";
import { McpMarketplaceLinkChip } from "./McpMarketplaceLinkChip";

interface McpNeedsReviewDetailViewProps {
  group: McpIdentityGroupDto | null;
  isLoading: boolean;
  errorMessage: string;
  pending: boolean;
  onClose: () => void;
  onAdopt: () => void;
  onChooseConfigToAdopt: () => void;
}

export function McpNeedsReviewDetailView({
  group,
  isLoading,
  errorMessage,
  pending,
  onClose,
  onAdopt,
  onChooseConfigToAdopt,
}: McpNeedsReviewDetailViewProps) {
  const headingId = useId();
  const copy = useMcpCopy();

  if (isLoading || !group) {
    return (
      <McpDetailShell
        chrome={(
          <DetailHeader
            title={<h2 id={headingId}>{copy.detail.loading}</h2>}
            closeLabel={copy.detail.closeShort}
            onClose={onClose}
          />
        )}
        body={(
          <div className="panel-state">
            {errorMessage ? (
              <ErrorBanner message={errorMessage} />
            ) : (
              <LoadingSpinner label={copy.detail.review.loadingServer} />
            )}
          </div>
        )}
        bodyAriaLabelledBy={headingId}
      />
    );
  }

  const subtitle = group.identical
    ? copy.detail.review.identicalAcross(group.sightings.length)
    : copy.detail.review.differentIn(group.sightings.length);

  return (
    <McpDetailShell
      chrome={(
        <DetailHeader
          title={<h2 id={headingId}>{group.name}</h2>}
          meta={
            <div className="detail-sheet__meta">
              <div className="chip-cluster">
                <span className={`chip ${group.identical ? "chip--verified" : "chip--warning"}`}>
                  {subtitle}
                </span>
                {group.marketplaceLink ? (
                  <McpMarketplaceLinkChip link={group.marketplaceLink} />
                ) : null}
              </div>
            </div>
          }
          closeLabel={copy.detail.closeShort}
          onClose={onClose}
        />
      )}
      body={(
        <>
          {group.marketplaceLink?.description ? (
            <DetailSection heading={copy.detail.review.marketplaceMetadata}>
              <p className="mcp-detail__about">{group.marketplaceLink.description}</p>
            </DetailSection>
          ) : null}

          <DetailSection heading={copy.detail.review.sightings}>
            <div className="mcp-needs-review-detail__sightings">
              {group.sightings.map((sighting) => (
                <McpNeedsReviewSightingCard key={sighting.harness} sighting={sighting} />
              ))}
            </div>
          </DetailSection>

          {group.identical && group.canonicalSpec ? (
            <DetailSection heading={copy.detail.review.configToAdopt}>
              <pre className="mcp-needs-review-row__preview ui-scrollbar">
                {JSON.stringify(group.canonicalSpec, null, 2)}
              </pre>
            </DetailSection>
          ) : null}
        </>
      )}
      footer={(
        group.identical ? (
          <UiTooltip content={copy.detail.review.addTooltip}>
            <button
              type="button"
              className="action-pill"
              onClick={onAdopt}
              disabled={pending}
            >
              {pending ? (
                <Loader2 size={12} className="card-action-spinner" aria-hidden="true" />
              ) : (
                <Plus size={12} aria-hidden="true" />
              )}
              {copy.detail.review.adopt}
            </button>
          </UiTooltip>
        ) : (
          <UiTooltip content={copy.detail.review.chooseTooltip}>
            <button
              type="button"
              className="action-pill"
              onClick={onChooseConfigToAdopt}
              disabled={pending}
            >
              <Plus size={12} aria-hidden="true" />
              {copy.detail.review.chooseConfigToAdopt}
            </button>
          </UiTooltip>
        )
      )}
      bodyAriaLabelledBy={headingId}
    />
  );
}

function McpNeedsReviewSightingCard({ sighting }: { sighting: McpIdentitySightingDto }) {
  return (
    <div className="mcp-needs-review-detail__sighting">
      <div className="mcp-needs-review-detail__sighting-head">
        <HarnessAvatar
          harness={sighting.harness}
          label={sighting.label}
          logoKey={sighting.logoKey}
          className="mcp-needs-review-detail__sighting-logo"
        />
        <strong className="mcp-needs-review-detail__sighting-label">{sighting.label}</strong>
        {sighting.configPath ? (
          <code className="mcp-needs-review-detail__sighting-path">{sighting.configPath}</code>
        ) : null}
      </div>
      <pre className="mcp-needs-review-row__preview ui-scrollbar">
        {JSON.stringify(sighting.payloadPreview, null, 2)}
      </pre>
    </div>
  );
}
