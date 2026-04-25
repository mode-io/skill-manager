import { Fragment, lazy, Suspense, useId, useState } from "react";
import { CheckCircle2, Copy, TerminalSquare } from "lucide-react";

import { DetailHeader } from "../../../components/detail/DetailHeader";
import { DetailSection } from "../../../components/detail/DetailSection";
import { DetailSourceLinks, type DetailSourceLink } from "../../../components/detail/DetailSourceLinks";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { useToast } from "../../../components/Toast";
import { useCliMarketplaceDetailQuery } from "../api/cli-queries";
import type { CliMarketplaceItemDto } from "../api/cli-types";
import { formatMarketplaceStars } from "../model/formatters";

const MarkdownDocument = lazy(() => import("../../../components/MarkdownDocument"));

interface CliMarketplaceDetailViewProps {
  itemId: string;
  initialItem: CliMarketplaceItemDto | null;
  onClose: () => void;
}

export function CliMarketplaceDetailView({
  itemId,
  initialItem,
  onClose,
}: CliMarketplaceDetailViewProps) {
  const headingId = useId();
  const detailQuery = useCliMarketplaceDetailQuery(itemId);
  const detail = detailQuery.data ?? null;
  const { toast } = useToast();
  const queryErrorMessage =
    detailQuery.error instanceof Error ? detailQuery.error.message : "";

  const headerName = detail?.name ?? initialItem?.name ?? itemId;
  const headerSlug = detail?.slug ?? initialItem?.slug ?? itemId.replace(/^clisdev:/, "");
  const headerMarketplaceUrl =
    detail?.marketplaceUrl ?? initialItem?.marketplaceUrl ?? `https://clis.dev/cli/${headerSlug}`;
  const headerGithubUrl = detail?.githubUrl ?? initialItem?.githubUrl ?? null;
  const headerWebsiteUrl = detail?.websiteUrl ?? initialItem?.websiteUrl ?? null;
  const headerIconUrl = detail?.iconUrl ?? initialItem?.iconUrl ?? null;
  const stars = detail?.stars ?? initialItem?.stars ?? null;
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarSrc = headerIconUrl && !avatarFailed ? headerIconUrl : null;

  function handleCopy(value: string): void {
    if (!navigator.clipboard?.writeText) {
      toast("Command copied");
      return;
    }
    void navigator.clipboard
      .writeText(value)
      .then(() => toast("Command copied"))
      .catch(() => toast("Copy failed"));
  }

  if (!detail && detailQuery.isPending) {
    return (
      <>
        <div className="skill-detail__chrome">
          <DetailHeader
            title={<h2 id={headingId}>{headerName}</h2>}
            meta={<p className="market-card__repo">clis.dev/{headerSlug}</p>}
            closeLabel="Close CLI preview"
            onClose={onClose}
          />
        </div>
        <div className="skill-detail__body" aria-labelledby={headingId}>
          <div className="panel-state">
            <LoadingSpinner label="Loading CLI details" />
          </div>
        </div>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <div className="skill-detail__chrome">
          <DetailHeader
            title={<h2 id={headingId}>Unable to load CLI</h2>}
            closeLabel="Close CLI preview"
            onClose={onClose}
          />
          <ErrorBanner message={queryErrorMessage || "Unable to load CLI detail."} />
        </div>
        <div className="skill-detail__body" aria-labelledby={headingId}>
          <p className="muted-text">Try reopening the CLI from the marketplace grid.</p>
        </div>
      </>
    );
  }

  const installCommand = detail.installCommand ?? null;
  const hasSourceMetadata = Boolean(detail.sourceType || detail.vendorName);
  const headerFacts = cliHeaderFacts(detail, stars);
  const sourceLinks = cliSourceLinks({
    marketplaceUrl: headerMarketplaceUrl,
    githubUrl: headerGithubUrl,
    websiteUrl: headerWebsiteUrl,
  });

  return (
    <>
      <div className="skill-detail__chrome">
        <DetailHeader
          title={
            <div className="cli-detail__title-heading">
              <span className="cli-detail__title-avatar" aria-hidden="true">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt=""
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <>
                    <TerminalSquare size={20} />
                    <span>{avatarFallbackLabel(headerName)}</span>
                  </>
                )}
              </span>
              <span className="cli-detail__title-copy">
                <h2 id={headingId}>{headerName}</h2>
                <code>clis.dev/{headerSlug}</code>
              </span>
            </div>
          }
          meta={
            <div className="cli-detail__meta-stack">
              {headerFacts.length > 0 ? (
                <div className="cli-detail__facts" aria-label={`CLI facts for ${headerName}`}>
                  {headerFacts.map((fact, index) => (
                    <Fragment key={`${fact.label}:${index}`}>
                      {index > 0 ? (
                        <span className="cli-detail__fact-separator" aria-hidden="true">
                          ·
                        </span>
                      ) : null}
                      <span
                        className={`cli-detail__fact${fact.accent ? " cli-detail__fact--accent" : ""}`}
                      >
                        {fact.accent ? <CheckCircle2 size={13} aria-hidden="true" /> : null}
                        {fact.label}
                      </span>
                    </Fragment>
                  ))}
                </div>
              ) : null}
              <DetailSourceLinks
                ariaLabel={`Source links for ${headerName}`}
                links={sourceLinks}
              />
            </div>
          }
          closeLabel="Close CLI preview"
          onClose={onClose}
        />
        {queryErrorMessage ? <ErrorBanner message={queryErrorMessage} /> : null}
      </div>

      <div className="skill-detail__body detail-sheet__body" aria-labelledby={headingId}>
        {installCommand ? (
          <DetailSection heading="Install command preview">
            <div className="mcp-detail__connection-row cli-detail__command-row">
              <code className="mcp-detail__connection-url">{installCommand}</code>
              <button
                type="button"
                className="action-pill mcp-detail__copy"
                onClick={() => handleCopy(installCommand)}
              >
                <Copy size={13} aria-hidden="true" />
                Copy
              </button>
            </div>
          </DetailSection>
        ) : null}

        <DetailSection heading="About">
          <p className="mcp-detail__about">
            {detail.description || "No description provided."}
          </p>
          {detail.longDescription ? (
            <Suspense fallback={<LoadingSpinner size="sm" label="Loading CLI preview" />}>
              <MarkdownDocument
                markdown={detail.longDescription}
                className="skill-detail__markdown cli-detail__markdown"
              />
            </Suspense>
          ) : null}
        </DetailSection>

        {hasSourceMetadata ? (
          <DetailSection heading="Source">
            <dl className="cli-detail__metadata">
              <MetaRow label="Source type" value={detail.sourceType ?? null} />
              <MetaRow label="Vendor" value={detail.vendorName ?? null} />
            </dl>
          </DetailSection>
        ) : null}
      </div>
    </>
  );
}

