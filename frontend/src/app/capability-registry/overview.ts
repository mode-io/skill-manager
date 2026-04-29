import type { QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  invalidateMcpQueries,
  isMcpHarnessAddressable,
  mcpRoutes,
  useMcpInventoryQuery,
  type McpInventoryDto,
} from "../../features/mcp/public";
import {
  invalidateSkillsQueries,
  skillsRoutes,
  useSkillsListQuery,
  type SkillsWorkspaceData,
} from "../../features/skills/public";
import {
  invalidateSlashCommandQueries,
  slashCommandRoutes,
  useSlashCommandsQuery,
  type SlashCommandListDto,
} from "../../features/slash-commands/public";
import { marketplaceRoutes } from "../../features/marketplace/public";

export interface OverviewStatMetric {
  value: number | null;
  detail: string;
}

export interface OverviewStats {
  inUse: OverviewStatMetric;
  needsReview: OverviewStatMetric;
  harnesses: OverviewStatMetric;
}

export interface OverviewExtensionAction {
  label: string;
  to: string;
  primary?: boolean;
}

export interface OverviewExtensionFact {
  label: string;
  value: number | null;
  tone?: "normal" | "warning";
}

export interface OverviewExtensionKind {
  key: "skills" | "slash-commands" | "mcp";
  label: string;
  iconKey: "skills" | "slash-commands" | "mcp";
  facts: OverviewExtensionFact[];
  actions: OverviewExtensionAction[];
}

export interface OverviewMarketplaceAction {
  label: string;
  to: string;
  primary?: boolean;
}

export interface OverviewMarketplaceEntry {
  key: "skills" | "mcp" | "clis";
  label: string;
  iconKey: "skills" | "mcp" | "clis";
  sourceLabel: string;
  badge?: string;
  tone?: "normal" | "accent";
  action: OverviewMarketplaceAction;
}

export interface OverviewReviewItem {
  key: string;
  label: string;
  description: string;
  count: number;
  to: string;
  tone: "neutral" | "warning" | "danger";
}

export interface OverviewHarnessRow {
  harness: string;
  label: string;
  logoKey: string | null;
  enabledSkills: number;
  foundSkills: number;
  managedMcpServers: number;
  differentConfigMcpServers: number;
  unmanagedMcpServers: number;
  mcpWritable: boolean | null;
  mcpUnavailableReason: string | null;
}

export interface OverviewModel {
  stats: OverviewStats;
  extensions: OverviewExtensionKind[];
  marketplaceEntries: OverviewMarketplaceEntry[];
  reviewItems: OverviewReviewItem[];
  harnessRows: OverviewHarnessRow[];
}

export function useOverviewData() {
  const skillsQuery = useSkillsListQuery();
  const slashCommandsQuery = useSlashCommandsQuery();
  const mcpQuery = useMcpInventoryQuery();
  const model = useOverviewModel(skillsQuery.data, slashCommandsQuery.data, mcpQuery.data);

  return {
    skillsQuery,
    slashCommandsQuery,
    mcpQuery,
    model,
  };
}

export async function invalidateOverviewData(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateSkillsQueries(queryClient),
    invalidateSlashCommandQueries(queryClient),
    invalidateMcpQueries(queryClient),
  ]);
}

interface HarnessAccumulator extends OverviewHarnessRow {
  order: number;
}

export function useOverviewModel(
  skills: SkillsWorkspaceData | null | undefined,
  slashCommands: SlashCommandListDto | null | undefined,
  mcp: McpInventoryDto | null | undefined,
): OverviewModel {
  return useMemo(() => buildOverviewModel(skills, slashCommands, mcp), [skills, slashCommands, mcp]);
}

