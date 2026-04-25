import { DetailHeader } from "../../../components/detail/DetailHeader";
import { DetailLoadingChip } from "../../../components/detail/DetailLoadingChip";

interface MarketplaceDetailSkeletonProps {
  onClose: () => void;
}

export function MarketplaceDetailSkeleton({ onClose }: MarketplaceDetailSkeletonProps) {
  return (
    <>
      <div className="skill-detail__chrome">
        <DetailHeader
          title={<span className="detail-skeleton detail-skeleton--title" aria-hidden="true" />}
          meta={<span className="detail-skeleton detail-skeleton--subtitle" aria-hidden="true" />}
          utility={<DetailLoadingChip label="Loading Preview" withSpinner />}
          closeLabel="Close marketplace preview"
          onClose={onClose}
        />
      </div>

      <div className="skill-detail__body detail-sheet__body detail-sheet__body--loading" aria-hidden="true">
        <section className="skill-detail__intro skill-detail__intro--skeleton">
          <div className="detail-skeleton-paragraph">
            <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-wide" />
            <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-wide" />
            <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-short" />
          </div>

          <div className="marketplace-detail__stats marketplace-detail__stats--skeleton">
            <span className="detail-skeleton detail-skeleton--badge" />
            <span className="detail-skeleton detail-skeleton--badge" />
          </div>
        </section>

        <MarketplaceDetailPendingDocument />
      </div>
    </>
  );
}

export function MarketplaceDetailPendingDocument() {
  return (
    <section
      className="skill-detail__disclosure skill-detail__disclosure--document is-open marketplace-detail__pending-document"
      aria-hidden="true"
    >
      <div className="skill-detail-disclosure__trigger">
        <span className="skill-detail-disclosure__heading">
          <span className="skill-detail-disclosure__title">SKILL.md</span>
        </span>
      </div>
      <div className="skill-detail-disclosure__frame">
        <div className="skill-detail-disclosure__body">
          <div className="skill-detail__document-surface">
            <div className="detail-skeleton-paragraph">
              {Array.from({ length: 7 }).map((_, index) => (
                <span
                  key={index}
                  className={`detail-skeleton detail-skeleton--line${index < 5 ? " detail-skeleton--line-wide" : ""}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
