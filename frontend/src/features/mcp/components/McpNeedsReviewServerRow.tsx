import { NeedsReviewRow } from "../../../components/cards/NeedsReviewRow";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { getHarnessPresentation } from "../../../components/harness/harnessPresentation";
import type { McpIdentityGroupDto, McpIdentitySightingDto } from "../api/management-types";
import { useMcpCopy } from "../i18n";

interface McpNeedsReviewServerRowProps {
  group: McpIdentityGroupDto;
  pending: boolean;
  onOpenDetail: (name: string) => void;
  onAdoptIdentical: (name: string) => void;
  onChooseConfigToAdopt: (name: string) => void;
}

function HarnessLogo({ sighting, zIndex }: { sighting: McpIdentitySightingDto; zIndex: number }) {
  const presentation = getHarnessPresentation(sighting.logoKey ?? sighting.harness);
  return (
    <UiTooltip content={sighting.label}>
      <span className="harness-stack__item" style={{ zIndex }}>
        {presentation ? (
          <img src={presentation.logoSrc} alt="" aria-hidden="true" />
        ) : (
          <span className="harness-stack__fallback">{sighting.label.slice(0, 1)}</span>
        )}
      </span>
    </UiTooltip>
  );
}

export function McpNeedsReviewServerRow({
  group,
  pending,
  onOpenDetail,
  onAdoptIdentical,
  onChooseConfigToAdopt,
}: McpNeedsReviewServerRowProps) {
  const copy = useMcpCopy();
  const statusChip = group.identical ? (
    <span className="card-status-pill card-status-pill--success">{copy.detail.review.identical}</span>
  ) : (
    <span className="card-status-pill card-status-pill--warning">
      {copy.detail.review.differsAcrossHarnesses}
    </span>
  );

  return (
    <NeedsReviewRow
      name={group.name}
      logos={
        <span className="harness-stack">
          {group.sightings.map((s, index) => (
            <HarnessLogo
              key={s.harness}
              sighting={s}
              zIndex={group.sightings.length - index}
            />
          ))}
        </span>
      }
      metaText={copy.detail.review.foundInHarnesses(group.sightings.length)}
      statusChip={
        <>
          {statusChip}
          {group.marketplaceLink ? (
            <span className="card-status-pill card-status-pill--accent">
              {copy.detail.review.marketplaceMatch}
            </span>
          ) : null}
        </>
      }
      actionLabel={group.identical ? copy.detail.review.adopt : copy.detail.review.chooseConfigToAdopt}
      actionTitle={
        group.identical
          ? copy.detail.review.addTooltip
          : copy.detail.review.chooseTooltip
      }
      pending={pending}
      onOpen={() => onOpenDetail(group.name)}
      onAction={() =>
        group.identical ? onAdoptIdentical(group.name) : onChooseConfigToAdopt(group.name)
      }
    />
  );
}
