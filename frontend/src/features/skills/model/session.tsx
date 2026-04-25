import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

import {
  resetSkillsNeedsReviewFilters,
  resetSkillsInUseFilters,
  type SkillsNeedsReviewFilterState,
  type SkillsInUseFilterState,
} from "./selectors";

type SkillsWorkspaceTab = "inUse" | "needsReview";

interface SkillsWorkspaceSessionContextValue {
  inUseFilters: SkillsInUseFilterState;
  needsReviewFilters: SkillsNeedsReviewFilterState;
  inUseScrollTop: number | null;
  needsReviewScrollTop: number | null;
  updateInUseFilters: (partial: Partial<SkillsInUseFilterState>) => void;
  updateNeedsReviewFilters: (partial: Partial<SkillsNeedsReviewFilterState>) => void;
  resetInUseFilters: () => void;
  resetNeedsReviewFilters: () => void;
  setScrollPosition: (tab: SkillsWorkspaceTab, scrollTop: number) => void;
}

const SkillsWorkspaceSessionContext = createContext<SkillsWorkspaceSessionContextValue | null>(null);

export function SkillsWorkspaceSessionProvider({ children }: { children: ReactNode }) {
  const [inUseFilters, setInUseFilters] = useState<SkillsInUseFilterState>(() => resetSkillsInUseFilters());
  const [needsReviewFilters, setNeedsReviewFilters] = useState<SkillsNeedsReviewFilterState>(() => resetSkillsNeedsReviewFilters());
  const [inUseScrollTop, setInUseScrollTop] = useState<number | null>(null);
  const [needsReviewScrollTop, setNeedsReviewScrollTop] = useState<number | null>(null);

  const updateInUseFilters = useCallback((partial: Partial<SkillsInUseFilterState>) => {
    setInUseFilters((current) => ({ ...current, ...partial }));
  }, []);

  const updateNeedsReviewFilters = useCallback((partial: Partial<SkillsNeedsReviewFilterState>) => {
    setNeedsReviewFilters((current) => ({ ...current, ...partial }));
  }, []);

  const resetInUse = useCallback(() => {
    setInUseFilters(resetSkillsInUseFilters());
  }, []);

  const resetNeedsReview = useCallback(() => {
    setNeedsReviewFilters(resetSkillsNeedsReviewFilters());
  }, []);

  const setScrollPosition = useCallback((tab: SkillsWorkspaceTab, scrollTop: number) => {
    if (tab === "inUse") {
      setInUseScrollTop(scrollTop);
      return;
    }
    setNeedsReviewScrollTop(scrollTop);
  }, []);

  const value = useMemo<SkillsWorkspaceSessionContextValue>(() => ({
    inUseFilters,
    needsReviewFilters,
    inUseScrollTop,
    needsReviewScrollTop,
    updateInUseFilters,
    updateNeedsReviewFilters,
    resetInUseFilters: resetInUse,
    resetNeedsReviewFilters: resetNeedsReview,
    setScrollPosition,
  }), [
    needsReviewFilters,
    needsReviewScrollTop,
    inUseFilters,
    inUseScrollTop,
    resetNeedsReview,
    resetInUse,
    setScrollPosition,
    updateNeedsReviewFilters,
    updateInUseFilters,
  ]);

  return (
    <SkillsWorkspaceSessionContext.Provider value={value}>
      {children}
    </SkillsWorkspaceSessionContext.Provider>
  );
}

export function useSkillsInUseSession() {
  const context = useSkillsWorkspaceSession();
  return {
    filters: context.inUseFilters,
    updateFilters: context.updateInUseFilters,
    resetFilters: context.resetInUseFilters,
  };
}

export function useSkillsNeedsReviewSession() {
  const context = useSkillsWorkspaceSession();
  return {
    filters: context.needsReviewFilters,
    updateFilters: context.updateNeedsReviewFilters,
    resetFilters: context.resetNeedsReviewFilters,
  };
}

export function useSkillsTabScroll(
  tab: SkillsWorkspaceTab,
  ready: boolean,
  scrollRef: RefObject<HTMLElement | null>,
) {
  const context = useSkillsWorkspaceSession();
  const restoredRef = useRef(false);
  const targetScrollTop = tab === "inUse" ? context.inUseScrollTop : context.needsReviewScrollTop;

  useLayoutEffect(() => {
    if (!ready || restoredRef.current || targetScrollTop === null) {
      return;
    }
    if (!scrollRef.current) {
      return;
    }
    restoredRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: targetScrollTop, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ready, scrollRef, targetScrollTop]);

  useLayoutEffect(() => {
    restoredRef.current = false;
  }, [tab]);

  useLayoutEffect(() => {
    return () => {
      const nextScrollTop = scrollRef.current?.scrollTop ?? 0;
      context.setScrollPosition(tab, nextScrollTop);
    };
  }, [context, scrollRef, tab]);
}

function useSkillsWorkspaceSession(): SkillsWorkspaceSessionContextValue {
  const context = useContext(SkillsWorkspaceSessionContext);
  if (!context) {
    throw new Error("Skills workspace session context is not available.");
  }
  return context;
}
