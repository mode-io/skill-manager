import { type KeyboardEvent, useState } from "react";
import { Star } from "lucide-react";

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
  selected,
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
    <article className={`marketplace-card${selected ? " is-selected" : ""}`}>
      <div
        className="marketplace-card__preview"
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`Open marketplace detail for ${item.name}`}
        onClick={onOpenDetail}
        onKeyDown={handleKeyDown}
      >
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
              <a
                href={item.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="marketplace-card__repo-link"
                onClick={(event) => event.stopPropagation()}
              >
                {item.repoLabel}
              </a>
            </div>
          </div>
          {stars > 0 ? (
            <span className="marketplace-card__stars">
              <Star size={12} />
              {formatMarketplaceStars(stars)}
            </span>
          ) : null}
        </div>

        <p className="marketplace-card__description">{item.description || "No summary available on skills.sh."}</p>

        <div className="marketplace-card__meta">
          <span className="marketplace-card__meta-item">{installs} installs</span>
          <a
            href={item.skillsDetailUrl}
            target="_blank"
            rel="noreferrer"
            className="marketplace-card__meta-link"
            onClick={(event) => event.stopPropagation()}
          >
            View on skills.sh
          </a>
        </div>
      </div>

      <div className="marketplace-card__footer">
        {item.installation.status === "installed" && item.installation.installedSkillRef ? (
          <button
            type="button"
            className="btn btn-secondary marketplace-card__action marketplace-card__action--installed"
            onClick={handleOpenInstalled}
          >
            Open in Skills
          </button>
        ) : (
          <button type="button" className="btn btn-primary marketplace-card__action" onClick={onInstall}>
            {installing ? <LoadingSpinner size="sm" label={`Installing ${item.name}`} /> : null}
            Install
          </button>
        )}
      </div>
    </article>
  );
}
