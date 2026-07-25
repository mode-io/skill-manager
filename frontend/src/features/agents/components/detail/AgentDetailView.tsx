import { useId, useState } from "react";
import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { ErrorBanner } from "../../../../components/ErrorBanner";
import { useAgentDetailQuery } from "../../api/queries";
import { AgentDetailContent } from "./AgentDetailContent";
import { AgentDetailSkeleton } from "./AgentDetailSkeleton";

interface AgentDetailViewProps {
  agentRef: string;
  pendingPerHarnessKeys: ReadonlySet<string>;
  onToggleHarness: (ref: string, harness: string, disable: boolean) => Promise<void>;
  onClose: () => void;
  onEdit: () => void;
}

export function AgentDetailView({
  agentRef,
  pendingPerHarnessKeys,
  onToggleHarness,
  onClose,
  onEdit,
}: AgentDetailViewProps) {
  const fallbackHeadingId = useId();
  const { data: detail, isLoading, error } = useAgentDetailQuery(agentRef);
  
  const queryErrorMessage = error ? (error as any).message || "Failed to load agent" : null;
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  if (isLoading) {
    return <AgentDetailSkeleton onClose={onClose} />;
  }

  if (!detail && queryErrorMessage) {
    return (
      <>
        <div className="skill-detail-shell__chrome">
          <div className="skill-detail__chrome">
            <DetailHeader
              title={<h2 id={fallbackHeadingId}>Unable to load agent</h2>}
              closeLabel="Close"
              onClose={onClose}
            />
            <ErrorBanner message={queryErrorMessage} />
          </div>
        </div>
        <div
          className="skill-detail-shell__body ui-scrollbar"
          aria-labelledby={fallbackHeadingId}
        >
          <div className="detail-sheet__body">
            <div className="skill-detail__fallback">
              <p className="muted-text">Please try again.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!detail) {
    return <AgentDetailSkeleton onClose={onClose} />;
  }

  return (
    <AgentDetailContent
      detail={detail}
      pendingPerHarnessKeys={pendingPerHarnessKeys}
      onToggleHarness={onToggleHarness}
      actionErrorMessage={actionErrorMessage}
      onClose={onClose}
      onDismissActionError={() => setActionErrorMessage(null)}
      onEdit={onEdit}
    />
  );
}
