import { lazy, Suspense, useId, useMemo } from "react";
import { ArrowUpRight, Plus } from "lucide-react";

import { DetailDisclosure } from "../../../components/detail/DetailDisclosure";
import { DetailHeader } from "../../../components/detail/DetailHeader";
import { DetailLoadingChip } from "../../../components/detail/DetailLoadingChip";
import { DetailSourceLinks, type DetailSourceLink } from "../../../components/detail/DetailSourceLinks";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { useMarketplaceDetailQuery, useMarketplaceDocumentQuery } from "../api/queries";
import type { MarketplaceDetailDto, MarketplaceItemDto } from "../api/types";
import { formatMarketplaceInstalls, formatMarketplaceStars } from "../model/formatters";
import { useMarketplaceCopy, type MarketplaceCopy } from "../i18n";
import { MarketplaceDetailPendingDocument, MarketplaceDetailSkeleton } from "./MarketplaceDetailSkeleton";

const MarkdownDocument = lazy(() => import("../../../components/MarkdownDocument"));

interface MarketplaceDetailViewProps {
  itemId: string;
  initialItem: MarketplaceItemDto | null;
  installPending: boolean;
  actionErrorMessage: string;
  onDismissActionError: () => void;
  onClose: () => void;
  onInstall: (item: Pick<MarketplaceItemDto, "id" | "installToken">) => Promise<void>;
  onOpenInstalledSkill: (skillRef: string) => void;
}

export function MarketplaceDetailView({
  itemId,
  initialItem,
  installPending,
  actionErrorMessage,
  onDismissActionError,
  onClose,
  onInstall,
  onOpenInstalledSkill,
}: MarketplaceDetailViewProps) {
  const headingId = useId();
  const copy = useMarketplaceCopy();
  const detailQuery = useMarketplaceDetailQuery(itemId);
  const documentQuery = useMarketplaceDocumentQuery(itemId);
  const detail = detailQuery.data ?? fallbackDetail(initialItem);
  const queryErrorMessage = detailQuery.error instanceof Error ? detailQuery.error.message : "";
  const isInitialPreviewLoading = detailQuery.isPending && !detailQuery.data && Boolean(detail);
  const documentMarkdown = documentQuery.data?.documentMarkdown ?? null;
  const isDocumentLoading = documentQuery.isPending;

  const actionButton = useMemo(() => {
    if (!detail) {
      return undefined;
    }

    if (detail.installation.status === "installed" && detail.installation.installedSkillRef) {
      return (
        <button
          type="button"
          className="action-pill"
          onClick={() => onOpenInstalledSkill(detail.installation.installedSkillRef!)}
          aria-label={copy.detail.skill.openInSkillsAria(detail.name)}
        >
          <ArrowUpRight size={12} aria-hidden="true" />
          {copy.detail.skill.openInSkills}
        </button>
      );
    }

    return (
      <button
        type="button"
        className="action-pill"
        onClick={() => void onInstall(detail)}
        aria-label={copy.detail.skill.installAria(detail.name)}
        data-pending={installPending || undefined}
      >
        {installPending ? (
          <LoadingSpinner size="sm" label={copy.detail.skill.installing(detail.name)} />
        ) : (
          <Plus size={12} aria-hidden="true" />
        )}
        {copy.detail.skill.install}
      </button>
    );
  }, [copy, detail, installPending, onInstall, onOpenInstalledSkill]);

  if (!detail && detailQuery.isPending) {
    return <MarketplaceDetailSkeleton onClose={onClose} />;
  }

  if (!detail) {
    return (
      <>
        <div className="skill-detail__chrome">
          <ErrorBanner message={queryErrorMessage || copy.detail.skill.unableToLoad} />
        </div>
        <div className="skill-detail__body" aria-labelledby={headingId}>
          <div className="skill-detail__fallback">
            <p className="muted-text">{copy.detail.skill.tryReopen}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="skill-detail__chrome">
        <DetailHeader
          title={<h2 id={headingId}>{detail.name}</h2>}
          titleAction={actionButton}
          meta={
            <DetailSourceLinks
              ariaLabel={copy.detail.skill.sourceLinksAria(detail.sourceLinks.repoLabel)}
              links={marketplaceSourceLinks(detail.sourceLinks, copy)}
            />
          }
          utility={
            isInitialPreviewLoading ? (
              <DetailLoadingChip label={copy.detail.skill.loadingPreview} withSpinner />
            ) : undefined
          }
          closeLabel={copy.detail.skill.closePreview}
          onClose={onClose}
        />

        {actionErrorMessage ? (
          <ErrorBanner message={actionErrorMessage} onDismiss={onDismissActionError} />
        ) : null}
        {!actionErrorMessage && queryErrorMessage ? (
          <ErrorBanner message={queryErrorMessage} />
        ) : null}
      </div>

      <div className="skill-detail__body detail-sheet__body" aria-labelledby={headingId}>
        <section className="skill-detail__intro">
          <p className="skill-detail__copy">{detail.description || copy.detail.skill.noDescription}</p>
          <div className="marketplace-detail__stats">
            <span className="marketplace-detail__stat">
              {copy.detail.skill.installs(formatMarketplaceInstalls(detail.installs))}
            </span>
            {detail.stars ? (
              <span className="marketplace-detail__stat">
                {copy.detail.skill.githubStars(formatMarketplaceStars(detail.stars))}
              </span>
            ) : null}
          </div>
        </section>

        {isDocumentLoading ? <MarketplaceDetailPendingDocument /> : null}

        {!isDocumentLoading && documentMarkdown ? (
          <DetailDisclosure
            title="SKILL.md"
            defaultOpen
            className="skill-detail__disclosure skill-detail__disclosure--document"
          >
            <div className="skill-detail__document-surface">
              <Suspense fallback={<LoadingSpinner size="sm" label={copy.detail.skill.loadingDocument} />}>
                <MarkdownDocument markdown={documentMarkdown} />
              </Suspense>
            </div>
          </DetailDisclosure>
        ) : null}
      </div>
    </>
  );
}

function marketplaceSourceLinks(
  sourceLinks: MarketplaceDetailDto["sourceLinks"],
  copy: MarketplaceCopy,
): DetailSourceLink[] {
  const links: DetailSourceLink[] = [
    {
      href: sourceLinks.repoUrl,
      label: sourceLinks.repoLabel,
      kind: "repo",
    },
  ];
  if (sourceLinks.folderUrl) {
    links.push({
      href: sourceLinks.folderUrl,
      label: copy.detail.skill.openSkillFolder,
      kind: "folder",
    });
  }
  links.push({
    href: sourceLinks.skillsDetailUrl,
    label: copy.detail.skill.viewOnSkills,
    kind: "marketplace",
  });
  return links;
}

function fallbackDetail(item: MarketplaceItemDto | null): MarketplaceDetailDto | null {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    description: item.description,
    installs: item.installs,
    stars: item.stars,
    repoLabel: item.repoLabel,
    repoImageUrl: item.repoImageUrl,
    sourceLinks: {
      repoLabel: item.repoLabel,
      repoUrl: item.repoUrl,
      folderUrl: null,
      skillsDetailUrl: item.skillsDetailUrl,
    },
    installation: item.installation,
    installToken: item.installToken,
  };
}
