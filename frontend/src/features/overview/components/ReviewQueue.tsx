import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

import type { OverviewReviewItem } from "../../../app/capability-registry";
import { useOverviewCopy } from "../i18n";

interface ReviewQueueProps {
  items: OverviewReviewItem[];
  loading: boolean;
}

export function ReviewQueue({ items, loading }: ReviewQueueProps) {
  const copy = useOverviewCopy();

  return (
    <section className="overview-review-queue" aria-labelledby="overview-review-title">
      <div className="overview-section__head">
        <h2 id="overview-review-title">{copy.sections.review}</h2>
      </div>
      {loading ? (
        <div className="overview-review-list" aria-hidden="true">
          <div className="overview-review-row overview-review-row--skeleton" />
          <div className="overview-review-row overview-review-row--skeleton" />
        </div>
      ) : items.length > 0 ? (
        <div className="overview-review-list">
          {items.map((item) => (
            <Link key={item.key} to={item.to} className="overview-review-row" data-tone={item.tone}>
              <span className="overview-review-row__count">{item.count}</span>
              <span className="overview-review-row__copy">
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overview-review-empty">
          <CheckCircle2 size={18} />
          <span>{copy.sections.noReviewWaiting}</span>
        </div>
      )}
    </section>
  );
}
