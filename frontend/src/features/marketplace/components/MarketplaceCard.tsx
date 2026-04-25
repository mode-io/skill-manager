import { type KeyboardEvent, useState } from "react";
import { ArrowUpRight, Plus, Star } from "lucide-react";

import { LoadingSpinner } from "../../../components/LoadingSpinner";
import type { MarketplaceItemDto } from "../api/types";
import { formatMarketplaceInstalls, formatMarketplaceStars } from "../model/formatters";

interface MarketplaceCardProps {
  item: MarketplaceItemDto;
  selected: boolean;
  installing: boolean;
  onOpenDetail: () => void;
  onInstall: () => void;
  onOpenInstalledSkill: (skillRef: string) => void;
}

function avatarFallbackLabel(item: MarketplaceItemDto): string {
  const owner = item.repoLabel.split("/", 1)[0]?.slice(0, 2);
  if (owner && owner.trim()) {
    return owner.toUpperCase();
  }
  return item.name.slice(0, 2).toUpperCase();
}

export function MarketplaceCard({
  item,
  installing,
  onOpenDetail,
  onInstall,
  onOpenInstalledSkill,
}: MarketplaceCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarSrc = item.repoImageUrl && !avatarFailed ? item.repoImageUrl : null;
  const stars = item.stars ?? 0;
  const installs = formatMarketplaceInstalls(item.installs);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    onOpenDetail();
  }

  function handleOpenInstalled(): void {
    if (!item.installation.installedSkillRef) {
      return;
    }
    onOpenInstalledSkill(item.installation.installedSkillRef);
  }

  return (
    <article
      className="market-card"
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={handleKeyDown}
      aria-label={`Open marketplace detail for ${item.name}`}
    >
      <div className="market-card__head">
        <div className="market-card__avatar">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={`Avatar for ${item.repoLabel}`}
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            avatarFallbackLabel(item)
          )}
        </div>
        <div>
          <h4 className="market-card__title">{item.name}</h4>
          <p className="market-card__repo">{item.repoLabel}</p>
        </div>
        {stars > 0 ? (
          <span className="market-card__stars">
            <Star size={11} fill="currentColor" />
            {formatMarketplaceStars(stars)}
          </span>
        ) : null}
      </div>

      <p className="market-card__body">{item.description || "No summary available on skills.sh."}</p>

      <div className="market-card__footer">
        <span className="market-card__installs">{installs} installs</span>
        {item.installation.status === "installed" && item.installation.installedSkillRef ? (
          <button
            type="button"
            className="action-pill"
            onClick={(event) => {
              event.stopPropagation();
              handleOpenInstalled();
            }}
            aria-label={`Open ${item.name} in Skills`}
          >
            <ArrowUpRight size={12} aria-hidden="true" />
            Open in Skills
          </button>
        ) : (
          <button
            type="button"
            className="action-pill"
            onClick={(event) => {
              event.stopPropagation();
              onInstall();
            }}
            aria-label={`Install ${item.name}`}
            data-pending={installing || undefined}
          >
            {installing ? (
              <LoadingSpinner size="sm" label={`Installing ${item.name}`} />
            ) : (
              <Plus size={12} aria-hidden="true" />
            )}
            Install
          </button>
        )}
      </div>
    </article>
  );
}