function avatarFallbackLabel(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

interface CliHeaderFact {
  label: string;
  accent?: boolean;
}

function cliHeaderFacts(
  detail: CliMarketplaceItemDto,
  stars: number | null,
): CliHeaderFact[] {
  const facts: CliHeaderFact[] = [];
  if (detail.category) {
    facts.push({ label: detail.category });
  }
  if (detail.language) {
    facts.push({ label: detail.language });
  }
  if (detail.isOfficial) {
    facts.push({ label: "Official", accent: true });
  }
  if (detail.isTui) {
    facts.push({ label: "TUI" });
  }
  if (detail.hasMcp) {
    facts.push({ label: "MCP" });
  }
  if (detail.hasSkill) {
    facts.push({ label: "Skill" });
  }
  if (stars != null) {
    facts.push({ label: `${formatMarketplaceStars(stars)} stars` });
  }
  return facts;
}

function cliSourceLinks({
  marketplaceUrl,
  githubUrl,
  websiteUrl,
}: {
  marketplaceUrl: string;
  githubUrl: string | null;
  websiteUrl: string | null;
}): DetailSourceLink[] {
  const links: DetailSourceLink[] = [];
  if (githubUrl) {
    links.push({
      href: githubUrl,
      label: "Repo",
      kind: "repo",
    });
  }
  if (websiteUrl) {
    links.push({
      href: websiteUrl,
      label: "Website",
      kind: "website",
    });
  }
  if (links.length === 0) {
    links.push({
      href: marketplaceUrl,
      label: "CLIs.dev",
      kind: "marketplace",
    });
  }
  return links;
}

function MetaRow({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