export function buildOverviewModel(
  skills: SkillsWorkspaceData | null | undefined,
  slashCommands: SlashCommandListDto | null | undefined,
  mcp: McpInventoryDto | null | undefined,
): OverviewModel {
  const inUseSkills = skills?.summary.managed ?? null;
  const skillsToReview = skills?.summary.unmanaged ?? null;
  const inUseSlashCommands = slashCommands?.commands?.length ?? null;
  const slashCommandsToReview = slashCommands?.reviewCommands?.length ?? null;
  const inUseMcpServers = mcp?.entries.filter((entry) => entry.kind === "managed").length ?? null;
  const mcpConfigsToReview = mcp?.entries.filter((entry) => entry.kind === "unmanaged").length ?? null;
  const differentConfigMcpServers =
    mcp?.entries.filter(
      (entry) =>
        entry.kind === "managed" &&
        entry.sightings.some((sighting) => sighting.state === "drifted"),
    ).length ?? null;
  const inventoryIssues = mcp?.issues?.length ?? null;
  const unavailableHarnesses = mcp?.columns.filter((column) => column.mcpWritable === false).length ?? null;
  const reviewItems = buildReviewItems({
    skillsToReview,
    slashCommandsToReview,
    mcpConfigsToReview,
    differentConfigMcpServers,
    inventoryIssues,
    unavailableHarnesses,
  });
  const harnessRows = buildHarnessRows(skills, mcp);
  const hasOverviewData = Boolean(skills || slashCommands || mcp);

  return {
    stats: buildStats({
      inUseSkills,
      inUseSlashCommands,
      inUseMcpServers,
      needsReview: hasOverviewData ? reviewItems.reduce((total, item) => total + item.count, 0) : null,
      harnesses: hasOverviewData ? harnessRows.length : null,
    }),
    extensions: buildExtensions({
      inUseSkills,
      inUseSlashCommands,
      skillsToReview,
      slashCommandsToReview,
      inUseMcpServers,
      mcpConfigsToReview,
      differentConfigMcpServers,
      inventoryIssues,
      unavailableHarnesses,
    }),
    marketplaceEntries: buildMarketplaceEntries(),
    reviewItems,
    harnessRows,
  };
}

function buildStats({
  inUseSkills,
  inUseSlashCommands,
  inUseMcpServers,
  needsReview,
  harnesses,
}: {
  inUseSkills: number | null;
  inUseSlashCommands: number | null;
  inUseMcpServers: number | null;
  needsReview: number | null;
  harnesses: number | null;
}): OverviewStats {
  return {
    inUse: {
      value: sumKnown(inUseSkills, inUseSlashCommands, inUseMcpServers),
      detail: [
        formatMetricPart(inUseSkills, "skill", "skills"),
        formatMetricPart(inUseSlashCommands, "command", "commands"),
        formatMetricPart(inUseMcpServers, "MCP", "MCP"),
      ].join(" · "),
    },
    needsReview: {
      value: needsReview,
      detail: "adoption · config · inventory",
    },
    harnesses: {
      value: harnesses,
      detail: `${formatCount(harnesses)} observed`,
    },
  };
}

function sumKnown(...values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value != null);
  if (known.length === 0) {
    return null;
  }
  return known.reduce((total, value) => total + value, 0);
}

