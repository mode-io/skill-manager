import { useMemo } from "react";

import { productLanguage } from "../../lib/product-language";
import { mcpRoutes, useMcpInventoryQuery } from "../../features/mcp/public";
import { skillsRoutes, useSkillsListQuery } from "../../features/skills/public";
import { slashCommandRoutes, useSlashCommandsQuery } from "../../features/slash-commands/public";
import { marketplaceRoutes } from "../../features/marketplace/public";

export type SidebarIconKey = "overview" | "skills" | "slash-commands" | "mcp" | "marketplace";

export interface SidebarLinkModel {
  key: string;
  to: string;
  label: string;
  count?: number | null;
}

export interface SidebarGroupModel {
  key: string;
  label: string;
  iconKey: SidebarIconKey;
  count?: number | null;
  links: SidebarLinkModel[];
}

export interface SidebarModel {
  topLinks: SidebarLinkModel[];
  groups: SidebarGroupModel[];
}

export function useSidebarModel(): SidebarModel {
  const skillsQuery = useSkillsListQuery();
  const mcpQuery = useMcpInventoryQuery();
  const slashCommandsQuery = useSlashCommandsQuery();

  const inUseSkills = skillsQuery.data?.summary.managed ?? null;
  const needsReviewSkills = skillsQuery.data?.summary.unmanaged ?? null;
  const slashCommandCount = slashCommandsQuery.data?.commands.length ?? null;
  const slashCommandReviewCount = slashCommandsQuery.data?.reviewCommands.length ?? null;
  const mcpCounts = mcpSidebarCounts(mcpQuery.data);

  return useMemo(
    () => ({
      topLinks: [
        {
          key: "overview",
          to: "/overview",
          label: "Overview",
        },
      ],
      groups: [
        {
          key: "skills",
          label: "Skills",
          iconKey: "skills",
          count: sumLoadedCounts(inUseSkills, needsReviewSkills),
          links: [
            { key: "skills-use", to: skillsRoutes.inUse, label: productLanguage.inUse, count: inUseSkills },
            {
              key: "skills-review",
              to: skillsRoutes.needsReview,
              label: productLanguage.needsReview,
              count: needsReviewSkills,
            },
          ],
        },
        {
          key: "slash-commands",
          label: "Slash Commands",
          iconKey: "slash-commands",
          count: sumLoadedCounts(slashCommandCount, slashCommandReviewCount),
          links: [
            {
              key: "slash-commands-use",
              to: slashCommandRoutes.inUse,
              label: productLanguage.inUse,
              count: slashCommandCount,
            },
            {
              key: "slash-commands-review",
              to: slashCommandRoutes.needsReview,
              label: productLanguage.needsReview,
              count: slashCommandReviewCount,
            },
          ],
        },
        {
          key: "mcp",
          label: "MCP Servers",
          iconKey: "mcp",
          count: mcpCounts.total,
          links: [
            { key: "mcp-use", to: mcpRoutes.inUse, label: productLanguage.inUse, count: mcpCounts.inUse },
            {
              key: "mcp-review",
              to: mcpRoutes.needsReview,
              label: productLanguage.needsReview,
              count: mcpCounts.needsReview,
            },
          ],
        },
        {
          key: "marketplace",
          label: "Marketplace",
          iconKey: "marketplace",
          links: [
            { key: "marketplace-skills", to: marketplaceRoutes.skills, label: "Skills" },
            { key: "marketplace-mcp", to: marketplaceRoutes.mcp, label: "MCP" },
            { key: "marketplace-clis", to: marketplaceRoutes.clis, label: "CLIs" },
          ],
        },
      ],
    }),
    [
      inUseSkills,
      mcpCounts.inUse,
      mcpCounts.needsReview,
      mcpCounts.total,
      needsReviewSkills,
      slashCommandCount,
      slashCommandReviewCount,
    ],
  );
}

function sumLoadedCounts(...counts: Array<number | null | undefined>): number | null {
  let total = 0;
  for (const count of counts) {
    if (count == null) {
      return null;
    }
    total += count;
  }
  return total;
}

function mcpSidebarCounts(inventory: ReturnType<typeof useMcpInventoryQuery>["data"]): {
  inUse: number | null;
  needsReview: number | null;
  total: number | null;
} {
  if (!inventory) {
    return { inUse: null, needsReview: null, total: null };
  }
  const inUse = inventory.entries.filter((entry) => entry.kind === "managed").length;
  const needsReview = inventory.entries.filter((entry) => entry.kind === "unmanaged").length;
  return {
    inUse,
    needsReview,
    total: sumLoadedCounts(inUse, needsReview),
  };
}
