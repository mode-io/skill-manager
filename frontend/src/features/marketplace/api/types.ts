export type MarketplaceInstallationStatus = "installable" | "installed";

export interface MarketplaceInstallationState {
  status: MarketplaceInstallationStatus;
  installedSkillRef: string | null;
}

export interface MarketplaceItemDto {
  id: string;
  name: string;
  description: string;
  installs: number;
  stars: number | null;
  repoLabel: string;
  repoUrl: string;
  repoImageUrl: string | null;
  skillsDetailUrl: string;
  installToken: string;
  installation: MarketplaceInstallationState;
}

export interface MarketplacePageResultDto {
  items: MarketplaceItemDto[];
  nextOffset: number | null;
  hasMore: boolean;
}

export interface MarketplaceSourceLinks {
  repoLabel: string;
  repoUrl: string;
  folderUrl: string | null;
  skillsDetailUrl: string;
}

export interface MarketplaceDetailDto {
  id: string;
  name: string;
  description: string;
  installs: number;
  stars: number | null;
  repoLabel: string;
  repoImageUrl: string | null;
  sourceLinks: MarketplaceSourceLinks;
  installation: MarketplaceInstallationState;
  installToken: string;
}

export interface MarketplaceDocumentDto {
  status: "ready" | "unavailable";
  documentMarkdown: string | null;
}
