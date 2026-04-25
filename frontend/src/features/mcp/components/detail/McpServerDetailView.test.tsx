import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../../components/Toast";
import { McpServerDetailView } from "./McpServerDetailView";
import type { McpInventoryColumnDto } from "../../api/management-types";

const fetchMock = vi.fn();

function okJson(payload: object) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => payload,
  };
}

function columns(): McpInventoryColumnDto[] {
  return [
    { harness: "cursor", label: "Cursor", logoKey: "cursor", installed: true, configPresent: true, mcpWritable: true },
    { harness: "claude", label: "Claude", logoKey: "claude", installed: true, configPresent: true, mcpWritable: true },
  ];
}

function detailFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "exa",
    displayName: "Exa Search",
    kind: "managed",
    spec: {
      name: "exa",
      displayName: "Exa Search",
      source: { kind: "marketplace", locator: "exa" },
      transport: "http",
      url: "https://exa.run.tools",
      installedAt: "2026-04-21T00:00:00Z",
      revision: "abc",
    },
    sightings: [
      { harness: "cursor", state: "managed" },
      { harness: "claude", state: "missing" },
    ],
    canEnable: true,
    env: [
      {
        key: "EXA_API_KEY",
        value: "long-random-literal-value-xxxx",
        isEnvRef: false,
      },
    ],
    configChoices: [],
    marketplaceLink: null,
    ...overrides,
  };
}

function renderView(props: Partial<Parameters<typeof McpServerDetailView>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  const onEnableHarness = vi.fn();
  const onDisableHarness = vi.fn();
  const onResolveConfig = vi.fn(async () => undefined);
  const onUninstall = vi.fn();
  const utils = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <McpServerDetailView
          name="exa"
          columns={columns()}
          pendingPerHarness={new Set()}
          isServerPending={false}
          isUninstalling={false}
          onClose={onClose}
          onEnableHarness={onEnableHarness}
          onDisableHarness={onDisableHarness}
          onResolveConfig={onResolveConfig}
          onUninstall={onUninstall}
          {...props}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return {
    ...utils,
    onClose,
    onEnableHarness,
    onDisableHarness,
    onResolveConfig,
    onUninstall,
  };
}

describe("McpServerDetailView", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders name, bindings matrix, and env table", async () => {
    fetchMock.mockResolvedValue(okJson(detailFixture()));
    renderView();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Exa Search" })).toBeInTheDocument());
    expect(screen.getByText("Cursor")).toBeInTheDocument();
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cursor, Enabled" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Claude, Disabled" })).toBeInTheDocument();
    expect(screen.queryByText(/^Enabled$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Disabled$/)).not.toBeInTheDocument();
    expect(screen.getByText("EXA_API_KEY")).toBeInTheDocument();
    expect(screen.getByText("long-random-literal-value-xxxx")).toBeInTheDocument();
  });

  it("calls onEnableHarness when clicking Enable on a missing harness row", async () => {
    fetchMock.mockResolvedValue(okJson(detailFixture()));
    const { onEnableHarness } = renderView();
    await waitFor(() => expect(screen.getByText("Claude")).toBeInTheDocument());
    const enableButton = screen.getByRole("button", { name: "Enable" });
    expect(enableButton).toHaveClass("action-pill--accent");
    fireEvent.click(enableButton);
    expect(onEnableHarness).toHaveBeenCalledWith("claude");
  });

  it("calls onDisableHarness when clicking Disable on a managed harness row", async () => {
    fetchMock.mockResolvedValue(okJson(detailFixture()));
    const { onDisableHarness } = renderView();
    await waitFor(() => expect(screen.getByText("Cursor")).toBeInTheDocument());
    const disableButton = screen.getByRole("button", { name: "Disable" });
    expect(disableButton).toHaveClass("action-pill--danger");
    fireEvent.click(disableButton);
    expect(onDisableHarness).toHaveBeenCalledWith("cursor");
  });

  it("shows one resolve action for different harness rows", async () => {
    fetchMock.mockResolvedValue(
      okJson(
        detailFixture({
          sightings: [
            { harness: "cursor", state: "drifted", driftDetail: "changed=url" },
            { harness: "claude", state: "missing" },
          ],
          configChoices: [
            {
              sourceKind: "managed",
              sourceHarness: null,
              label: "Skill Manager config",
              logoKey: null,
              configPath: null,
              payloadPreview: { url: "https://exa.run.tools" },
              spec: {
                name: "exa",
                displayName: "Exa Search",
                source: { kind: "marketplace", locator: "exa" },
                transport: "http",
                url: "https://exa.run.tools",
                installedAt: "2026-04-21T00:00:00Z",
                revision: "abc",
              },
              env: [],
            },
            {
              sourceKind: "harness",
              sourceHarness: "cursor",
              label: "Cursor config",
              logoKey: "cursor",
              configPath: "/tmp/.cursor/mcp.json",
              payloadPreview: { url: "https://edited.example" },
              spec: {
                name: "exa",
                displayName: "Exa Search",
                source: { kind: "adopted", locator: "cursor:exa" },
                transport: "http",
                url: "https://edited.example",
                installedAt: "2026-04-21T00:00:00Z",
                revision: "def",
              },
              env: [],
            },
          ],
        }),
      ),
    );
    const { onDisableHarness, onResolveConfig } = renderView();
    await waitFor(() => expect(screen.getByText("Different config")).toBeInTheDocument());
    const driftIdentity = screen.getByRole("group", { name: "Cursor, Different config" });
    expect(driftIdentity).toBeInTheDocument();
    expect(screen.getByText("Different configs found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disable" })).not.toBeInTheDocument();

    const driftRow = driftIdentity.closest(".detail-sheet__binding-row");
    expect(driftRow).not.toBeNull();
    const driftRowActions = within(driftRow as HTMLElement).getAllByRole("button");
    expect(driftRowActions).toHaveLength(1);
    const resolveButtons = screen.getAllByRole("button", { name: "Resolve config" });
    expect(resolveButtons).toHaveLength(2);
    const rowResolveButton = driftRowActions[0];
    expect(rowResolveButton).toHaveClass("action-pill--accent");
    fireEvent.click(rowResolveButton);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Resolve different configs" })).toBeInTheDocument(),
    );
    expect(screen.getByText("Skill Manager config")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply config" }));
    await waitFor(() => expect(onResolveConfig).toHaveBeenCalled());
    expect(onDisableHarness).not.toHaveBeenCalled();
  });

  it("opens uninstall confirm flow and calls onUninstall", async () => {
    fetchMock.mockResolvedValue(okJson(detailFixture()));
    const { onUninstall } = renderView();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Exa Search" })).toBeInTheDocument());
    const uninstallButtons = screen.getAllByRole("button", { name: /Uninstall/ });
    fireEvent.click(uninstallButtons[0]);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Uninstall/ }).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/confirm uninstall/i)).not.toBeInTheDocument();
    const confirmButtons = screen.getAllByRole("button", { name: /Uninstall/ });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    expect(onUninstall).toHaveBeenCalled();
  });
});
