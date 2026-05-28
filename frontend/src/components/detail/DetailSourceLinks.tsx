import { ExternalLink, FolderGit2, GitBranch, Globe2 } from "lucide-react";

import { UiTooltipTriggerBoundary } from "../ui/UiTooltipTriggerBoundary";

export type DetailSourceLinkKind = "repo" | "folder" | "marketplace" | "external" | "website";

export interface DetailSourceLink {
  href?: string | null;
  label: string;
  kind?: DetailSourceLinkKind;
  disabledReason?: string;
  disabledAriaLabel?: string;
}

interface DetailSourceLinksProps {
  links: DetailSourceLink[];
  ariaLabel: string;
  label?: string;
}

export function DetailSourceLinks({
  links,
  ariaLabel,
  label = "Source",
}: DetailSourceLinksProps) {
  if (links.length === 0) {
    return null;
  }

  return (
    <div className="detail-source-row" aria-label={ariaLabel}>
      <div className="detail-source-label">
        <FolderGit2 size={14} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="detail-source-links">
        {links.map((link) => {
          const kind = link.kind ?? "external";
          const className = `action-pill detail-source-link detail-source-link--${kind}`;
          const Icon = iconForKind(kind);
          const key = `${kind}:${link.href ?? link.label}`;
          if (!link.href) {
            const button = (
              <button
                type="button"
                className={className}
                disabled
                aria-label={link.disabledAriaLabel ?? link.label}
              >
                <Icon size={12} aria-hidden="true" />
                {link.label}
              </button>
            );
            return (
              <UiTooltipTriggerBoundary key={key} content={link.disabledReason}>
                {button}
              </UiTooltipTriggerBoundary>
            );
          }
          return (
            <a
              key={key}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              <Icon size={12} aria-hidden="true" />
              {link.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function iconForKind(kind: DetailSourceLinkKind) {
  if (kind === "repo") {
    return GitBranch;
  }
  if (kind === "website") {
    return Globe2;
  }
  return ExternalLink;
}
