import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { DetailLoadingChip } from "../../../../components/detail/DetailLoadingChip";

interface SkillDetailSkeletonProps {
  onClose: () => void;
}

export function SkillDetailSkeleton({ onClose }: SkillDetailSkeletonProps) {
  return (
    <>
      <div className="skill-detail__chrome">
        <DetailHeader
          title={<span className="detail-skeleton detail-skeleton--title" aria-hidden="true" />}
          meta={<span className="detail-skeleton detail-skeleton--subtitle" aria-hidden="true" />}
          utility={<DetailLoadingChip label="Loading" />}
          closeLabel="Close skill details"
          onClose={onClose}
        />

        <section className="skill-detail__status" aria-hidden="true">
          <span className="detail-skeleton detail-skeleton--badge" />
          <span className="detail-skeleton detail-skeleton--line" />
          <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-wide" />
        </section>

        <div className="skill-detail__primary-actions" aria-hidden="true">
          <div className="skill-detail__actions">
            <span className="detail-skeleton detail-skeleton--button" />
            <span className="detail-skeleton detail-skeleton--button detail-skeleton--button-secondary" />
          </div>
        </div>
      </div>

      <div className="skill-detail__body skill-detail__body--skeleton" aria-hidden="true">
        <section className="skill-detail__intro skill-detail__intro--skeleton">
          <div className="detail-skeleton-paragraph">
            <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-wide" />
            <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-wide" />
            <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-short" />
          </div>
        </section>

        <section className="skill-detail__disclosure skill-detail__disclosure--document is-open">
          <div className="skill-detail-disclosure__trigger">
            <span className="skill-detail-disclosure__heading">
              <span className="skill-detail-disclosure__eyebrow">Primary document</span>
              <span className="skill-detail-disclosure__title">SKILL.md</span>
            </span>
          </div>
          <div className="skill-detail-disclosure__frame">
            <div className="skill-detail-disclosure__body">
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
            </div>
          </div>
        </section>

        <section className="skill-detail__context">
          <div className="skill-detail__context-heading">
            <h3>Locations</h3>
          </div>
          <div className="detail-skeleton-paragraph">
            <span className="detail-skeleton detail-skeleton--label" />
            <span className="detail-skeleton detail-skeleton--line detail-skeleton--line-wide" />
          </div>
        </section>
      </div>
    </>
  );
}
