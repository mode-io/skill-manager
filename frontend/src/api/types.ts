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
