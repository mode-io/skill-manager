import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteFetchMock, okJson } from "../../../test/fetch";
import { renderWithAppProviders } from "../../../test/render";
import SlashCommandsReviewPage from "./SlashCommandsReviewPage";

const fetchMock = vi.fn();

describe("SlashCommandsReviewPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("shows unmanaged commands and imports one", async () => {
    const requests: unknown[] = [];
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: (url, _input, init) => url === "/api/slash-commands/review/import" && init?.method === "POST",
          response: (_url: string, _input: RequestInfo | URL, init?: RequestInit) => {
            requests.push(JSON.parse(String(init?.body)));
            return okJson({ ok: true, command: null, sync: [] });
          },
        },
        { match: "/api/slash-commands", response: slashCommandsPayload() },
      ]),
    );

    renderWithAppProviders(<SlashCommandsReviewPage />);

    await waitFor(() => expect(screen.getByText("/code-review")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => expect(requests).toEqual([{ target: "codex", name: "code-review" }]));
  });
});

function slashCommandsPayload() {
  return {
    storePath: "/tmp/home/.slash-command-manager/commands",
    syncStatePath: "/tmp/home/.slash-command-manager/sync-state.json",
    targets: [],
    defaultTargets: [],
    commands: [],
    reviewCommands: [
      {
        reviewRef: "codex:code-review",
        target: "codex",
        targetLabel: "Codex",
        name: "code-review",
        path: "/tmp/home/.codex/prompts/code-review.md",
        description: "Review code",
        prompt: "$ARGUMENTS",
        commandExists: false,
        canImport: true,
        error: null,
      },
    ],
  };
}
