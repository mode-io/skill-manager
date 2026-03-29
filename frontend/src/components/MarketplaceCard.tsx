import { useState } from "react";
import { Star } from "lucide-react";

import type { MarketplaceItem } from "../api/types";
import { LoadingSpinner } from "./LoadingSpinner";

interface MarketplaceCardProps {
  item: MarketplaceItem;
  disabled: boolean;
  installing: boolean;
  onInstall: () => void;
}

function avatarFallbackLabel(item: MarketplaceItem): string {
  const owner = item.repoLabel.split("/", 1)[0]?.slice(0, 2);
  if (owner && owner.trim()) {
    return owner.toUpperCase();
  }
  return item.name.slice(0, 2).toUpperCase();
}

export function MarketplaceCard({
  item,
  disabled,
  installing,
  onInstall,
}: MarketplaceCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarSrc = item.repoImageUrl && !avatarFailed ? item.repoImageUrl : null;
  const stars = item.stars ?? 0;
  const installs = formatInstalls(item.installs);

  return (
    <article className="marketplace-card">
      <div className="marketplace-card__header">
        <div className="marketplace-card__identity">
          <div className="marketplace-card__avatar">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={`Avatar for ${item.repoLabel}`}
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <span className="marketplace-card__avatar-fallback">{avatarFallbackLabel(item)}</span>
            )}
          </div>
          <div className="marketplace-card__title-block">
            <div className="marketplace-card__title-row">
              <h4>{item.name}</h4>
            </div>
            {item.githubFolderUrl ? (
              <a href={item.githubFolderUrl} target="_blank" rel="noreferrer" className="marketplace-card__repo-link">
                {item.repoLabel}
              </a>
            ) : (
              <p className="marketplace-card__repo-link">{item.repoLabel}</p>
            )}
          </div>
        </div>
        {stars > 0 ? (
          <span className="marketplace-card__stars">
            <Star size={12} />
            {formatStars(stars)}
          </span>
        ) : null}
      </div>

      <p className="marketplace-card__description">{item.description || "Summary loading from skills.sh…"}</p>

      <div className="marketplace-card__meta">
        <span className="marketplace-card__meta-item">{installs} installs</span>
        {!item.githubFolderUrl ? (
          <a href={item.skillsDetailUrl} target="_blank" rel="noreferrer" className="marketplace-card__meta-link">
            View on skills.sh
          </a>
        ) : null}
      </div>

      <button type="button" className="btn btn-primary marketplace-card__action" disabled={disabled} onClick={onInstall}>
        {installing ? <LoadingSpinner size="sm" label={`Installing ${item.name}`} /> : null}
        Install
      </button>
    </article>
  );
}

function formatStars(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return `${value}`;
}

function formatInstalls(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return `${value}`;
}
