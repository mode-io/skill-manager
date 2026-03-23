import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

const fetchMock = vi.fn();

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders an empty catalog state", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "ok", issues: [], warnings: [], counts: { shared: 0 } }),
      });

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText("No skills discovered in the current fake-home environment.")).toBeInTheDocument(),
    );
  });

  it("renders a mixed catalog state", async () => {
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
            detectionDetails: ["user:/tmp/fake-home/.codex/skills"],
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
            ownership: "shared",
            sourceKind: "github",
            sourceLocator: "github:mode-io/shared-audit",
            revision: "abc123abc123",
            harnesses: [{ harness: "codex", label: "Codex", state: "enabled", scopes: ["user"] }],
            builtinHarnesses: [],
            issues: [],
            conflicts: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "warning",
          issues: [],
          warnings: [{ severity: "warning", message: "fixture", code: "warning" }],
          counts: { shared: 1 },
        }),
      });

    render(<App />);

    await waitFor(() => expect(screen.getByText("Shared Audit")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Harnesses" })).toBeInTheDocument();
    expect(screen.getAllByText("warning").length).toBeGreaterThan(0);
  });

  it("renders an error state when the fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    render(<App />);

    await waitFor(() => expect(screen.getByText("Unable to load control plane")).toBeInTheDocument());
    expect(screen.getByText("network down")).toBeInTheDocument();
  });
});
