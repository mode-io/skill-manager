import type { HarnessCellState } from "../../model/types";
import { useEffect, useRef, useState } from "react";

import { SkillDetailSkeleton } from "./SkillDetailSkeleton";
import { SkillDetailView } from "./SkillDetailView";

interface SkillDetailPanelProps {
  isOpen: boolean;
  skillRef: string | null;
  onClose: () => void;
  onManageSkill: (skillRef: string) => Promise<void>;
  onToggleSkill: (skillRef: string, harness: string, currentState: HarnessCellState) => Promise<void>;
  onUpdateSkill: (skillRef: string) => Promise<void>;
  onUnmanageSkill: (skillRef: string) => Promise<void>;
  onDeleteSkill: (skillRef: string) => Promise<void>;
}

export function SkillDetailPanel({
  isOpen,
  skillRef,
  onClose,
  onManageSkill,
  onToggleSkill,
  onUpdateSkill,
  onUnmanageSkill,
  onDeleteSkill,
}: SkillDetailPanelProps) {
  const [panelPhase, setPanelPhase] = useState<"closed" | "opening" | "open" | "closing">(isOpen ? "open" : "closed");
  const [displayedSkillRef, setDisplayedSkillRef] = useState<string | null>(skillRef);
  const detailScrollRef = useRef<HTMLDivElement>(null);
  const previousSkillRef = useRef<string | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (skillRef) {
      setDisplayedSkillRef(skillRef);
    }
  }, [skillRef]);

  useEffect(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }

    if (isOpen) {
      setPanelPhase((current) => {
        if (current === "closed") {
          transitionTimerRef.current = window.setTimeout(() => {
            setPanelPhase("open");
            transitionTimerRef.current = null;
          }, 220);
          return "opening";
        }
        return "open";
      });
      return;
    }

    setPanelPhase((current) => {
      if (current === "closed") {
        setDisplayedSkillRef(null);
        return current;
      }
      transitionTimerRef.current = window.setTimeout(() => {
        setPanelPhase("closed");
        setDisplayedSkillRef(null);
        transitionTimerRef.current = null;
      }, 140);
      return "closing";
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      previousSkillRef.current = displayedSkillRef;
      return;
    }

    if (displayedSkillRef !== previousSkillRef.current && detailScrollRef.current) {
      detailScrollRef.current.scrollTop = 0;
    }

    previousSkillRef.current = displayedSkillRef;
  }, [displayedSkillRef, isOpen]);

  const isPanelMounted = panelPhase !== "closed";
  const isContentVisible = panelPhase === "open";

  return (
    <aside
      className={`skills-detail-panel${isPanelMounted ? " is-open" : ""}${panelPhase !== "closed" ? ` is-${panelPhase}` : ""}`}
      aria-label="Skill details panel"
      aria-hidden={!isPanelMounted}
    >
      <div className="skills-detail-panel__inner ui-scrollbar" ref={detailScrollRef}>
        <div className={`skills-detail-panel__content${isContentVisible ? " is-visible" : ""}`}>
          {isContentVisible && displayedSkillRef ? (
            <SkillDetailView
              skillRef={displayedSkillRef}
              onClose={onClose}
              onManageSkill={onManageSkill}
              onToggleSkill={onToggleSkill}
              onUpdateSkill={onUpdateSkill}
              onUnmanageSkill={onUnmanageSkill}
              onDeleteSkill={onDeleteSkill}
            />
          ) : null}
        </div>
        {isPanelMounted && !isContentVisible && displayedSkillRef ? (
          <div className="skills-detail-panel__placeholder">
            <SkillDetailSkeleton onClose={onClose} />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
