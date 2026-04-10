import { ExternalLink, FolderGit2 } from "lucide-react";

interface DetailSourceLinksProps {
  sourceLinks: {
    repoLabel: string;
    repoUrl: string;
    folderUrl: string | null;
  } | null;
  externalUrl?: string | null;
  externalLabel?: string;
  label?: string;
}

export function DetailSourceLinks({
  sourceLinks,
  externalUrl = null,
  externalLabel = "Open external detail",
  label = "Source",
}: DetailSourceLinksProps) {
  if (!sourceLinks) {
    return null;
  }

  return (
    <div className="skill-detail__source-row" aria-label={`Source links for ${sourceLinks.repoLabel}`}>
      <div className="skill-detail__source-label">
        <FolderGit2 size={14} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="skill-detail__source-links">
        <a
          href={sourceLinks.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="skill-detail__source-link skill-detail__source-link--repo"
        >
          {sourceLinks.repoLabel}
          <ExternalLink size={12} aria-hidden="true" />
        </a>
        {sourceLinks.folderUrl ? (
          <a
            href={sourceLinks.folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="skill-detail__source-link skill-detail__source-link--folder"
          >
            Open Skill Folder
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null}
        {externalUrl ? (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="skill-detail__source-link skill-detail__source-link--external"
          >
            {externalLabel}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
