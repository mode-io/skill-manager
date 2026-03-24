export interface HarnessSummary {
  harness: string;
  label: string;
  detected: boolean;
  manageable: boolean;
  builtinSupport: boolean;
  discoveryMode: string;
  detectionDetails: string[];
  issues: string[];
}

export interface HarnessBinding {
  harness: string;
  label: string;
  state: "enabled" | "disabled";
  scopes: string[];
}

export interface CatalogConflict {
  conflictType: string;
  message: string;
  revisions: string[];
  harnesses: string[];
}

export interface CatalogEntrySummary {
  skillRef: string;
  declaredName: string;
  description: string;
  ownership: "shared" | "unmanaged" | "builtin";
  sourceKind: string;
  sourceLocator: string;
  revision: string;
  harnesses: HarnessBinding[];
  builtinHarnesses: string[];
  issues: string[];
  conflicts: CatalogConflict[];
}

export interface CheckIssue {
  severity: "warning" | "error";
  message: string;
  code: string;
}

export interface CheckReport {
  status: "ok" | "warning" | "error";
  issues: CheckIssue[];
  warnings: CheckIssue[];
  counts: Record<string, number>;
}

export interface SkillListing {
  name: string;
  description: string;
  sourceKind: string;
  sourceLocator: string;
  registry: string;
  installs: number;
}

export interface CentralizeAllResult {
  centralized: Array<{ skillRef: string; declaredName: string }>;
  skipped: Array<{ skillRef: string; reason: string }>;
  catalogSnapshot: CatalogEntrySummary[];
}

export interface ControlPlaneSummary {
  harnesses: HarnessSummary[];
  catalog: CatalogEntrySummary[];
  check: CheckReport;
}
