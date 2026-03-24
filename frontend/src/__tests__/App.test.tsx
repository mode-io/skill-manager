import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { CatalogProvider } from "../context/CatalogContext";

const fetchMock = vi.fn();

function renderApp(initialRoute = "/") {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <CatalogProvider>
        <App />
      </CatalogProvider>
    </MemoryRouter>,
  );
}

function mockReadyState() {
  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          harness: "codex",
          label: "Codex",
          detected: true,
          manageable: true,
          builtinSupport: false,
          discoveryMode: "filesystem",
          detectionDetails: [],
          issues: [],
        },
      ],
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          skillRef: "shared:abc",
          declaredName: "Shared Audit",
          description: "An audit skill",
          ownership: "shared",
          sourceKind: "github",
          sourceLocator: "github:test/repo/audit",
          revision: "abc123",
          harnesses: [],
          builtinHarnesses: [],
          issues: [],
          conflicts: [],
        },
      ],
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok", issues: [], warnings: [], counts: {} }),
    });
}

describe("App routing", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders My Skills page at /", async () => {
    mockReadyState();
    renderApp("/");
    await waitFor(() => expect(screen.getByText("My Skills")).toBeInTheDocument());
    expect(screen.getByText("Shared Audit")).toBeInTheDocument();
  });

  it("renders Setup page at /setup", async () => {
    mockReadyState();
    renderApp("/setup");
    await waitFor(() => expect(screen.getByText("Setup")).toBeInTheDocument());
    expect(screen.getByText("Detected Harnesses")).toBeInTheDocument();
  });

  it("renders Marketplace page at /marketplace", async () => {
    mockReadyState();
    renderApp("/marketplace");
    await waitFor(() => expect(screen.getByText("Marketplace")).toBeInTheDocument());
    expect(screen.getByText("Search for skills")).toBeInTheDocument();
  });

  it("renders Health page at /system", async () => {
    mockReadyState();
    renderApp("/system");
    await waitFor(() => expect(screen.getByText("Health")).toBeInTheDocument());
    expect(screen.getByText("Shared Skills")).toBeInTheDocument();
  });

  it("renders error state when fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    renderApp("/");
    await waitFor(() => expect(screen.getByText("Unable to load control plane")).toBeInTheDocument());
  });
});
