import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ScanResult } from "../api/scan-types";
import { useSkillScan } from "./use-skill-scan";

const scanClient = vi.hoisted(() => ({
  scanSkill: vi.fn(),
  getScanConfigs: vi.fn(),
  createScanConfig: vi.fn(),
  updateScanConfig: vi.fn(),
  deleteScanConfig: vi.fn(),
  setActiveScanConfig: vi.fn(),
  validateScanConfig: vi.fn(),
  revealScanConfigApiKey: vi.fn(),
}));

vi.mock("../api/scan-client", () => scanClient);

const scanResult: ScanResult = {
  skillName: "Trace Lens",
  isSafe: true,
  maxSeverity: "SAFE",
  findingsCount: 0,
  findings: [],
  analyzersUsed: ["llm_analyzer"],
  durationSeconds: 1.2,
};

describe("useSkillScan", () => {
  beforeEach(() => {
    window.localStorage.clear();
    scanClient.scanSkill.mockReset();
    scanClient.getScanConfigs.mockReset();
    scanClient.createScanConfig.mockReset();
    scanClient.updateScanConfig.mockReset();
    scanClient.deleteScanConfig.mockReset();
    scanClient.setActiveScanConfig.mockReset();
    scanClient.validateScanConfig.mockReset();
    scanClient.revealScanConfigApiKey.mockReset();
    scanClient.getScanConfigs.mockResolvedValue({
      activeId: 1,
      configs: [
        {
          id: 1,
          name: "Default",
          baseUrl: "https://api.example.com/v1",
          apiKeyMasked: "sk-t...cret",
          model: "model-a",
          provider: "openai-compatible",
          apiVersion: "",
          awsRegion: "",
          awsProfile: "",
          maxTokens: 8192,
          consensusRuns: 1,
          isActive: true,
          lastValidatedAt: null,
          lastValidationError: "",
        },
      ],
    });
  });

  it("keeps an in-flight scan alive when the consuming page unmounts", async () => {
    let resolveScan: (result: ScanResult) => void = () => undefined;
    scanClient.scanSkill.mockReturnValue(new Promise<ScanResult>((resolve) => {
      resolveScan = resolve;
    }));

    const first = renderHook(() => useSkillScan());
    await waitFor(() => expect(first.result.current.llmConfig?.id).toBe(1));

    let pendingScan: Promise<void> = Promise.resolve();
    act(() => {
      pendingScan = first.result.current.scanSkill("shared:trace-lens");
    });
    await waitFor(() => {
      expect(first.result.current.getScanState("shared:trace-lens").status).toBe("scanning");
    });

    first.unmount();
    await act(async () => {
      resolveScan(scanResult);
      await pendingScan;
    });

    const second = renderHook(() => useSkillScan());
    await waitFor(() => {
      expect(second.result.current.getScanState("shared:trace-lens").status).toBe("done");
    });
    expect(second.result.current.getScanState("shared:trace-lens").result?.skillName).toBe("Trace Lens");
  });
});
