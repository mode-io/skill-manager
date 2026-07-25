import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { okJson } from "../../../test/fetch";
import { renderWithAppProviders } from "../../../test/render";
import HooksNeedsReviewPage from "./HooksNeedsReviewPage";

const fetchMock = vi.fn();

function emptyInventoryFixture() {
  return {
    columns: [
      { harness: "cursor", label: "Cursor", logoKey: "cursor" },
      { harness: "claude", label: "Claude", logoKey: "claude" },
    ],
    entries: [],
  };
}

function unmanagedHooksInventoryFixture() {
  return {
    columns: [
      { harness: "cursor", label: "Cursor", logoKey: "cursor" },
      { harness: "claude", label: "Claude", logoKey: "claude" },
    ],
    entries: [
      {
        id: "hook-1",
        displayName: "Pre-Commit Check",
        kind: "unmanaged",
        canEnable: true,
        spec: {
          id: "hook-1",
          event: "PreCommit",
          command: "npm test",
          description: "Run tests before commit",
        },
        sightings: [
          { harness: "cursor", state: "unmanaged" },
        ],
      },
    ],
  };
}

function renderPage() {
  return renderWithAppProviders(<HooksNeedsReviewPage />, { route: "/hooks/review" });
}

describe("HooksNeedsReviewPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders empty state when no hooks need review", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/hooks")) return okJson(emptyInventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /no hooks need review/i })).toBeInTheDocument(),
    );
  });

  it("renders MatrixTable with discovery columns and Adopt button", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/hooks")) return okJson(unmanagedHooksInventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole("table", { name: /hooks to review/i })).toBeInTheDocument());
    expect(screen.getByText("Pre-Commit Check")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Adopt$/i })).toBeInTheDocument();
  });

  it("triggers promote mutation when Adopt button is clicked", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/promote")) {
        expect(init?.method).toBe("POST");
        return okJson({ ok: true });
      }
      if (url.includes("/api/hooks")) return okJson(unmanagedHooksInventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Pre-Commit Check")).toBeInTheDocument());
    const adoptButton = screen.getByRole("button", { name: /^Adopt$/i });
    fireEvent.click(adoptButton);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes("/promote")),
      ).toBe(true),
    );
  });
});
