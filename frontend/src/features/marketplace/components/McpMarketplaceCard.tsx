import { type KeyboardEvent, useState } from "react";
import { Activity, CheckCircle2 } from "lucide-react";

import { UiTooltip } from "../../../components/ui/UiTooltip";
import type { McpMarketplaceItemDto } from "../api/mcp-types";
import { formatMcpUseCount } from "../model/formatters";
import {
  summaryInstallAvailability,
  useMcpInstallActionState,
} from "../model/mcp-install-action";
import { McpInstallButton } from "./McpInstallButton";

interface McpMarketplaceCardProps {
  item: McpMarketplaceItemDto;
  selected: boolean;
  onOpenDetail: () => void;
}

function avatarFallbackLabel(item: McpMarketplaceItemDto): string {
  const source = item.displayName || item.qualifiedName;
  return source.slice(0, 2).toUpperCase();
}

export function McpMarketplaceCard({ item, onOpenDetail }: McpMarketplaceCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarSrc = item.iconUrl && !avatarFailed ? item.iconUrl : null;
  const installAction = useMcpInstallActionState({
    qualifiedName: item.qualifiedName,
    displayName: item.displayName,
  });
  const availability = summaryInstallAvailability(item);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    onOpenDetail();
  }

  return (
    <article
      className="market-card mcp-card"
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={handleKeyDown}
      aria-label={`Open MCP marketplace detail for ${item.displayName}`}
    >
      <div className="market-card__head">
        <div className="market-card__avatar">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={`Icon for ${item.displayName}`}
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            avatarFallbackLabel(item)
          )}
        </div>
        <div>
          <h4 className="market-card__title">{item.displayName}</h4>
          <p className="market-card__repo">{item.qualifiedName}</p>
        </div>
      </div>

      <p className="market-card__body mcp-card__body">
        {item.description || "No description provided."}
      </p>

      <div className="market-card__footer mcp-card__footer">
        <div className="chip-cluster">
          <span className={`chip chip--${item.isRemote ? "remote" : "local"}`}>
            {item.isRemote ? "Remote" : "Local"}
          </span>
          {item.isVerified ? (
            <span className="chip chip--verified">
              <CheckCircle2 size={12} aria-hidden="true" />
              Verified
            </span>
          ) : null}
        </div>
        <div className="mcp-card__actions">
          <UiTooltip content={`${item.useCount.toLocaleString()} calls`}>
            <span className="market-card__stat">
              <Activity size={12} aria-hidden="true" />
              {formatMcpUseCount(item.useCount)}
            </span>
          </UiTooltip>
          <McpInstallButton
            displayName={item.displayName}
            availability={availability}
            installedState={installAction.installedState}
            installTargetState={installAction.installTargetState}
            installing={installAction.installing}
            onInstall={installAction.onInstall}
          />
        </div>
      </div>
    </article>
  );
}
