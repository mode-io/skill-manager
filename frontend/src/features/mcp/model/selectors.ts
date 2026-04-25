import type {
  McpBindingDto,
  McpConfigChoiceDto,
  McpEnvEntryDto,
  McpIdentitySightingDto,
  McpInventoryColumnDto,
  McpInventoryDto,
  McpInventoryEntryDto,
  McpServerSpecDto,
} from "../api/management-types";

export type InUsePillValue = "all" | "enabled" | "all-harnesses" | "unbound" | "drifted";

export interface McpInUseFilters {
  search: string;
  pill: InUsePillValue;
}

export type McpMatrixCellState = "enabled" | "disabled" | "different" | "unavailable" | "observed";

export interface McpMatrixCellModel {
  state: McpMatrixCellState;
  binding: McpBindingDto | null;
  writable: boolean;
  pendingKey: string;
  tooltip: string;
  ariaLabel: string;
  action: "enable" | "disable" | "resolve" | "open" | null;
}

/**
 * True when an MCP harness can receive Skill Manager MCP writes on this system.
 * Discovery remains broader on the backend so stale/bad configs can still be
 * disabled, but frontend enable affordances must follow the verified write
 * capability exposed by the backend.
 *
 * Used by consumers (card footers, logo stacks, binding matrix) inline
 * where they need to count or filter per-harness state. Kept as a leaf
 * predicate rather than a data-shape filter so the inventory layer
 * stays a single source of truth, with no parallel filtered view to
 * reconcile.
 */
export function isMcpHarnessAddressable(column: McpInventoryColumnDto): boolean {
  return column.mcpWritable !== false && (column.installed || column.configPresent);
}

function inUseBindingCount(
  entry: McpInventoryEntryDto,
  addressable?: ReadonlySet<string>,
): number {
  return entry.sightings.filter(
    (b) => b.state === "managed" && (!addressable || addressable.has(b.harness)),
  ).length;
}

function hasDrift(entry: McpInventoryEntryDto, addressable?: ReadonlySet<string>): boolean {
  return entry.sightings.some(
    (b) => b.state === "drifted" && (!addressable || addressable.has(b.harness)),
  );
}

function addressableHarnesses(inventory: McpInventoryDto): ReadonlySet<string> {
  return new Set(inventory.columns.filter(isMcpHarnessAddressable).map((column) => column.harness));
}

function matchesSearch(entry: McpInventoryEntryDto, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (entry.name.toLowerCase().includes(needle)) return true;
  if (entry.displayName.toLowerCase().includes(needle)) return true;
  if (entry.spec?.transport && entry.spec.transport.toLowerCase().includes(needle)) return true;
  return false;
}

export function filterMcpServersInUse(
  inventory: McpInventoryDto | null,
  filters: McpInUseFilters,
): McpInventoryEntryDto[] {
  if (!inventory) return [];
  const addressable = addressableHarnesses(inventory);
  const harnessCount = addressable.size;
  return inventory.entries.filter((entry) => {
    if (entry.kind !== "managed") return false;
    if (!matchesSearch(entry, filters.search.trim())) return false;
    const enabledCount = inUseBindingCount(entry, addressable);
    switch (filters.pill) {
      case "all":
        return true;
      case "enabled":
        return enabledCount > 0;
      case "all-harnesses":
        return harnessCount > 0 && enabledCount === harnessCount;
      case "unbound":
        return enabledCount === 0 && !hasDrift(entry, addressable);
      case "drifted":
        return hasDrift(entry, addressable);
      default:
        return true;
    }
  });
}

export function pillCounts(inventory: McpInventoryDto | null): Record<InUsePillValue, number> {
  if (!inventory) {
    return { all: 0, enabled: 0, "all-harnesses": 0, unbound: 0, drifted: 0 };
  }
  const addressable = addressableHarnesses(inventory);
  const harnessCount = addressable.size;
  const inUseEntries = inventory.entries.filter((e) => e.kind === "managed");
  return {
    all: inUseEntries.length,
    enabled: inUseEntries.filter((e) => inUseBindingCount(e, addressable) > 0).length,
    "all-harnesses": inUseEntries.filter(
      (e) => harnessCount > 0 && inUseBindingCount(e, addressable) === harnessCount,
    ).length,
    unbound: inUseEntries.filter(
      (e) => inUseBindingCount(e, addressable) === 0 && !hasDrift(e, addressable),
    ).length,
    drifted: inUseEntries.filter((entry) => hasDrift(entry, addressable)).length,
  };
}

export function matrixColumns(inventory: { columns: McpInventoryColumnDto[] } | null): McpInventoryColumnDto[] {
  return inventory?.columns ?? [];
}

