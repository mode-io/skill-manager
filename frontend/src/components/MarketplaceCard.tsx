import { useState } from "react";
import { Star } from "lucide-react";

import { apiPath } from "../api/paths";
import type { MarketplaceItem } from "../api/types";
import { LoadingSpinner } from "./LoadingSpinner";

interface MarketplaceCardProps {
  item: MarketplaceItem;
  disabled: boolean;
  installing: boolean;
  onInstall: () => void;
}

function avatarFallbackLabel(item: MarketplaceItem): string {
  const owner = item.github?.ownerLogin?.slice(0, 2);
  if (owner) {
    return owner.toUpperCase();
  }
  return item.name.slice(0, 2).toUpperCase();
}

export function MarketplaceCard({
  item,
  disabled,
  installing,
  onInstall,
}: MarketplaceCardProps): JSX.Element {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarPath = item.github?.avatarPath;
  const avatarSrc = avatarPath && !avatarFailed ? apiPath(avatarPath) : null;
  const identityLabel = item.github?.repo ?? item.github?.ownerLogin ?? null;
  const stars = item.github?.stars ?? 0;

  return (
    <article className="marketplace-card">
      <div className="marketplace-card__header">
        <div className="marketplace-card__identity">
          <div className="marketplace-card__avatar">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={`Avatar for ${item.github?.ownerLogin ?? item.name}`}
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <span className="marketplace-card__avatar-fallback">{avatarFallbackLabel(item)}</span>
            )}
          </div>
          <div className="marketplace-card__title-block">
            <div className="marketplace-card__title-row">
              <h4>{item.name}</h4>
              {stars > 0 ? (
                <span className="marketplace-card__stars">
                  <Star size={12} />
                  {formatStars(stars)}
                </span>
              ) : null}
            </div>
            {identityLabel && item.github?.url ? (
              <a href={item.github.url} target="_blank" rel="noreferrer" className="marketplace-card__repo-link">
                {identityLabel}
              </a>
            ) : identityLabel ? (
              <p className="marketplace-card__repo-link">{identityLabel}</p>
            ) : null}
          </div>
        </div>
      </div>

      <p className="marketplace-card__description">{item.description || "No description provided."}</p>

      <div className="marketplace-card__meta">
        <span className="marketplace-card__meta-item">{item.registry}</span>
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
