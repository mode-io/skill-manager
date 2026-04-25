import { ExternalLink, FolderGit2 } from "lucide-react";

export type DetailSourceLinkKind = "repo" | "folder" | "marketplace" | "external" | "website";

export interface DetailSourceLink {
  href: string;
  label: string;
  kind?: DetailSourceLinkKind;
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
        {links.map((link) => (
          <a
            key={`${link.kind ?? "external"}:${link.href}`}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`detail-source-link detail-source-link--${link.kind ?? "external"}`}
          >
            {link.label}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        ))}
      </div>
    </div>
  );
}
