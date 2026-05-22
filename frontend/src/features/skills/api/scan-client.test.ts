import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { okJson } from "../../../test/fetch";
import { revealScanConfigApiKey, scanSkill, validateScanConfig } from "./scan-client";

const fetchMock = vi.fn();

describe("scan api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("posts config validation payload without saving", async () => {
    fetchMock.mockResolvedValue(okJson({
      ok: true,
      message: "Connectivity test passed.",
      provider: "openai-compatible",
      model: "openai/doubao-test",
      durationMs: 12,
      errorCode: null,
    }));

    await validateScanConfig({
      name: "Volcengine",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: "sk-test",
      model: "doubao-test",
      existingConfigId: 7,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/scan/configs/validate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Volcengine",
          baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
          apiKey: "sk-test",
          model: "doubao-test",
          existingConfigId: 7,
        }),
      }),
    );
  });

  it("can scan using the active backend config without sending an api key", async () => {
    fetchMock.mockResolvedValue(okJson({
      skillName: "demo",
      isSafe: true,
      maxSeverity: "SAFE",
      findingsCount: 0,
      findings: [],
      analyzersUsed: ["llm_analyzer"],
      durationSeconds: 0.1,
    }));

    await scanSkill("demo", { useLlm: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/scan/skills/demo",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ useLlm: true }),
      }),
    );
  });

  it("can reveal a saved config api key on demand", async () => {
    fetchMock.mockResolvedValue(okJson({ apiKey: "sk-secret-value" }));

    const result = await revealScanConfigApiKey(7);

    expect(result.apiKey).toBe("sk-secret-value");
    expect(fetchMock).toHaveBeenCalledWith("/api/scan/configs/7/secret");
  });
});
