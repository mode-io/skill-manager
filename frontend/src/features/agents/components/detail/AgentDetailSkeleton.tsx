import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { DetailLoadingChip } from "../../../../components/detail/DetailLoadingChip";
import { DetailSection } from "../../../../components/detail/DetailSection";

interface AgentDetailSkeletonProps {
  onClose: () => void;
}

export function AgentDetailSkeleton({ onClose }: AgentDetailSkeletonProps) {
  return (
    <>
      <div className="skill-detail-shell__chrome">
        <div className="skill-detail__chrome">
          <DetailHeader
            title={<span className="detail-skeleton detail-skeleton--title" aria-hidden="true" />}
            utility={<DetailLoadingChip label="Loading" />}
            closeLabel="Close"
            onClose={onClose}
          />
        </div>
      </div>
      <div
        className="skill-detail-shell__body ui-scrollbar"
        aria-hidden="true"
      >
        <div className="detail-sheet__body">
          <DetailSection heading="About">
            <div className="detail-skeleton-paragraph">
              <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-wide" />
              <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-wide" />
              <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-short" />
            </div>
          </DetailSection>

          <DetailSection heading="Agent definition">
            <div className="skill-detail__document-surface">
              <div className="detail-skeleton-paragraph">
                {Array.from({ length: 8 }).map((_, index) => (
                  <span
                    key={index}
                    className={`detail-skeleton detail-skeleton--line${index < 6 ? " detail-skeleton--line-wide" : ""}`}
                  />
                ))}
              </div>
            </div>
          </DetailSection>

          <DetailSection heading="Locations">
            <div className="detail-skeleton-paragraph">
              <span className="detail-skeleton detail-skeleton--label" />
              <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-wide" />
            </div>
          </DetailSection>
        </div>
      </div>
    </>
  );
}
