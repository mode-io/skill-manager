import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../../components/Toast";
import { McpConfigChoiceDialog, type McpConfigChoiceOption } from "./McpConfigChoiceDialog";

const fetchMock = vi.fn();
const onConfirm = vi.fn();

function options(): McpConfigChoiceOption[] {
  return [
    {
      id: "cursor",
      sourceKind: "harness",
      sourceHarness: "cursor",
      label: "Cursor",
      logoKey: "cursor",
      configPath: "/c/.cursor/mcp.json",
      payloadPreview: { command: "uvx", args: ["context7-mcp"] },
      spec: {
        name: "context7",
        displayName: "context7",
        source: { kind: "adopted", locator: "cursor:context7" },
        transport: "stdio",
        command: "uvx",
        args: ["context7-mcp"],
        installedAt: "2026-04-21T00:00:00Z",
        revision: "abc",
      },
      env: [],
    },
    {
      id: "claude",
      sourceKind: "harness",
      sourceHarness: "claude",
      label: "Claude",
      logoKey: "claude",
      configPath: "/c/.claude.json",
      payloadPreview: { url: "https://context7.example" },
      spec: {
        name: "context7",
        displayName: "context7",
        source: { kind: "adopted", locator: "claude:context7" },
        transport: "http",
        url: "https://context7.example",
        installedAt: "2026-04-21T00:00:00Z",
        revision: "def",
      },
      env: [],
    },
  ];
}

function renderDialog(mode: "adopt" | "resolve" = "adopt") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <McpConfigChoiceDialog
          open
          mode={mode}
          serverName="context7"
          options={options()}
          pending={false}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("McpConfigChoiceDialog", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    onConfirm.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("uses adopt wording and submits the chosen config option", async () => {
    renderDialog();

    expect(screen.getByRole("heading", { name: "Choose config to adopt" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Claude"));
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0][0].sourceHarness).toBe("claude");
  });

  it("uses resolve wording and apply label", async () => {
    renderDialog("resolve");

    expect(screen.getByRole("heading", { name: "Resolve different configs" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply config" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
  });
});
