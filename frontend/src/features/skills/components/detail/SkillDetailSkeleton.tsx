import { SkillDetailHeader } from "./SkillDetailHeader";

interface SkillDetailSkeletonProps {
  onClose: () => void;
}

export function SkillDetailSkeleton({ onClose }: SkillDetailSkeletonProps) {
  return (
    <>
      <div className="skill-detail__chrome">
        <SkillDetailHeader
          title={<span className="skill-detail__skeleton skill-detail__skeleton--title" aria-hidden="true" />}
          meta={<span className="skill-detail__skeleton skill-detail__skeleton--subtitle" aria-hidden="true" />}
          utility={<span className="skill-detail__loading-chip">Loading</span>}
          onClose={onClose}
        />

        <section className="skill-detail__status" aria-hidden="true">
          <span className="skill-detail__skeleton skill-detail__skeleton--badge" />
          <span className="skill-detail__skeleton skill-detail__skeleton--line" />
          <span className="skill-detail__skeleton skill-detail__skeleton--line skill-detail__skeleton--line-wide" />
        </section>

        <div className="skill-detail__primary-actions" aria-hidden="true">
          <div className="skill-detail__actions">
            <span className="skill-detail__skeleton skill-detail__skeleton--button" />
            <span className="skill-detail__skeleton skill-detail__skeleton--button skill-detail__skeleton--button-secondary" />
          </div>
        </div>
      </div>

      <div className="skill-detail__body skill-detail__body--skeleton" aria-hidden="true">
        <section className="skill-detail__intro skill-detail__intro--skeleton">
          <div className="skill-detail__paragraph-skeleton">
            <span className="skill-detail__skeleton skill-detail__skeleton--line skill-detail__skeleton--line-wide" />
            <span className="skill-detail__skeleton skill-detail__skeleton--line skill-detail__skeleton--line-wide" />
            <span className="skill-detail__skeleton skill-detail__skeleton--line skill-detail__skeleton--line-short" />
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
            <div className="skill-detail__paragraph-skeleton">
              {Array.from({ length: 8 }).map((_, index) => (
                <span
                  key={index}
                  className={`skill-detail__skeleton skill-detail__skeleton--line${index < 6 ? " skill-detail__skeleton--line-wide" : ""}`}
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
          <div className="skill-detail__paragraph-skeleton">
            <span className="skill-detail__skeleton skill-detail__skeleton--label" />
            <span className="skill-detail__skeleton skill-detail__skeleton--line skill-detail__skeleton--line-wide" />
          </div>
        </section>
      </div>
    </>
  );
}
