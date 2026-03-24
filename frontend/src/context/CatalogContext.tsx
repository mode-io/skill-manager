import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import * as api from "../api/client";
import type { CatalogEntrySummary, CheckReport, HarnessSummary, SkillListing } from "../api/types";

interface CatalogState {
  status: "loading" | "ready" | "error";
  errorMessage: string;
  harnesses: HarnessSummary[];
  catalog: CatalogEntrySummary[];
  check: CheckReport;
}

export interface CatalogContextValue extends CatalogState {
  refresh: () => Promise<void>;
  toggleBinding: (skillRef: string, action: "enable" | "disable", harness: string) => Promise<void>;
  centralizeSkill: (skillRef: string) => Promise<void>;
  centralizeAll: () => Promise<{ centralized: number; skipped: number }>;
  updateSkill: (skillRef: string) => Promise<void>;
  installSkill: (sourceKind: string, sourceLocator: string) => Promise<void>;
  searchSources: (query: string) => Promise<SkillListing[]>;
}

const DEFAULT_CHECK: CheckReport = { status: "ok", issues: [], warnings: [], counts: {} };

export const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<CatalogState>({
    status: "loading", errorMessage: "", harnesses: [], catalog: [], check: DEFAULT_CHECK,
  });

  const refresh = useCallback(async () => {
    try {
      const data = await api.fetchControlPlaneSummary();
      setState({ status: "ready", errorMessage: "", harnesses: data.harnesses, catalog: data.catalog, check: data.check });
    } catch (e) {
      setState(prev => ({ ...prev, status: "error", errorMessage: e instanceof Error ? e.message : "unknown error" }));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleBinding = useCallback(async (skillRef: string, action: "enable" | "disable", harness: string) => {
    await api.toggleBinding(skillRef, action, harness);
    await refresh();
  }, [refresh]);

  const centralizeSkill = useCallback(async (skillRef: string) => {
    await api.centralizeSkill(skillRef);
    await refresh();
  }, [refresh]);

  const centralizeAllFn = useCallback(async () => {
    const result = await api.centralizeAll();
    await refresh();
    return { centralized: result.centralized.length, skipped: result.skipped.length };
  }, [refresh]);

  const updateSkill = useCallback(async (skillRef: string) => {
    await api.updateSkill(skillRef);
    await refresh();
  }, [refresh]);

  const installSkill = useCallback(async (sourceKind: string, sourceLocator: string) => {
    await api.installSkill(sourceKind, sourceLocator);
    await refresh();
  }, [refresh]);

  const searchSources = useCallback(async (query: string) => {
    return api.searchSources(query);
  }, []);

  const value: CatalogContextValue = {
    ...state, refresh, toggleBinding, centralizeSkill, centralizeAll: centralizeAllFn,
    updateSkill, installSkill, searchSources,
  };

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
