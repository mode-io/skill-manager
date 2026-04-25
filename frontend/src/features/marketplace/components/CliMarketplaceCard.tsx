import { type KeyboardEvent, useState } from "react";
import { CheckCircle2, Star, TerminalSquare } from "lucide-react";

import type { CliMarketplaceItemDto } from "../api/cli-types";
import { formatMarketplaceStars } from "../model/formatters";

interface CliMarketplaceCardProps {
  item: CliMarketplaceItemDto;
  selected: boolean;
  onOpenDetail: () => void;
}

function avatarFallbackLabel(item: CliMarketplaceItemDto): string {
  return (item.name || item.slug).slice(0, 2).toUpperCase();
}

function sourceLine(item: CliMarketplaceItemDto): string {
  if (item.githubUrl) {
    try {
      return new URL(item.githubUrl).pathname.replace(/^\//, "");
    } catch {
      return item.slug;
    }
  }
  return item.vendorName || item.sourceType || `clis.dev/${item.slug}`;
}

export function CliMarketplaceCard({
  item,
  selected,
  onOpenDetail,
}: CliMarketplaceCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarSrc = item.iconUrl && !avatarFailed ? item.iconUrl : null;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    onOpenDetail();
  }

  return (
    <article
      className="market-card cli-card"
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={handleKeyDown}
      aria-label={`Open CLI marketplace detail for ${item.name}`}
      data-selected={selected}
    >
      <div className="market-card__head">
        <div className="market-card__avatar cli-card__avatar">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={`Avatar for ${item.name}`}
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <>
              <TerminalSquare size={18} aria-hidden="true" />
              <span>{avatarFallbackLabel(item)}</span>
            </>
          )}
        </div>
        <div>
          <h4 className="market-card__title">{item.name}</h4>
          <p className="market-card__repo">{sourceLine(item)}</p>
        </div>
      </div>

      <p className="market-card__body cli-card__body">
        {item.description || "No description provided."}
      </p>

      <div className="market-card__footer cli-card__footer">
        <div className="chip-cluster">
          {item.category ? <span className="chip">{item.category}</span> : null}
          {item.language ? <span className="chip">{item.language}</span> : null}
          {item.isOfficial ? (
            <span className="chip chip--verified">
              <CheckCircle2 size={12} aria-hidden="true" />
              Official
            </span>
          ) : null}
          {item.isTui ? <span className="chip">TUI</span> : null}
          {item.hasMcp ? <span className="chip">MCP</span> : null}
          {item.hasSkill ? <span className="chip">Skill</span> : null}
        </div>
        {item.stars != null ? (
          <span className="market-card__stat">
            <Star size={12} aria-hidden="true" />
            {formatMarketplaceStars(item.stars)}
          </span>
        ) : null}
      </div>
    </article>
  );
}
