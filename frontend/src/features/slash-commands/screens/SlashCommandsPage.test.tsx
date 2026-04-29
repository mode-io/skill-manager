import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteFetchMock, okJson } from "../../../test/fetch";
import { renderWithAppProviders } from "../../../test/render";
import SlashCommandsPage from "./SlashCommandsPage";

const fetchMock = vi.fn();

describe("SlashCommandsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.clear();
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("creates a command with selected targets", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: (url, _input, init) => url === "/api/slash-commands" && init?.method === "POST",
          response: (url: string, _input: RequestInfo | URL, init?: RequestInit) => {
            requests.push({ url, body: JSON.parse(String(init?.body)) });
            return okJson({
              ok: true,
              command: slashCommandsPayload({
                commands: [
                  {
                    name: "code-review",
                    description: "Review code",
                    prompt: "$ARGUMENTS",
                    syncTargets: [],
                  },
                ],
              }).commands[0],
              sync: [],
            });
          },
        },
        { match: "/api/slash-commands", response: slashCommandsPayload() },
      ]),
    );

    renderWithAppProviders(<SlashCommandsPage />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Slash Commands" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "New command" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "code-review" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Review code" } });
    fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "$ARGUMENTS" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].body).toEqual({
      name: "code-review",
      description: "Review code",
      prompt: "$ARGUMENTS",
      targets: ["claude", "codex"],
    });
  });

  it("shows only written locations in the edit dialog", async () => {
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: "/api/slash-commands",
          response: slashCommandsPayload({
            commands: [
              {
                name: "code-review",
                description: "Review code",
                prompt: "$ARGUMENTS",
                syncTargets: [
                  {
                    target: "claude",
                    path: "/tmp/home/.claude/commands/code-review.md",
                    status: "synced",
                  },
                  {
                    target: "codex",
                    path: "/tmp/home/.codex/prompts/not-written.md",
                    status: "not_selected",
                  },
                ],
              },
            ],
          }),
        },
      ]),
    );

    renderWithAppProviders(<SlashCommandsPage />);

    fireEvent.click(await screen.findByText("/code-review"));

    expect(screen.getByRole("heading", { name: "Write locations" })).toBeInTheDocument();
    expect(screen.getByText("/tmp/home/.claude/commands/code-review.md")).toBeInTheDocument();
    expect(screen.queryByText("/tmp/home/.codex/prompts/not-written.md")).not.toBeInTheDocument();
  });

  it("keeps all sync targets unchecked when an existing command is disabled everywhere", async () => {
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: "/api/slash-commands",
          response: slashCommandsPayload({
            commands: [
              {
                name: "print-1-9",
                description: "打印1-9",
                prompt: "用最简单的python打印最快的1-9",
                syncTargets: [
                  {
                    target: "claude",
                    path: "/tmp/home/.claude/commands/print-1-9.md",
                    status: "not_selected",
                  },
                  {
                    target: "codex",
                    path: "/tmp/home/.codex/prompts/print-1-9.md",
                    status: "not_selected",
                  },
                ],
              },
            ],
          }),
        },
      ]),
    );

    renderWithAppProviders(<SlashCommandsPage />);

    fireEvent.click(await screen.findByText("/print-1-9"));

    expect(screen.getByRole("button", { name: "Enable Claude Code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable Codex" })).toBeInTheDocument();
  });

  it("groups slash commands by coverage in board view", async () => {
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: "/api/slash-commands",
          response: slashCommandsPayload({
            commands: [
              {
                name: "disabled-command",
                description: "Not synced anywhere",
                prompt: "Disabled",
                syncTargets: [],
              },
              {
                name: "selective-command",
                description: "Synced to one target",
                prompt: "Selective",
                syncTargets: [
                  {
                    target: "claude",
                    path: "/tmp/home/.claude/commands/selective-command.md",
                    status: "synced",
                  },
                ],
              },
              {
                name: "enabled-command",
                description: "Synced everywhere",
                prompt: "Enabled",
                syncTargets: [
                  {
                    target: "claude",
                    path: "/tmp/home/.claude/commands/enabled-command.md",
                    status: "synced",
                  },
                  {
                    target: "codex",
                    path: "/tmp/home/.codex/prompts/enabled-command.md",
                    status: "synced",
                  },
                ],
              },
            ],
          }),
        },
      ]),
    );

    renderWithAppProviders(<SlashCommandsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Board" }));

    const disabledColumn = screen.getByRole("heading", { name: "Disabled everywhere" }).closest("section");
    const selectiveColumn = screen.getByRole("heading", { name: "Selective" }).closest("section");
    const enabledColumn = screen.getByRole("heading", { name: "Enabled everywhere" }).closest("section");

    expect(disabledColumn).not.toBeNull();
    expect(selectiveColumn).not.toBeNull();
    expect(enabledColumn).not.toBeNull();
    expect(within(disabledColumn!).getByText("/disabled-command")).toBeInTheDocument();
    expect(within(selectiveColumn!).getByText("/selective-command")).toBeInTheDocument();
    expect(within(enabledColumn!).getByText("/enabled-command")).toBeInTheDocument();
  });

  it("renders slash commands in matrix view", async () => {
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: "/api/slash-commands",
          response: slashCommandsPayload({
            commands: [
              {
                name: "code-review",
                description: "Review code",
                prompt: "$ARGUMENTS",
                syncTargets: [
                  {
                    target: "claude",
                    path: "/tmp/home/.claude/commands/code-review.md",
                    status: "synced",
                  },
                ],
              },
            ],
          }),
        },
      ]),
    );

    renderWithAppProviders(<SlashCommandsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Matrix" }));

    expect(screen.getByRole("table", { name: "Slash commands target matrix" })).toBeInTheDocument();
    expect(screen.getByText("/code-review")).toBeInTheDocument();
    expect(screen.getByLabelText("Disable Claude Code for code-review")).toBeInTheDocument();
    expect(screen.getByLabelText("Enable Codex for code-review")).toBeInTheDocument();
    expect(screen.getByLabelText("Active on 1 of 2 targets")).toBeInTheDocument();
  });
});

function slashCommandsPayload({
  commands = [],
}: {
  commands?: Array<{
    name: string;
    description: string;
    prompt: string;
    syncTargets: unknown[];
  }>;
} = {}) {
  return {
    storePath: "/tmp/home/.slash-command-manager/commands",
    syncStatePath: "/tmp/home/.slash-command-manager/sync-state.json",
    targets: [
      {
        id: "claude",
        label: "Claude Code",
        rootPath: "/tmp/home/.claude",
        outputDir: "/tmp/home/.claude/commands",
        invocationPrefix: "/",
        defaultSelected: true,
      },
      {
        id: "codex",
        label: "Codex",
        rootPath: "/tmp/home/.codex",
        outputDir: "/tmp/home/.codex/prompts",
        invocationPrefix: "/prompts:",
        defaultSelected: true,
      },
    ],
    defaultTargets: ["claude", "codex"],
    commands,
    reviewCommands: [],
  };
}
