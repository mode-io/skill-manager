import { lazy, Suspense, useId, useMemo } from "react";

import { DetailDisclosure } from "../../../components/detail/DetailDisclosure";
import { DetailHeader } from "../../../components/detail/DetailHeader";
import { DetailLoadingChip } from "../../../components/detail/DetailLoadingChip";
import { DetailSourceLinks } from "../../../components/detail/DetailSourceLinks";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { useMarketplaceDetailQuery, useMarketplaceDocumentQuery } from "../api/queries";
import type { MarketplaceDetailDto, MarketplaceItemDto } from "../api/types";
import { formatMarketplaceInstalls, formatMarketplaceStars } from "../model/formatters";
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
          className="btn btn-secondary marketplace-detail__action"
          onClick={() => onOpenInstalledSkill(detail.installation.installedSkillRef!)}
        >
          Open in Skills
        </button>
      );
    }

    return (
        <button
          type="button"
          className="btn btn-primary marketplace-detail__action"
          disabled={installPending}
          onClick={() => void onInstall(detail)}
        >
          {installPending ? <LoadingSpinner size="sm" label={`Installing ${detail.name}`} /> : null}
          Install
        </button>
      );
  }, [detail, installPending, onInstall, onOpenInstalledSkill]);

  if (!detail && detailQuery.isPending) {
    return <MarketplaceDetailSkeleton onClose={onClose} />;
  }

  if (!detail) {
    return (
      <>
        <div className="skill-detail__chrome">
          <DetailHeader title={<h2 id={headingId}>Unable to load marketplace skill</h2>} eyebrow="Marketplace skill" onClose={onClose} />
          <ErrorBanner message={queryErrorMessage || "Unable to load marketplace detail."} />
        </div>
        <div className="skill-detail__body" aria-labelledby={headingId}>
          <div className="skill-detail__fallback">
            <p className="muted-text">Try reopening the marketplace item from the grid.</p>
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
              sourceLinks={detail.sourceLinks}
              externalUrl={detail.sourceLinks.skillsDetailUrl}
              externalLabel="View on skills.sh"
            />
          }
          utility={
            isInitialPreviewLoading ? (
              <DetailLoadingChip label="Loading Preview" withSpinner />
            ) : undefined
          }
          eyebrow="Marketplace skill"
          closeLabel="Close marketplace preview"
          onClose={onClose}
        />

        {actionErrorMessage ? (
          <ErrorBanner message={actionErrorMessage} onDismiss={onDismissActionError} />
        ) : null}
        {!actionErrorMessage && queryErrorMessage ? (
          <ErrorBanner message={queryErrorMessage} />
        ) : null}
      </div>

      <div className="skill-detail__body marketplace-detail__body" aria-labelledby={headingId}>
        <section className="skill-detail__intro">
          <p className="skill-detail__copy">{detail.description || "No description available."}</p>
          <div className="marketplace-detail__stats">
            <span className="marketplace-detail__stat">{formatMarketplaceInstalls(detail.installs)} installs</span>
            {detail.stars ? <span className="marketplace-detail__stat">{formatMarketplaceStars(detail.stars)} GitHub stars</span> : null}
          </div>
        </section>

        {isInitialPreviewLoading || isDocumentLoading ? <MarketplaceDetailPendingDocument /> : null}

        {!isInitialPreviewLoading && !isDocumentLoading && documentMarkdown ? (
          <DetailDisclosure
            title="SKILL.md"
            eyebrow="Remote document"
            defaultOpen
            className="skill-detail__disclosure skill-detail__disclosure--document"
          >
            <div className="skill-detail__document-surface">
              <Suspense fallback={<LoadingSpinner size="sm" label="Loading document" />}>
                <MarkdownDocument markdown={documentMarkdown} />
              </Suspense>
            </div>
          </DetailDisclosure>
        ) : null}
      </div>
    </>
  );
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
      repoUrl: `https://github.com/${item.repoLabel}`,
      folderUrl: item.githubFolderUrl,
      skillsDetailUrl: item.skillsDetailUrl,
    },
    installation: item.installation,
    installToken: item.installToken,
  };
}
