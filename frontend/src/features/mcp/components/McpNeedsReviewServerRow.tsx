import { NeedsReviewRow } from "../../../components/cards/NeedsReviewRow";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { getHarnessPresentation } from "../../../components/harness/harnessPresentation";
import type { McpIdentityGroupDto, McpIdentitySightingDto } from "../api/management-types";

interface McpNeedsReviewServerRowProps {
  group: McpIdentityGroupDto;
  pending: boolean;
  onOpenDetail: (name: string) => void;
  onAdoptIdentical: (name: string) => void;
  onChooseConfigToAdopt: (name: string) => void;
}

function harnessSummary(group: McpIdentityGroupDto): string {
  const n = group.sightings.length;
  return `Found in ${n} harness${n === 1 ? "" : "es"}`;
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
  const statusChip = group.identical ? (
    <span className="card-status-pill card-status-pill--success">Identical</span>
  ) : (
    <span className="card-status-pill card-status-pill--warning">Differs across harnesses</span>
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
      metaText={harnessSummary(group)}
      statusChip={
        <>
          {statusChip}
          {group.marketplaceLink ? (
            <span className="card-status-pill card-status-pill--accent">
              Match in marketplace
            </span>
          ) : null}
        </>
      }
      actionLabel={group.identical ? "Adopt" : "Choose config to adopt"}
      actionTitle={
        group.identical
          ? "Add this server to Skill Manager"
          : "Choose which config Skill Manager should keep"
      }
      pending={pending}
      onOpen={() => onOpenDetail(group.name)}
      onAction={() =>
        group.identical ? onAdoptIdentical(group.name) : onChooseConfigToAdopt(group.name)
      }
    />
  );
}
