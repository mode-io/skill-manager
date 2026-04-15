import type { MarketplaceDetailDto, MarketplaceItemDto } from "./api/types";

function repoOwner(repoLabel: string): string {
  return repoLabel.split("/", 1)[0] || repoLabel;
}

function skillIdFromItemId(itemId: string): string {
  const [, skillId = "mode-switch"] = itemId.match(/^[^:]+:[^:]+:(.+)$/) ?? [];
  return skillId;
}

export function marketplaceRepoImageUrl(repoLabel: string): string {
  return `https://github.com/${repoOwner(repoLabel)}.png?size=96`;
}

export function createMarketplaceItem(overrides: Partial<MarketplaceItemDto> = {}): MarketplaceItemDto {
  const repoLabel = overrides.repoLabel ?? "mode-io/skills";
  const id = overrides.id ?? `skillssh:${repoLabel}:mode-switch`;
  const skillId = skillIdFromItemId(id);

  return {
    id,
    name: overrides.name ?? "Mode Switch",
    description: overrides.description ?? "Switch between supported skill execution modes.",
    installs: overrides.installs ?? 128,
    stars: overrides.stars ?? 512,
    repoLabel,
    repoUrl: overrides.repoUrl ?? `https://github.com/${repoLabel}`,
    repoImageUrl: overrides.repoImageUrl ?? marketplaceRepoImageUrl(repoLabel),
    skillsDetailUrl: overrides.skillsDetailUrl ?? `https://skills.sh/${repoLabel}/${skillId}`,
    installToken: overrides.installToken ?? `token-${skillId}`,
    installation: overrides.installation ?? {
      status: "installable",
      installedSkillRef: null,
    },
  };
}

export function createMarketplaceDetail(overrides: Partial<MarketplaceDetailDto> = {}): MarketplaceDetailDto {
  const item = createMarketplaceItem(overrides);

  return {
    id: item.id,
    name: item.name,
    description: item.description,
    installs: item.installs,
    stars: item.stars,
    repoLabel: item.repoLabel,
    repoImageUrl: item.repoImageUrl,
    sourceLinks: overrides.sourceLinks ?? {
      repoLabel: item.repoLabel,
      repoUrl: item.repoUrl,
      folderUrl: null,
      skillsDetailUrl: item.skillsDetailUrl,
    },
    installation: overrides.installation ?? item.installation,
    installToken: overrides.installToken ?? item.installToken,
  };
}
