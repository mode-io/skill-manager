import { Link } from "react-router-dom";
import { PageHeader } from "../../../components/PageHeader";

export default function HooksNeedsReviewPage() {
  return (
    <div className="page-chrome">
      <PageHeader
        title="Hooks configs to review"
        subtitle="No local hook config entries need review across your harnesses."
      />
      <div className="empty-panel">
        <h3 className="empty-panel__title">No hooks need review</h3>
        <p className="empty-panel__body">
          Your harness configs only reference hooks that skill-manager already tracks.
        </p>
        <div className="empty-panel__actions">
          <Link to="/hooks/use" className="action-pill action-pill--md action-pill--accent">
            View Hooks in Use
          </Link>
        </div>
      </div>
    </div>
  );
}
