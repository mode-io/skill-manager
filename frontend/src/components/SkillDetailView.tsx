import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { useSkillDetailQuery } from "../features/skills/queries";
import { ErrorBanner } from "./ErrorBanner";
import { SkillDetailContent } from "./SkillDetailContent";
import { SkillDetailSkeleton } from "./SkillDetailSkeleton";

interface SkillDetailViewProps {
  skillRef: string;
  onClose: () => void;
  onManageSkill: (skillRef: string) => Promise<void>;
  onUpdateSkill: (skillRef: string) => Promise<void>;
}

export function SkillDetailView({
  skillRef,
  onClose,
  onManageSkill,
  onUpdateSkill,
}: SkillDetailViewProps) {
  const detailQuery = useSkillDetailQuery(skillRef);
  const [actionErrorMessage, setActionErrorMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const detail = detailQuery.data ?? null;
  const isInitialLoading = detailQuery.isPending && detail === null;
  const isRefreshing = detailQuery.isFetching && detail !== null;
  const queryErrorMessage = detailQuery.error instanceof Error ? detailQuery.error.message : "";

  useEffect(() => {
    setActionErrorMessage("");
    setBusyAction(null);
  }, [skillRef]);

  async function runAction(actionKey: string, task: () => Promise<unknown>): Promise<void> {
    try {
      setBusyAction(actionKey);
      setActionErrorMessage("");
      await task();
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "Unable to complete the action.");
    } finally {
      setBusyAction(null);
    }
  }

  if (isInitialLoading) {
    return <SkillDetailSkeleton onClose={onClose} />;
  }

  if (!detail && queryErrorMessage) {
    return (
      <>
        <div className="skill-detail__chrome">
          <div className="skill-detail__header">
            <div className="skill-detail__heading-block">
              <p className="skill-detail__eyebrow">Skill details</p>
              <h2>Unable to load skill</h2>
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close skill details">
              <X size={18} />
            </button>
          </div>
          <ErrorBanner message={queryErrorMessage} />
        </div>
        <div className="skill-detail__body">
          <div className="skill-detail__fallback">
            <p className="muted-text">Try selecting the skill again, or return to the list and reopen it.</p>
          </div>
        </div>
      </>
    );
  }

  if (!detail) {
    return <SkillDetailSkeleton onClose={onClose} />;
  }

  return (
    <SkillDetailContent
      detail={detail}
      isRefreshing={isRefreshing}
      actionErrorMessage={actionErrorMessage}
      queryErrorMessage={queryErrorMessage}
      busyAction={busyAction}
      onClose={onClose}
      onDismissActionError={() => setActionErrorMessage("")}
      onManage={() => void runAction("manage", () => onManageSkill(detail.skillRef))}
      onUpdate={() => void runAction("update", () => onUpdateSkill(detail.skillRef))}
    />
  );
}
