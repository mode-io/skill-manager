import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_STORAGE_KEY, LocaleProvider } from "../../../i18n";
import SkillsInUsePage from "./SkillsInUsePage";

const hooks = vi.hoisted(() => {
  const scanResult = {
    skillName: "Trace Lens",
    isSafe: false,
    maxSeverity: "CRITICAL",
    findingsCount: 1,
    findings: [
      {
        id: "finding-1",
        ruleId: "AITech-8.2",
        category: "data_exfiltration",
        severity: "CRITICAL",
        title: "Hardcoded API keys",
        description: "The skill contains hardcoded secrets.",
        filePath: "agents/agent.yaml",
        lineNumber: null,
        snippet: "api_key: sk-test",
        remediation: "Remove hardcoded secrets.",
        analyzer: "llm_analyzer",
      },
    ],
    analyzersUsed: ["llm_analyzer"],
    durationSeconds: 0.4,
  };

  return {
    onRemoveSkill: vi.fn(async () => undefined),
    onDeleteSkill: vi.fn(async () => undefined),
    updateFilters: vi.fn(),
    resetFilters: vi.fn(),
    toast: vi.fn(),
    setViewMode: vi.fn(),
    scanSkill: vi.fn(),
    viewMode: "grid",
    llmConfig: null as object | null,
    scanStateMap: {} as Record<string, unknown>,
    scanResult,
  };
});

vi.mock("../model/workspace-context", () => ({
  useSkillsWorkspace: () => ({
    data: {
      summary: { managed: 1, unmanaged: 0 },
      harnessColumns: [
        { harness: "codex", label: "Codex", installed: true },
        { harness: "cursor", label: "Cursor", installed: true },
      ],
      rows: [
        {
          skillRef: "shared:trace-lens",
          name: "Trace Lens",
          description: "Trace review workflow",
          displayStatus: "Managed",
          actions: { canManage: false, canStopManaging: true, canDelete: true },
          cells: [
            { harness: "codex", label: "Codex", state: "enabled", interactive: true },
            { harness: "cursor", label: "Cursor", state: "disabled", interactive: true },
          ],
        },
      ],
    },
    status: "ready",
    pendingToggleKeys: new Set(),
    pendingStructuralActions: new Map(),
    selectedSkillRef: null,
    multiSelectedRefs: new Set(),
    onOpenSkill: vi.fn(),
    onToggleCell: vi.fn(),
    onToggleMultiSelect: vi.fn(),
    onClearMultiSelect: vi.fn(),
    onSetSkillAllHarnesses: vi.fn(),
    onSetManySkillsAllHarnesses: vi.fn(),
    onRemoveSkill: hooks.onRemoveSkill,
    onDeleteSkill: hooks.onDeleteSkill,
    isInitialLoading: false,
  }),
}));

vi.mock("../model/session", () => ({
  useSkillsInUseSession: () => ({
    filters: { search: "" },
    updateFilters: hooks.updateFilters,
    resetFilters: hooks.resetFilters,
  }),
}));

vi.mock("../model/useInUseViewMode", () => ({
  useInUseViewMode: () => [hooks.viewMode, hooks.setViewMode] as const,
}));

vi.mock("../model/use-skill-scan", () => ({
  useSkillScan: () => ({
    scanState: hooks.scanStateMap,
    getScanState: (skillRef: string) =>
      hooks.scanStateMap[skillRef] ?? { status: "idle", result: null, error: null, completedAt: null },
    scanSkill: hooks.scanSkill,
    llmConfig: hooks.llmConfig,
    configs: [],
    activeConfigId: null,
    addConfig: vi.fn(async () => ({ id: 1 })),
    editConfig: vi.fn(async () => undefined),
    selectConfig: vi.fn(async () => undefined),
    validateConfig: vi.fn(async () => ({
      ok: true,
      message: "OK",
      provider: null,
      model: null,
      durationMs: null,
      errorCode: null,
    })),
    revealConfigApiKey: vi.fn(async () => ""),
  }),
}));

vi.mock("../../../components/Toast", async () => {
  const actual = await vi.importActual<typeof import("../../../components/Toast")>(
    "../../../components/Toast",
  );
  return {
    ...actual,
    useToast: () => ({ toast: hooks.toast }),
  };
});

