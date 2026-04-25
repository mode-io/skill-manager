import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { DetailLoadingChip } from "../../../../components/detail/DetailLoadingChip";
import { DetailSection } from "../../../../components/detail/DetailSection";
import { SkillDetailShell } from "./SkillDetailShell";

interface SkillDetailSkeletonProps {
  onClose: () => void;
}

export function SkillDetailSkeleton({ onClose }: SkillDetailSkeletonProps) {
  return (
    <SkillDetailShell
      chrome={(
        <div className="skill-detail__chrome">
          <DetailHeader
            title={<span className="detail-skeleton detail-skeleton--title" aria-hidden="true" />}
            meta={
              <div className="detail-sheet__meta" aria-hidden="true">
                <span className="detail-skeleton detail-skeleton--badge" />
                <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-wide" />
              </div>
            }
            utility={<DetailLoadingChip label="Loading" />}
            closeLabel="Close skill details"
            onClose={onClose}
          />
        </div>
      )}
      body={(
        <>
        <DetailSection heading="About">
          <div className="detail-skeleton-paragraph">
            <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-wide" />
            <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-wide" />
            <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-short" />
          </div>
        </DetailSection>

        <DetailSection heading="SKILL.md">
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
        </>
      )}
      bodyAriaHidden
    />
  );
}
