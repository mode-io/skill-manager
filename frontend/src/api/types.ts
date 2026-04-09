export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  installs: number;
  stars: number | null;
  repoLabel: string;
  repoImageUrl: string | null;
  githubFolderUrl: string | null;
  skillsDetailUrl: string;
  installToken: string;
}

export interface MarketplacePageResult {
  items: MarketplaceItem[];
  nextOffset: number | null;
  hasMore: boolean;
}

export interface SettingsHarness {
  harness: string;
  label: string;
  detected: boolean;
  manageable: boolean;
  builtinSupport: boolean;
  issues: string[];
  diagnostics: {
    discoveryMode: string;
    detectionDetails: string[];
  };
}

export interface SettingsData {
  harnesses: SettingsHarness[];
  storeIssues: string[];
  bulkActions: {
    canManageAll: boolean;
  };
}

export interface BulkManageFailure {
  skillRef: string;
  name: string;
  error: string;
}
