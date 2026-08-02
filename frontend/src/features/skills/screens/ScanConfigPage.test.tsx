import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_STORAGE_KEY } from "../../../i18n";
import { createRouteFetchMock, okJson } from "../../../test/fetch";
import { renderWithAppProviders } from "../../../test/render";
import ScanConfigPage from "./ScanConfigPage";

const fetchMock = vi.fn();

const configsPayload = {
  activeId: 2,
  configs: [
    {
      id: 1,
      name: "Backup",
      baseUrl: "https://backup.example.com/v1",
      apiKeyMasked: "sk-b...ckp",
      model: "backup-model",
      provider: "openai-compatible",
      apiVersion: "",
      awsRegion: "",
      awsProfile: "",
      maxTokens: 8192,
      consensusRuns: 1,
      isActive: false,
      lastValidatedAt: null,
      lastValidationError: "",
    },
    {
      id: 2,
      name: "Default",
      baseUrl: "https://api.modelarts-maas.com/anthropic",
      apiKeyMasked: "sk-d...flt",
      model: "glm-5.1",
      provider: "anthropic",
      apiVersion: "",
      awsRegion: "",
      awsProfile: "",
      maxTokens: 8192,
      consensusRuns: 1,
      isActive: true,
      lastValidatedAt: "2026-05-12T01:00:00Z",
      lastValidationError: "",
    },
  ],
};

function renderPage() {
  return renderWithAppProviders(<ScanConfigPage />, { route: "/scan-config" });
}

describe("ScanConfigPage", () => {
  beforeEach(() => {
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: "/api/scan/configs/2/secret",
          response: { apiKey: "sk-default-full" },
        },
        {
          match: "/api/scan/configs/validate",
          response: {
            ok: true,
            message: "Connectivity test passed.",
            provider: "anthropic",
            model: "glm-5.1",
            durationMs: 12,
            errorCode: null,
          },
        },
        {
          match: (url, _input, init) => url === "/api/scan/configs/1" && init?.method === "DELETE",
          response: {},
        },
        { match: "/api/scan/configs", response: configsPayload },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("orders the active config first and keeps row actions aligned", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole("table", { name: /llm scan configurations/i })).toBeInTheDocument());
    const rows = screen.getAllByRole("row").slice(1);

    expect(within(rows[0]).getByText("Default")).toBeInTheDocument();
    expect(within(rows[0]).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Active",
      "Edit",
      "Delete",
    ]);
    expect(within(rows[1]).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Make active",
      "Edit",
      "Delete",
    ]);
  });

  it("opens edit in a detail modal and validates with the saved API key", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Default")).toBeInTheDocument());
    fireEvent.click(within(screen.getAllByRole("row")[1]).getByRole("button", { name: "Edit" }));

    expect(await screen.findByRole("heading", { name: "Update configuration" })).toBeInTheDocument();
    expect(screen.queryByText(/Missing required fields: API Key/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
    expect(screen.queryByRole("columnheader", { name: "Last validation" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Last validation")).toHaveTextContent(/May 12|12 May|Failed|Not validated/);
    const apiKeyInput = screen.getByLabelText("API Key", { selector: "input" });
    expect(apiKeyInput).toHaveAttribute("type", "password");
    expect(String(apiKeyInput.getAttribute("value") ?? "")).not.toBe("");
    await waitFor(() => expect(apiKeyInput).toHaveValue("sk-default-full"));
    fireEvent.click(screen.getByRole("button", { name: "Test connectivity" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/scan/configs/validate",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"existingConfigId":2'),
        }),
      ),
    );
    const validateCall = fetchMock.mock.calls.find((call) => call[0] === "/api/scan/configs/validate");
    expect(JSON.parse(String(validateCall?.[1]?.body))).toMatchObject({
      apiKey: "",
      existingConfigId: 2,
    });

    fireEvent.click(screen.getByRole("button", { name: "Show API key" }));
    expect(apiKeyInput).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();

    fireEvent.change(apiKeyInput, { target: { value: "sk-default-new" } });
    expect(screen.getByRole("button", { name: "Update" })).not.toBeDisabled();
  });

  it("opens a styled delete confirmation dialog before deleting a scan config", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Backup")).toBeInTheDocument());
    const backupRow = screen.getAllByRole("row").find((row) => within(row).queryByText("Backup"));
    expect(backupRow).toBeDefined();

    fireEvent.click(within(backupRow as HTMLElement).getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("heading", { name: "Delete Backup?" })).toBeInTheDocument();
    expect(
      screen.getByText("This removes the saved LLM scan configuration. Existing scan results are not deleted."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/scan/configs/1",
      expect.objectContaining({ method: "DELETE" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Delete Backup?" })).not.toBeInTheDocument(),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/scan/configs/1",
      expect.objectContaining({ method: "DELETE" }),
    );

    fireEvent.click(within(backupRow as HTMLElement).getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/scan/configs/1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("requires API key for new configs and can toggle API key visibility", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "New configuration" }));
    expect(await screen.findByRole("heading", { name: "New configuration" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Configuration name", { selector: "input" }), { target: { value: "New" } });
    fireEvent.change(screen.getByLabelText("API Base URL", { selector: "input" }), { target: { value: "https://api.example.com/v1" } });
    fireEvent.change(screen.getByLabelText("Model", { selector: "input" }), { target: { value: "model-a" } });

    expect(screen.getByText("Missing required fields: API Key")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test connectivity" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    const apiKeyInput = screen.getByLabelText("API Key", { selector: "input" });
    expect(apiKeyInput).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show API key" }));
    expect(apiKeyInput).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide API key" }));
    expect(apiKeyInput).toHaveAttribute("type", "password");
  });

  it("localizes the scan configuration editor", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
    renderPage();

    await waitFor(() => expect(screen.getByText("Default")).toBeInTheDocument());
    fireEvent.click(within(screen.getAllByRole("row")[1]).getByRole("button", { name: "编辑" }));

    expect(await screen.findByRole("heading", { name: "更新配置" })).toBeInTheDocument();
    expect(screen.getAllByText("配置 LLM API Key").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("配置名称", { selector: "input" })).toBeInTheDocument();
    expect(screen.getByLabelText("模型", { selector: "input" })).toBeInTheDocument();
    expect(screen.getByText("显示在已保存配置列表中")).toBeInTheDocument();
    expect(screen.getByText("用于扫描请求的模型")).toBeInTheDocument();
    expect(screen.getByLabelText("上次验证")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "测试连接" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();

    const apiKeyInput = screen.getByLabelText("API Key", { selector: "input" });
    await waitFor(() => expect(apiKeyInput).toHaveValue("sk-default-full"));
    fireEvent.click(screen.getByRole("button", { name: "显示 API Key" }));
    expect(apiKeyInput).toHaveAttribute("type", "text");
  });

  it("localizes the scan configuration page chrome and table", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
    renderPage();

    expect(await screen.findByRole("heading", { name: "扫描配置" })).toBeInTheDocument();
    expect(screen.getByText("查看和管理用于安全扫描的所有已保存 LLM 配置。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建配置" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "LLM 扫描配置" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "名称" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "模型" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "提供方" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Base URL" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "API Key" })).toBeInTheDocument();

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "当前",
      "编辑",
      "删除",
    ]);
    expect(within(rows[1]).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "设为当前",
      "编辑",
      "删除",
    ]);
  });
});