function buildExtensions({
  inUseSkills,
  inUseSlashCommands,
  skillsToReview,
  slashCommandsToReview,
  inUseMcpServers,
  mcpConfigsToReview,
  differentConfigMcpServers,
  inventoryIssues,
  unavailableHarnesses,
}: {
  inUseSkills: number | null;
  inUseSlashCommands: number | null;
  skillsToReview: number | null;
  slashCommandsToReview: number | null;
  inUseMcpServers: number | null;
  mcpConfigsToReview: number | null;
  differentConfigMcpServers: number | null;
  inventoryIssues: number | null;
  unavailableHarnesses: number | null;
}): OverviewExtensionKind[] {
  return [
    {
      key: "skills",
      label: "Skills",
      iconKey: "skills",
      facts: [
        { label: "in use", value: inUseSkills },
        { label: "review", value: skillsToReview, tone: "warning" },
      ],
      actions: [
        { label: "In use", to: skillsRoutes.inUse, primary: true },
        { label: "Needs review", to: skillsRoutes.needsReview },
      ],
    },
    {
      key: "slash-commands",
      label: "Slash Commands",
      iconKey: "slash-commands",
      facts: [
        { label: "in use", value: inUseSlashCommands },
        { label: "review", value: slashCommandsToReview, tone: "warning" },
      ],
      actions: [
        { label: "In use", to: slashCommandRoutes.inUse, primary: true },
        { label: "Needs review", to: slashCommandRoutes.needsReview },
      ],
    },
    {
      key: "mcp",
      label: "MCP Servers",
      iconKey: "mcp",
      facts: [
        { label: "in use", value: inUseMcpServers },
        {
          label: "review",
          value: sumKnown(
            mcpConfigsToReview,
            differentConfigMcpServers,
            inventoryIssues,
            unavailableHarnesses,
          ),
          tone: "warning",
        },
      ],
      actions: [
        { label: "In use", to: mcpRoutes.inUse, primary: true },
        { label: "Needs review", to: mcpRoutes.needsReview },
      ],
    },
  ];
}

function buildMarketplaceEntries(): OverviewMarketplaceEntry[] {
  return [
    {
      key: "skills",
      label: "Skills Marketplace",
      iconKey: "skills",
      sourceLabel: "skills.sh",
      action: { label: "Browse", to: marketplaceRoutes.skills, primary: true },
    },
    {
      key: "mcp",
      label: "MCP Marketplace",
      iconKey: "mcp",
      sourceLabel: "smithery.ai",
      action: { label: "Browse", to: marketplaceRoutes.mcp, primary: true },
    },
    {
      key: "clis",
      label: "CLI Marketplace",
      iconKey: "clis",
      sourceLabel: "CLIs.dev",
      badge: "Preview only",
      tone: "accent",
      action: { label: "Browse", to: marketplaceRoutes.clis, primary: true },
    },
  ];
}

function formatMetricPart(value: number | null, singular: string, plural: string): string {
  const label = value === 1 ? singular : plural;
  return `${formatCount(value)} ${label}`;
}

function formatCount(value: number | null): string {
  return value == null ? "-" : value.toLocaleString();
}

function buildReviewItems({
  skillsToReview,
  slashCommandsToReview,
  mcpConfigsToReview,
  differentConfigMcpServers,
  inventoryIssues,
  unavailableHarnesses,
}: {
  skillsToReview: number | null;
  slashCommandsToReview: number | null;
  mcpConfigsToReview: number | null;
  differentConfigMcpServers: number | null;
  inventoryIssues: number | null;
  unavailableHarnesses: number | null;
}): OverviewReviewItem[] {
  const items: OverviewReviewItem[] = [];
  if (skillsToReview && skillsToReview > 0) {
    items.push({
      key: "skills-review",
      label: "Skills to review",
      description: "Adopt local skills so they can be enabled consistently.",
      count: skillsToReview,
      to: skillsRoutes.needsReview,
      tone: "neutral",
    });
  }
  if (slashCommandsToReview && slashCommandsToReview > 0) {
    items.push({
      key: "slash-commands-review",
      label: "Slash commands",
      description: "Unmanaged, changed, or missing command files need a decision.",
      count: slashCommandsToReview,
      to: slashCommandRoutes.needsReview,
      tone: "warning",
    });
  }
  if (mcpConfigsToReview && mcpConfigsToReview > 0) {
    items.push({
      key: "mcp-review",
      label: "MCP configs to review",
      description: "Adopt existing harness configs into Skill Manager.",
      count: mcpConfigsToReview,
      to: mcpRoutes.needsReview,
      tone: "neutral",
    });
  }
  if (differentConfigMcpServers && differentConfigMcpServers > 0) {
    items.push({
      key: "different-mcp-configs",
      label: "Different MCP configs",
      description: "Resolve which config should become the source of truth.",
      count: differentConfigMcpServers,
      to: mcpRoutes.inUse,
      tone: "warning",
    });
  }
  if (inventoryIssues && inventoryIssues > 0) {
    items.push({
      key: "mcp-inventory-issues",
      label: "MCP inventory issues",
      description: "Some Skill Manager MCP records could not be loaded cleanly.",
      count: inventoryIssues,
      to: mcpRoutes.inUse,
      tone: "danger",
    });
  }
  if (unavailableHarnesses && unavailableHarnesses > 0) {
    items.push({
      key: "unavailable-mcp-harnesses",
      label: "MCP harness unavailable",
      description: "At least one harness cannot safely receive MCP writes.",
      count: unavailableHarnesses,
      to: "/settings",
      tone: "warning",
    });
  }
  return items;
}