describe("SkillsInUsePage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    hooks.onRemoveSkill.mockClear();
    hooks.onDeleteSkill.mockClear();
    hooks.updateFilters.mockClear();
    hooks.resetFilters.mockClear();
    hooks.toast.mockClear();
    hooks.setViewMode.mockClear();
    hooks.scanSkill.mockClear();
    hooks.viewMode = "grid";
    hooks.llmConfig = null;
    hooks.scanStateMap = {};
    window.localStorage.clear();
  });

  it("opens a remove confirm popup from the skill card menu", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/skills/use"]}>
          <SkillsInUsePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions for Trace Lens" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from Skill Manager" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /remove skill from skill manager/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/will restore to: codex/i)).toBeInTheDocument();
    expect(hooks.onRemoveSkill).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(hooks.onRemoveSkill).toHaveBeenCalledWith("shared:trace-lens"),
    );
  });

  it("labels the harness coverage view as Matrix", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/skills/use"]}>
          <SkillsInUsePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Matrix" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Table" })).not.toBeInTheDocument();
  });

  it("keeps Scan available as an in-use view mode", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/skills/use"]}>
          <SkillsInUsePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Scan" }));

    expect(screen.getByRole("button", { name: "Scan" })).toBeInTheDocument();
    expect(hooks.setViewMode).toHaveBeenCalledWith("scan");
  });

  it("renders the scan table and scan settings action in Scan mode", () => {
    hooks.viewMode = "scan";

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/skills/use"]}>
          <SkillsInUsePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("table", { name: "Skills scan table" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Configure LLM scan" }).length).toBeGreaterThan(0);
  });

  it("localizes the scan result action", () => {
    hooks.viewMode = "scan";
    hooks.llmConfig = {};
    hooks.scanStateMap = {
      "shared:trace-lens": { status: "done", result: hooks.scanResult, error: null, completedAt: Date.now() },
    };
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");

    render(
      <QueryClientProvider client={new QueryClient()}>
        <LocaleProvider>
          <MemoryRouter initialEntries={["/skills/use"]}>
            <SkillsInUsePage />
          </MemoryRouter>
        </LocaleProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "查看 Trace Lens 的扫描结果" })).toBeInTheDocument();
    expect(screen.getByText("查看结果")).toBeInTheDocument();
    expect(screen.queryByText("View Result")).not.toBeInTheDocument();
  });

  it("localizes the scan result modal chrome and report labels", () => {
    hooks.viewMode = "scan";
    hooks.llmConfig = {
      name: "skill5",
      model: "deepseek/deepseek-v4-flash",
      provider: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
    };
    hooks.scanStateMap = {
      "shared:trace-lens": { status: "done", result: hooks.scanResult, error: null, completedAt: Date.now() },
    };
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");

    render(
      <QueryClientProvider client={new QueryClient()}>
        <LocaleProvider>
          <MemoryRouter initialEntries={["/skills/use"]}>
            <SkillsInUsePage />
          </MemoryRouter>
        </LocaleProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "查看 Trace Lens 的扫描结果" }));

    expect(screen.getAllByRole("heading", { name: "扫描结果" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "安全报告" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "发现严重问题，请立即删除！" })).toBeInTheDocument();
    expect(screen.getByText(/1 个发现/)).toBeInTheDocument();
    expect(screen.getByText("LLM 模型")).toBeInTheDocument();
    expect(screen.getByText(/已配置模型/)).toBeInTheDocument();
    expect(screen.getByText("严重")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Hardcoded API keys/ }));
    expect(screen.getByText(/修复建议:/)).toBeInTheDocument();
  });

  it("opens a delete confirm popup from the skill card menu", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/skills/use"]}>
          <SkillsInUsePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions for Trace Lens" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /delete skill from skill manager/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/affected harnesses: codex/i)).toBeInTheDocument();
    expect(hooks.onDeleteSkill).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    await waitFor(() =>
      expect(hooks.onDeleteSkill).toHaveBeenCalledWith("shared:trace-lens"),
    );
  });
});
