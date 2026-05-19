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
import { useMarketplaceCopy, type MarketplaceCopy } from "../i18n";
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
  const copy = useMarketplaceCopy();
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
      toast(copy.detail.cli.commandCopied);
      return;
    }
    void navigator.clipboard
      .writeText(value)
      .then(() => toast(copy.detail.cli.commandCopied))
      .catch(() => toast(copy.detail.cli.copyFailed));
  }

  if (!detail && detailQuery.isPending) {
    return (
      <>
        <div className="skill-detail__chrome">
          <DetailHeader
            title={<h2 id={headingId}>{headerName}</h2>}
            meta={<p className="market-card__repo">clis.dev/{headerSlug}</p>}
            closeLabel={copy.detail.cli.closePreview}
            onClose={onClose}
          />
        </div>
        <div className="skill-detail__body" aria-labelledby={headingId}>
          <div className="panel-state">
            <LoadingSpinner label={copy.detail.cli.loadingDetails} />
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
            title={<h2 id={headingId}>{copy.detail.cli.unableTitle}</h2>}
            closeLabel={copy.detail.cli.closePreview}
            onClose={onClose}
          />
          <ErrorBanner message={queryErrorMessage || copy.detail.cli.unableDetail} />
        </div>
        <div className="skill-detail__body" aria-labelledby={headingId}>
          <p className="muted-text">{copy.detail.cli.tryReopen}</p>
        </div>
      </>
    );
  }

  const installCommand = detail.installCommand ?? null;
  const hasSourceMetadata = Boolean(detail.sourceType || detail.vendorName);
  const headerFacts = cliHeaderFacts(detail, stars, copy);
  const sourceLinks = cliSourceLinks({
    marketplaceUrl: headerMarketplaceUrl,
    githubUrl: headerGithubUrl,
    websiteUrl: headerWebsiteUrl,
    copy,
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
                <div className="cli-detail__facts" aria-label={copy.detail.cli.factsAria(headerName)}>
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
                ariaLabel={copy.detail.cli.sourceLinksAria(headerName)}
                links={sourceLinks}
              />
            </div>
          }
          closeLabel={copy.detail.cli.closePreview}
          onClose={onClose}
        />
        {queryErrorMessage ? <ErrorBanner message={queryErrorMessage} /> : null}
      </div>

      <div className="skill-detail__body detail-sheet__body" aria-labelledby={headingId}>
        {installCommand ? (
          <DetailSection heading={copy.detail.cli.installCommandPreview}>
            <div className="mcp-detail__connection-row cli-detail__command-row">
              <code className="mcp-detail__connection-url">{installCommand}</code>
              <button
                type="button"
                className="action-pill mcp-detail__copy"
                onClick={() => handleCopy(installCommand)}
              >
                <Copy size={13} aria-hidden="true" />
                {copy.detail.cli.copy}
              </button>
            </div>
          </DetailSection>
        ) : null}

        <DetailSection heading={copy.detail.cli.about}>
          <p className="mcp-detail__about">
            {detail.description || copy.detail.cli.noDescription}
          </p>
          {detail.longDescription ? (
            <Suspense fallback={<LoadingSpinner size="sm" label={copy.detail.cli.loadingPreview} />}>
              <MarkdownDocument
                markdown={detail.longDescription}
                className="skill-detail__markdown cli-detail__markdown"
              />
            </Suspense>
          ) : null}
        </DetailSection>

        {hasSourceMetadata ? (
          <DetailSection heading={copy.detail.cli.source}>
            <dl className="cli-detail__metadata">
              <MetaRow label={copy.detail.cli.sourceType} value={detail.sourceType ?? null} />
              <MetaRow label={copy.detail.cli.vendor} value={detail.vendorName ?? null} />
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
  copy: MarketplaceCopy,
): CliHeaderFact[] {
  const facts: CliHeaderFact[] = [];
  if (detail.category) {
    facts.push({ label: detail.category });
  }
  if (detail.language) {
    facts.push({ label: detail.language });
  }
  if (detail.isOfficial) {
    facts.push({ label: copy.detail.cli.official, accent: true });
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
    facts.push({ label: copy.detail.cli.stars(formatMarketplaceStars(stars)) });
  }
  return facts;
}

function cliSourceLinks({
  marketplaceUrl,
  githubUrl,
  websiteUrl,
  copy,
}: {
  marketplaceUrl: string;
  githubUrl: string | null;
  websiteUrl: string | null;
  copy: MarketplaceCopy;
}): DetailSourceLink[] {
  const links: DetailSourceLink[] = [];
  if (githubUrl) {
    links.push({
      href: githubUrl,
      label: copy.detail.cli.repo,
      kind: "repo",
    });
  }
  if (websiteUrl) {
    links.push({
      href: websiteUrl,
      label: copy.detail.cli.website,
      kind: "website",
    });
  }
  if (links.length === 0) {
    links.push({
      href: marketplaceUrl,
      label: copy.detail.cli.clisDev,
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