export function matrixCellFor(
  entry: McpInventoryEntryDto,
  column: McpInventoryColumnDto,
): McpMatrixCellModel {
  const binding = entry.sightings.find((candidate) => candidate.harness === column.harness) ?? null;
  const writable = isMcpHarnessAddressable(column);
  const pendingKey = `${entry.name}:${column.harness}`;
  const baseLabel = `${entry.displayName} on ${column.label}`;

  if (binding?.state === "managed") {
    return {
      state: "enabled",
      binding,
      writable,
      pendingKey,
      tooltip: `${column.label} — enabled`,
      ariaLabel: `Disable ${baseLabel}`,
      action: "disable",
    };
  }

  if (binding?.state === "drifted") {
    const detail = binding.driftDetail ? ` (${binding.driftDetail})` : "";
    return {
      state: "different",
      binding,
      writable,
      pendingKey,
      tooltip: `${column.label} — Different config${detail}`,
      ariaLabel: `Resolve config for ${baseLabel}`,
      action: "resolve",
    };
  }

  if (binding?.state === "unmanaged") {
    return {
      state: "observed",
      binding,
      writable,
      pendingKey,
      tooltip: `${column.label} — Found in harness`,
      ariaLabel: `Open detail for ${baseLabel}`,
      action: "open",
    };
  }

  if (!writable || !entry.canEnable) {
    return {
      state: "unavailable",
      binding,
      writable,
      pendingKey,
      tooltip: column.mcpUnavailableReason ?? "Unavailable",
      ariaLabel: `${baseLabel} is unavailable`,
      action: null,
    };
  }

  return {
    state: "disabled",
    binding,
    writable,
    pendingKey,
    tooltip: `${column.label} — disabled`,
    ariaLabel: `Enable ${baseLabel}`,
    action: "enable",
  };
}

export function matrixCoverage(
  entry: McpInventoryEntryDto,
  columns: readonly McpInventoryColumnDto[],
): { enabled: number; writable: number } {
  const addressable = new Set(columns.filter(isMcpHarnessAddressable).map((column) => column.harness));
  return {
    enabled: entry.sightings.filter(
      (binding) => addressable.has(binding.harness) && binding.state === "managed",
    ).length,
    writable: addressable.size,
  };
}

// Choose-version dialog helpers -------------------------------------------

const URL_CREDENTIAL_RE = /[?&](api[_-]?key|token|secret|auth|authorization)=/i;

export interface SightingSummary {
  primary: string;
  envCount: number;
  envKeys: readonly string[];
  credentialInUrl: boolean;
}

export function urlHasEmbeddedCredential(url: string | undefined | null): boolean {
  return typeof url === "string" && URL_CREDENTIAL_RE.test(url);
}

function parseHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function summarizeMcpConfig(
  spec: McpServerSpecDto,
  env: readonly McpEnvEntryDto[] = [],
): SightingSummary {
  const envKeys = env ? env.map((e) => e.key) : [];
  if (spec.transport === "stdio") {
    const raw = spec.command ?? "";
    const base = raw.split("/").pop() || raw;
    return {
      primary: `Local · ${base || "stdio"}`,
      envCount: envKeys.length,
      envKeys,
      credentialInUrl: false,
    };
  }
  const host = spec.url ? parseHost(spec.url) : "remote";
  const label = spec.transport === "sse" ? "SSE" : "HTTP";
  return {
    primary: `Remote ${label} · ${host}`,
    envCount: envKeys.length,
    envKeys,
    credentialInUrl: urlHasEmbeddedCredential(spec.url),
  };
}

export function summarizeSighting(sighting: McpIdentitySightingDto): SightingSummary {
  return summarizeMcpConfig(sighting.spec, sighting.env ?? []);
}

export function formatEnvKeyPreview(keys: readonly string[]): string {
  if (keys.length === 0) return "";
  if (keys.length <= 2) return keys.join(", ");
  return `${keys[0]}, ${keys[1]}, +${keys.length - 2} more`;
}

export function envChipLabel(count: number): string {
  return count === 1 ? "1 env var" : `${count} env vars`;
}

/**
 * Suggest a canonical harness when payloads differ.
 * Priority:
 *   1) stdio with env-var references (safest — no literal secrets anywhere)
 *   2) stdio (literal env is still safer than URL-embedded)
 *   3) remote without credential embedded in URL
 *   4) none — caller should fall back to the first sighting
 */
export function pickRecommendedSighting(
  sightings: readonly McpIdentitySightingDto[],
): string | null {
  if (sightings.length === 0) return null;
  const hasEnvRef = (s: McpIdentitySightingDto) => (s.env ?? []).some((e) => e.isEnvRef);

  const tier1 = sightings.find((s) => s.spec.transport === "stdio" && hasEnvRef(s));
  if (tier1) return tier1.harness;
  const tier2 = sightings.find((s) => s.spec.transport === "stdio");
  if (tier2) return tier2.harness;
  const tier3 = sightings.find(
    (s) => s.spec.transport !== "stdio" && !urlHasEmbeddedCredential(s.spec.url),
  );
  if (tier3) return tier3.harness;
  return null;
}

export function pickRecommendedConfigChoice(
  choices: readonly McpConfigChoiceDto[],
): string | null {
  const harnessChoices = choices.filter((choice) => choice.sourceKind === "harness");
  if (harnessChoices.length === 0) return choices[0]?.sourceKind === "managed" ? "managed" : null;
  const hasEnvRef = (choice: McpConfigChoiceDto) => (choice.env ?? []).some((e) => e.isEnvRef);
  const tier1 = harnessChoices.find((choice) => choice.spec.transport === "stdio" && hasEnvRef(choice));
  if (tier1?.sourceHarness) return tier1.sourceHarness;
  const tier2 = harnessChoices.find((choice) => choice.spec.transport === "stdio");
  if (tier2?.sourceHarness) return tier2.sourceHarness;
  const tier3 = harnessChoices.find(
    (choice) => choice.spec.transport !== "stdio" && !urlHasEmbeddedCredential(choice.spec.url),
  );
  if (tier3?.sourceHarness) return tier3.sourceHarness;
  return choices[0]?.sourceKind === "managed" ? "managed" : (harnessChoices[0]?.sourceHarness ?? null);
}
