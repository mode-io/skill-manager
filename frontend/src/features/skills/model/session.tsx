import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

import {
  resetUnmanagedSkillsFilters,
  resetManagedSkillsFilters,
  type UnmanagedSkillsFilterState,
  type ManagedSkillsFilterState,
} from "./selectors";

type SkillsWorkspaceTab = "managed" | "unmanaged";

interface SkillsWorkspaceSessionContextValue {
  managedFilters: ManagedSkillsFilterState;
  unmanagedFilters: UnmanagedSkillsFilterState;
  managedScrollTop: number | null;
  unmanagedScrollTop: number | null;
  updateManagedFilters: (partial: Partial<ManagedSkillsFilterState>) => void;
  updateUnmanagedFilters: (partial: Partial<UnmanagedSkillsFilterState>) => void;
  resetManagedFilters: () => void;
  resetUnmanagedFilters: () => void;
  setScrollPosition: (tab: SkillsWorkspaceTab, scrollTop: number) => void;
}

const SkillsWorkspaceSessionContext = createContext<SkillsWorkspaceSessionContextValue | null>(null);

export function SkillsWorkspaceSessionProvider({ children }: { children: ReactNode }) {
  const [managedFilters, setManagedFilters] = useState<ManagedSkillsFilterState>(() => resetManagedSkillsFilters());
  const [unmanagedFilters, setUnmanagedFilters] = useState<UnmanagedSkillsFilterState>(() => resetUnmanagedSkillsFilters());
  const [managedScrollTop, setManagedScrollTop] = useState<number | null>(null);
  const [unmanagedScrollTop, setUnmanagedScrollTop] = useState<number | null>(null);

  const updateManagedFilters = useCallback((partial: Partial<ManagedSkillsFilterState>) => {
    setManagedFilters((current) => ({ ...current, ...partial }));
  }, []);

  const updateUnmanagedFilters = useCallback((partial: Partial<UnmanagedSkillsFilterState>) => {
    setUnmanagedFilters((current) => ({ ...current, ...partial }));
  }, []);

  const resetManaged = useCallback(() => {
    setManagedFilters(resetManagedSkillsFilters());
  }, []);

  const resetUnmanaged = useCallback(() => {
    setUnmanagedFilters(resetUnmanagedSkillsFilters());
  }, []);

  const setScrollPosition = useCallback((tab: SkillsWorkspaceTab, scrollTop: number) => {
    if (tab === "managed") {
      setManagedScrollTop(scrollTop);
      return;
    }
    setUnmanagedScrollTop(scrollTop);
  }, []);

  const value = useMemo<SkillsWorkspaceSessionContextValue>(() => ({
    managedFilters,
    unmanagedFilters,
    managedScrollTop,
    unmanagedScrollTop,
    updateManagedFilters,
    updateUnmanagedFilters,
    resetManagedFilters: resetManaged,
    resetUnmanagedFilters: resetUnmanaged,
    setScrollPosition,
  }), [
    unmanagedFilters,
    unmanagedScrollTop,
    managedFilters,
    managedScrollTop,
    resetUnmanaged,
    resetManaged,
    setScrollPosition,
    updateUnmanagedFilters,
    updateManagedFilters,
  ]);

  return (
    <SkillsWorkspaceSessionContext.Provider value={value}>
      {children}
    </SkillsWorkspaceSessionContext.Provider>
  );
}

export function useManagedSkillsSession() {
  const context = useSkillsWorkspaceSession();
  return {
    filters: context.managedFilters,
    updateFilters: context.updateManagedFilters,
    resetFilters: context.resetManagedFilters,
  };
}

export function useUnmanagedSkillsSession() {
  const context = useSkillsWorkspaceSession();
  return {
    filters: context.unmanagedFilters,
    updateFilters: context.updateUnmanagedFilters,
    resetFilters: context.resetUnmanagedFilters,
  };
}

export function useSkillsTabScroll(
  tab: SkillsWorkspaceTab,
  ready: boolean,
  scrollRef: RefObject<HTMLElement | null>,
) {
  const context = useSkillsWorkspaceSession();
  const restoredRef = useRef(false);
  const targetScrollTop = tab === "managed" ? context.managedScrollTop : context.unmanagedScrollTop;

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
