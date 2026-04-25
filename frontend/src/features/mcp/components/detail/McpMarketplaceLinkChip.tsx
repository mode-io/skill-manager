import { ExternalLink } from "lucide-react";

import { UiTooltip } from "../../../../components/ui/UiTooltip";
import type { McpMarketplaceLinkDto } from "../../api/management-types";

interface McpMarketplaceLinkChipProps {
  link: McpMarketplaceLinkDto;
}

export function McpMarketplaceLinkChip({ link }: McpMarketplaceLinkChipProps) {
  return (
    <UiTooltip content={link.description || link.displayName}>
      <a
        className="chip chip--verified mcp-marketplace-link-chip"
        href={link.externalUrl}
        target="_blank"
        rel="noreferrer"
      >
        {link.iconUrl ? (
          <img
            src={link.iconUrl}
            alt=""
            aria-hidden="true"
            className="mcp-marketplace-link-chip__icon"
          />
        ) : null}
        <span>Match in marketplace</span>
        <ExternalLink size={12} aria-hidden="true" />
      </a>
    </UiTooltip>
  );
}
