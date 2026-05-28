import { useCallback, useEffect, useSyncExternalStore } from "react";

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
  model: string;
  provider: string;
  apiVersion: string;
  maxTokens: number;
  consensusRuns: number;
  awsRegion: string;
  awsProfile: string;
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
    model: item.model,
    provider: item.provider,
    apiVersion: item.apiVersion,
    maxTokens: item.maxTokens,
    consensusRuns: item.consensusRuns,
    awsRegion: item.awsRegion,
    awsProfile: item.awsProfile,
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

interface SkillScanStoreSnapshot {
  scanState: ScanStateMap;
  configs: ScanConfigItem[];
  activeConfigId: number | null;
  llmConfig: LLMScanConfig | null;
  configLoaded: boolean;
}

let scanStoreSnapshot: SkillScanStoreSnapshot = {
  scanState: {},
  configs: [],
  activeConfigId: null,
  llmConfig: null,
  configLoaded: false,
};
let hydratedCachedReports = false;

const scanStoreListeners = new Set<() => void>();

function subscribeToScanStore(listener: () => void): () => void {
  scanStoreListeners.add(listener);
  return () => {
    scanStoreListeners.delete(listener);
  };
}

function getScanStoreSnapshot(): SkillScanStoreSnapshot {
  return scanStoreSnapshot;
}

function updateScanStore(
  updater: (current: SkillScanStoreSnapshot) => SkillScanStoreSnapshot,
): void {
  scanStoreSnapshot = updater(scanStoreSnapshot);
  for (const listener of scanStoreListeners) {
    listener();
  }
}

function hydrateCachedScanReports(): void {
  if (hydratedCachedReports) {
    return;
  }
  hydratedCachedReports = true;
  updateScanStore((current) => ({
    ...current,
    scanState: {
      ...readCachedScanReports(),
      ...current.scanState,
    },
  }));
}

export function useSkillScan() {
  const snapshot = useSyncExternalStore(
    subscribeToScanStore,
    getScanStoreSnapshot,
    getScanStoreSnapshot,
  );

  const refreshConfigs = useCallback(async () => {
    try {
      const resp = await getScanConfigs();
      const active = resp.activeId !== null
        ? resp.configs.find((c) => c.id === resp.activeId)
        : null;
      updateScanStore((current) => ({
        ...current,
        configs: resp.configs,
        activeConfigId: resp.activeId,
        llmConfig: active ? buildConfigFromItem(active) : null,
        configLoaded: true,
      }));
    } catch {
      updateScanStore((current) => ({ ...current, configLoaded: true }));
    }
  }, []);

  useEffect(() => {
    void refreshConfigs();
  }, [refreshConfigs]);

  useEffect(() => {
    hydrateCachedScanReports();
  }, []);

  const getScanState = useCallback(
    (skillRef: string): SkillScanState => snapshot.scanState[skillRef] ?? IDLE_STATE,
    [snapshot.scanState],
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
      if (!snapshot.llmConfig) return;
      updateScanStore((current) => ({
        ...current,
        scanState: {
          ...current.scanState,
          [skillRef]: { status: "scanning", result: null, error: null, completedAt: null },
        },
      }));
      try {
        const result = await scanSkillApi(skillRef, { useLlm: true });
        const completedAt = Date.now();
        cacheScanResult(skillRef, result, completedAt);
        updateScanStore((current) => ({
          ...current,
          scanState: {
            ...current.scanState,
            [skillRef]: { status: "done", result, error: null, completedAt },
          },
        }));
      } catch (e) {
        updateScanStore((current) => ({
          ...current,
          scanState: {
            ...current.scanState,
            [skillRef]: {
              status: "error",
              result: null,
              error: e instanceof Error ? e.message : String(e),
              completedAt: null,
            },
          },
        }));
      }
    },
    [snapshot.llmConfig],
  );

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
    scanState: snapshot.scanState,
    getScanState,
    scanSkill,
    llmConfig: snapshot.llmConfig,
    configs: snapshot.configs,
    activeConfigId: snapshot.activeConfigId,
    addConfig,
    editConfig,
    removeConfig,
    selectConfig,
    validateConfig,
    revealConfigApiKey,
    configLoaded: snapshot.configLoaded,
  };
}
