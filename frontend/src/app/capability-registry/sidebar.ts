import { useMemo } from "react";

import { mcpRoutes, useMcpInventoryQuery } from "../../features/mcp/public";
import { skillsRoutes, useSkillsListQuery } from "../../features/skills/public";
import { slashCommandRoutes, useSlashCommandsQuery } from "../../features/slash-commands/public";
import { marketplaceRoutes } from "../../features/marketplace/public";
import { hooksRoutes, useHooksInventoryQuery } from "../../features/hooks/public";
import { permissionsRoutes, usePermissionsInventoryQuery } from "../../features/permissions/public";
import { agentsRoutes, useAgentsInventoryQuery } from "../../features/agents/public";
import { useCommonCopy } from "../../i18n";

export type SidebarIconKey = "overview" | "skills" | "slash-commands" | "mcp" | "marketplace" | "hooks" | "permissions" | "agents";

export interface SidebarLinkModel {
  key: string;
  to: string;
  label: string;
  count?: number | null;
}

export interface SidebarTopLinkModel extends SidebarLinkModel {
  iconKey: SidebarIconKey;
}

export interface SidebarGroupModel {
  key: string;
  label: string;
  iconKey: SidebarIconKey;
  count?: number | null;
  links: SidebarLinkModel[];
}

export interface SidebarModel {
  topLinks: SidebarTopLinkModel[];
  groups: SidebarGroupModel[];
}

export function useSidebarModel(): SidebarModel {
  const skillsQuery = useSkillsListQuery();
  const mcpQuery = useMcpInventoryQuery();
  const slashCommandsQuery = useSlashCommandsQuery();
  const common = useCommonCopy();

  const inUseSkills = skillsQuery.data?.summary.managed ?? null;
  const needsReviewSkills = skillsQuery.data?.summary.unmanaged ?? null;
  const slashCommandCount = slashCommandsQuery.data?.commands.length ?? null;
  const slashCommandReviewCount = slashCommandsQuery.data?.reviewCommands.length ?? null;
  const mcpCounts = mcpSidebarCounts(mcpQuery.data);
  const hooksQuery = useHooksInventoryQuery();
  const hooksCounts = hooksSidebarCounts(hooksQuery.data);
  const permissionsQuery = usePermissionsInventoryQuery();
  const permissionsCounts = permissionsSidebarCounts(permissionsQuery.data);
  const agentsQuery = useAgentsInventoryQuery();
  const agentsCounts = agentsSidebarCounts(agentsQuery.data);

  return useMemo(
    () => ({
      topLinks: [
        {
          key: "overview",
          to: "/overview",
          label: common.nav.overview,
          iconKey: "overview",
        },
        
      ],
      groups: [
        {
          key: "agents",
          label: "Agents",
          iconKey: "agents",
          count: agentsCounts.total,
          links: [
            { key: "agents-use", to: agentsRoutes.inUse, label: common.productLanguage.inUse, count: agentsCounts.inUse },
            {
              key: "agents-review",
              to: agentsRoutes.needsReview,
              label: common.productLanguage.needsReview,
              count: agentsCounts.needsReview,
            },
          ],
        },
        {
          key: "skills",
          label: common.nav.skills,
          iconKey: "skills",
          count: sumLoadedCounts(inUseSkills, needsReviewSkills),
          links: [
            { key: "skills-use", to: skillsRoutes.inUse, label: common.productLanguage.inUse, count: inUseSkills },
            {
              key: "skills-review",
              to: skillsRoutes.needsReview,
              label: common.productLanguage.needsReview,
              count: needsReviewSkills,
            },
          ],
        },
        {
          key: "slash-commands",
          label: common.nav.slashCommands,
          iconKey: "slash-commands",
          count: sumLoadedCounts(slashCommandCount, slashCommandReviewCount),
          links: [
            {
              key: "slash-commands-use",
              to: slashCommandRoutes.inUse,
              label: common.productLanguage.inUse,
              count: slashCommandCount,
            },
            {
              key: "slash-commands-review",
              to: slashCommandRoutes.needsReview,
              label: common.productLanguage.needsReview,
              count: slashCommandReviewCount,
            },
          ],
        },
        {
          key: "mcp",
          label: common.nav.mcpServers,
          iconKey: "mcp",
          count: mcpCounts.total,
          links: [
            { key: "mcp-use", to: mcpRoutes.inUse, label: common.productLanguage.inUse, count: mcpCounts.inUse },
            {
              key: "mcp-review",
              to: mcpRoutes.needsReview,
              label: common.productLanguage.needsReview,
              count: mcpCounts.needsReview,
            },
          ],
        },
        {
          key: "hooks",
          label: "Hooks",
          iconKey: "hooks",
          count: hooksCounts.total,
          links: [
            { key: "hooks-use", to: hooksRoutes.inUse, label: common.productLanguage.inUse, count: hooksCounts.inUse },
            {
              key: "hooks-review",
              to: hooksRoutes.needsReview,
              label: common.productLanguage.needsReview,
              count: hooksCounts.needsReview,
            },
          ],
        },
        {
          key: "permissions",
          label: common.nav.permissions || "Permissions",
          iconKey: "permissions",
          count: permissionsCounts.total,
          links: [
            { key: "permissions-use", to: permissionsRoutes.inUse, label: common.productLanguage.inUse, count: permissionsCounts.inUse },
            {
              key: "permissions-review",
              to: permissionsRoutes.needsReview,
              label: common.productLanguage.needsReview,
              count: permissionsCounts.needsReview,
            },
          ],
        },
        {
          key: "marketplace",
          label: common.nav.marketplace,
          iconKey: "marketplace",
          links: [
            { key: "marketplace-skills", to: marketplaceRoutes.skills, label: common.nav.skills },
            { key: "marketplace-mcp", to: marketplaceRoutes.mcp, label: "MCP" },
            { key: "marketplace-clis", to: marketplaceRoutes.clis, label: common.nav.clis },
          ],
        },
      ],
    }),
    [
      inUseSkills,
      mcpCounts.inUse,
      mcpCounts.needsReview,
      mcpCounts.total,
      hooksCounts.inUse,
      hooksCounts.needsReview,
      hooksCounts.total,
      permissionsCounts.inUse,
      permissionsCounts.needsReview,
      permissionsCounts.total,
      agentsCounts.inUse,
      agentsCounts.needsReview,
      agentsCounts.total,
      needsReviewSkills,
      slashCommandCount,
      slashCommandReviewCount,
      common,
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
  if (!inventory || !inventory.entries) {
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

function hooksSidebarCounts(inventory: ReturnType<typeof useHooksInventoryQuery>["data"]): {
  inUse: number | null;
  needsReview: number | null;
  total: number | null;
} {
  if (!inventory || !inventory.entries) {
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

function permissionsSidebarCounts(inventory: ReturnType<typeof usePermissionsInventoryQuery>["data"]): {
  inUse: number | null;
  needsReview: number | null;
  total: number | null;
} {
  if (!inventory || !inventory.entries) {
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

function agentsSidebarCounts(inventory: ReturnType<typeof useAgentsInventoryQuery>["data"]): {
  inUse: number | null;
  needsReview: number | null;
  total: number | null;
} {
  if (!inventory || !inventory.entries) {
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
