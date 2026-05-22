import { useState, useCallback, useEffect } from "react";

import type { ScanResult, ScanConfigItem } from "../api/scan-types";
import {
  scanSkill as scanSkillApi,
  getScanConfigs,
  createScanConfig,
  updateScanConfig,
  deleteScanConfig as deleteScanConfigApi,
  setActiveScanConfig,
  validateScanConfig,
  revealScanConfigApiKey,
} from "../api/scan-client";

export type ScanStatus = "idle" | "scanning" | "done" | "error";

export interface SkillScanState {
  status: ScanStatus;
  result: ScanResult | null;
  error: string | null;
  completedAt: number | null;
}

export interface ScanStateMap {
  [skillRef: string]: SkillScanState;
}

export interface LLMScanConfig {
  id: number;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  provider: string;
  apiVersion: string;
  maxTokens: number;
  consensusRuns: number;
  awsRegion: string;
  awsProfile: string;
  awsSessionToken: string;
}

const IDLE_STATE: SkillScanState = { status: "idle", result: null, error: null, completedAt: null };
const SCAN_REPORT_CACHE_KEY = "skillmgr.securityReport.cache.v1";

interface CachedScanReport {
  savedAt: number;
  result: ScanResult;
}

type CachedScanReportMap = Record<string, CachedScanReport>;

function readCachedScanReportEntries(): CachedScanReportMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SCAN_REPORT_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CachedScanReportMap;
    const next: CachedScanReportMap = {};
    let changed = false;
    for (const [skillRef, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry.savedAt !== "number" || !entry.result) {
        changed = true;
        continue;
      }
      next[skillRef] = entry;
    }
    if (changed) {
      writeCachedScanReportEntries(next);
    }
    return next;
  } catch {
    window.localStorage.removeItem(SCAN_REPORT_CACHE_KEY);
    return {};
  }
}

function readCachedScanReports(): ScanStateMap {
  const entries = readCachedScanReportEntries();
  const next: ScanStateMap = {};
  for (const [skillRef, entry] of Object.entries(entries)) {
    next[skillRef] = { status: "done", result: entry.result, error: null, completedAt: entry.savedAt };
  }
  return next;
}

function writeCachedScanReportEntries(cache: CachedScanReportMap): void {
  if (typeof window === "undefined") return;
  if (Object.keys(cache).length === 0) {
    window.localStorage.removeItem(SCAN_REPORT_CACHE_KEY);
    return;
  }
  window.localStorage.setItem(SCAN_REPORT_CACHE_KEY, JSON.stringify(cache));
}

function cacheScanResult(skillRef: string, result: ScanResult, savedAt = Date.now()): void {
  const cached = readCachedScanReportEntries();
  writeCachedScanReportEntries({
    ...cached,
    [skillRef]: { savedAt, result },
  });
}

function buildConfigFromItem(item: ScanConfigItem): LLMScanConfig {
  return {
    id: item.id,
    name: item.name,
    baseUrl: item.baseUrl,
    apiKey: "",
    model: item.model,
    provider: item.provider,
    apiVersion: item.apiVersion,
    maxTokens: item.maxTokens,
    consensusRuns: item.consensusRuns,
    awsRegion: item.awsRegion,
    awsProfile: item.awsProfile,
    awsSessionToken: "",
  };
}

export interface LLMScanConfigInput {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  provider?: string;
  apiVersion?: string;
  maxTokens?: number;
  consensusRuns?: number;
  awsRegion?: string;
  awsProfile?: string;
  awsSessionToken?: string;
}

export function useSkillScan() {
  const [scanState, setScanState] = useState<ScanStateMap>({});
  const [configs, setConfigs] = useState<ScanConfigItem[]>([]);
  const [activeConfigId, setActiveConfigIdState] = useState<number | null>(null);
  const [llmConfig, setLlmConfigState] = useState<LLMScanConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  const refreshConfigs = useCallback(async () => {
    try {
      const resp = await getScanConfigs();
      setConfigs(resp.configs);
      setActiveConfigIdState(resp.activeId);

      if (resp.activeId !== null) {
        const active = resp.configs.find((c) => c.id === resp.activeId);
        if (active) {
          setLlmConfigState(buildConfigFromItem(active));
        }
      } else {
        setLlmConfigState(null);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshConfigs().finally(() => setConfigLoaded(true));
  }, [refreshConfigs]);

  useEffect(() => {
    setScanState((current) => ({
      ...readCachedScanReports(),
      ...current,
    }));
  }, []);

  const getScanState = useCallback(
    (skillRef: string): SkillScanState => scanState[skillRef] ?? IDLE_STATE,
    [scanState],
  );

  const addConfig = useCallback(
    async (config: LLMScanConfigInput) => {
      const item = await createScanConfig({
        name: config.name,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        provider: config.provider,
        apiVersion: config.apiVersion,
        maxTokens: config.maxTokens,
        consensusRuns: config.consensusRuns,
        awsRegion: config.awsRegion,
        awsProfile: config.awsProfile,
        awsSessionToken: config.awsSessionToken,
      });
      await refreshConfigs();
      return item;
    },
    [refreshConfigs],
  );

  const editConfig = useCallback(
    async (
      id: number,
      config: LLMScanConfigInput,
    ) => {
      await updateScanConfig(id, {
        name: config.name,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        provider: config.provider,
        apiVersion: config.apiVersion,
        maxTokens: config.maxTokens,
        consensusRuns: config.consensusRuns,
        awsRegion: config.awsRegion,
        awsProfile: config.awsProfile,
        awsSessionToken: config.awsSessionToken,
      });
      await refreshConfigs();
    },
    [refreshConfigs],
  );

  const removeConfig = useCallback(
    async (id: number) => {
      await deleteScanConfigApi(id);
      await refreshConfigs();
    },
    [refreshConfigs],
  );

  const selectConfig = useCallback(
    async (id: number) => {
      await setActiveScanConfig(id);
      await refreshConfigs();
    },
    [refreshConfigs],
  );

  const scanSkill = useCallback(
    async (skillRef: string) => {
      if (!llmConfig) return;
      setScanState((prev) => ({
        ...prev,
        [skillRef]: { status: "scanning", result: null, error: null, completedAt: null },
      }));
      try {
        const result = await scanSkillApi(skillRef, { useLlm: true });
        const completedAt = Date.now();
        cacheScanResult(skillRef, result, completedAt);
        setScanState((prev) => ({
          ...prev,
          [skillRef]: { status: "done", result, error: null, completedAt },
        }));
      } catch (e) {
        setScanState((prev) => ({
          ...prev,
          [skillRef]: { status: "error", result: null, error: e instanceof Error ? e.message : String(e), completedAt: null },
        }));
      }
    },
    [llmConfig],
  );

  const clearScan = useCallback((skillRef: string) => {
    setScanState((prev) => {
      const next = { ...prev };
      delete next[skillRef];
      const cache = readCachedScanReportEntries();
      delete cache[skillRef];
      writeCachedScanReportEntries(cache);
      return next;
    });
  }, []);

  const validateConfig = useCallback(
    async (config: LLMScanConfigInput & { existingConfigId?: number }) => validateScanConfig(config),
    [],
  );

  const revealConfigApiKey = useCallback(
    async (id: number) => {
      const result = await revealScanConfigApiKey(id);
      return result.apiKey;
    },
    [],
  );

  return {
    scanState,
    getScanState,
    scanSkill,
    clearScan,
    llmConfig,
    configs,
    activeConfigId,
    addConfig,
    editConfig,
    removeConfig,
    selectConfig,
    validateConfig,
    revealConfigApiKey,
    configLoaded,
  };
}
