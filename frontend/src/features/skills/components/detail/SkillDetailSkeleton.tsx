import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { DetailLoadingChip } from "../../../../components/detail/DetailLoadingChip";
import { DetailSection } from "../../../../components/detail/DetailSection";
import { useSkillsCopy } from "../../i18n";
import { SkillDetailShell } from "./SkillDetailShell";

interface SkillDetailSkeletonProps {
  onClose: () => void;
}

export function SkillDetailSkeleton({ onClose }: SkillDetailSkeletonProps) {
  const copy = useSkillsCopy();

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
            utility={<DetailLoadingChip label={copy.detail.loading} />}
            closeLabel={copy.detail.close}
            onClose={onClose}
          />
        </div>
      )}
      body={(
        <>
        <DetailSection heading={copy.detail.about}>
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

        <DetailSection heading={copy.detail.locations}>
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