function buildHarnessRows(
  skills: SkillsWorkspaceData | null | undefined,
  mcp: McpInventoryDto | null | undefined,
): OverviewHarnessRow[] {
  const harnesses = new Map<string, HarnessAccumulator>();
  let nextOrder = 0;

  const ensureHarness = (args: {
    harness: string;
    label?: string | null;
    logoKey?: string | null;
  }): HarnessAccumulator => {
    const existing = harnesses.get(args.harness);
    if (existing) {
      if (!existing.logoKey && args.logoKey) existing.logoKey = args.logoKey;
      if (existing.label === args.harness && args.label) existing.label = args.label;
      return existing;
    }
    const row: HarnessAccumulator = {
      harness: args.harness,
      label: args.label ?? args.harness,
      logoKey: args.logoKey ?? null,
      enabledSkills: 0,
      foundSkills: 0,
      managedMcpServers: 0,
      differentConfigMcpServers: 0,
      unmanagedMcpServers: 0,
      mcpWritable: null,
      mcpUnavailableReason: null,
      order: nextOrder,
    };
    nextOrder += 1;
    harnesses.set(args.harness, row);
    return row;
  };

  for (const column of skills?.harnessColumns ?? []) {
    ensureHarness({
      harness: column.harness,
      label: column.label,
      logoKey: column.logoKey ?? column.harness,
    });
  }

  for (const row of skills?.rows ?? []) {
    for (const cell of row.cells) {
      const harness = ensureHarness({
        harness: cell.harness,
        label: cell.label,
        logoKey: cell.logoKey ?? cell.harness,
      });
      if (cell.state === "enabled") harness.enabledSkills += 1;
      if (cell.state === "found") harness.foundSkills += 1;
    }
  }

  for (const column of mcp?.columns ?? []) {
    const harness = ensureHarness({
      harness: column.harness,
      label: column.label,
      logoKey: column.logoKey ?? column.harness,
    });
    harness.mcpWritable = column.mcpWritable;
    harness.mcpUnavailableReason = column.mcpUnavailableReason ?? null;
  }

  for (const entry of mcp?.entries ?? []) {
    for (const sighting of entry.sightings) {
      const column = mcp?.columns.find((candidate) => candidate.harness === sighting.harness);
      const harness = ensureHarness({
        harness: sighting.harness,
        label: column?.label,
        logoKey: column?.logoKey ?? sighting.harness,
      });
      if (entry.kind === "managed" && sighting.state === "managed") {
        harness.managedMcpServers += 1;
      }
      if (entry.kind === "managed" && sighting.state === "drifted") {
        harness.differentConfigMcpServers += 1;
      }
      if (entry.kind === "unmanaged" && sighting.state === "unmanaged") {
        harness.unmanagedMcpServers += 1;
      }
    }
  }

  return Array.from(harnesses.values())
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...row }) => row);
}

export function inUseMcpHarnessCount(mcp: McpInventoryDto | null | undefined): number | null {
  if (!mcp) return null;
  return mcp.columns.filter(isMcpHarnessAddressable).length;
}
