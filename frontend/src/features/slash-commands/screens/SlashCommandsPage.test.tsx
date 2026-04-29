import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteFetchMock, errorJson, okJson } from "../../../test/fetch";
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

    const dialog = await screen.findByRole("dialog", { name: "Slash command details code-review" });
    expect(within(dialog).getByRole("heading", { name: "code-review", level: 2 })).toBeInTheDocument();
    expect(within(getDetailHeader(dialog, "slash-command-detail-shell__chrome")).queryByText("Managed command")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Description" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Prompt" })).toBeInTheDocument();
    expect(within(dialog).getByText("$ARGUMENTS")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "New slash command" })).not.toBeInTheDocument();
  });

  it("opens a read-only detail sheet with normalized sections and written locations", async () => {
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

    fireEvent.click(await screen.findByText("code-review"));

    const dialog = screen.getByRole("dialog", { name: "Slash command details code-review" });
    expect(within(dialog).getByRole("heading", { name: "code-review", level: 2 })).toBeInTheDocument();
    expect(within(dialog).queryByText("/code-review")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("/prompts:code-review")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Name")).not.toBeInTheDocument();
    expect(within(getDetailHeader(dialog, "slash-command-detail-shell__chrome")).queryByText("Managed command")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("heading", { name: "About" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("heading", { name: "Command content" })).not.toBeInTheDocument();
    expect(within(dialog).getByText("Review code")).toBeInTheDocument();

    const descriptionHeading = within(dialog).getByRole("heading", { name: "Description" });
    const promptHeading = within(dialog).getByRole("heading", { name: "Prompt" });
    const harnessesHeading = within(dialog).getByRole("heading", { name: "Harnesses" });
    const locationsHeading = within(dialog).getByRole("heading", { name: "Locations" });
    expect(within(dialog).getAllByText("Prompt")).toHaveLength(1);
    expect(Boolean(descriptionHeading.compareDocumentPosition(promptHeading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(promptHeading.compareDocumentPosition(harnessesHeading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(harnessesHeading.compareDocumentPosition(locationsHeading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(within(dialog).getByText("/tmp/home/.claude/commands/code-review.md")).toBeInTheDocument();
    expect(within(dialog).queryByText("/tmp/home/.codex/prompts/not-written.md")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: "Edit command" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Review code")).toBeInTheDocument();
  });

  it("returns to read-only detail after editing a command", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: (url, _input, init) => url === "/api/slash-commands/code-review" && init?.method === "PUT",
          response: (url: string, _input: RequestInfo | URL, init?: RequestInit) => {
            requests.push({ url, body: JSON.parse(String(init?.body)) });
            return okJson({
              ok: true,
              command: {
                name: "code-review",
                description: "Review code carefully",
                prompt: "Review this diff carefully.",
                syncTargets: [
                  {
                    target: "claude",
                    path: "/tmp/home/.claude/commands/code-review.md",
                    status: "synced",
                  },
                ],
              },
              sync: [],
            });
          },
        },
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

    fireEvent.click(await screen.findByText("code-review"));
    let dialog = screen.getByRole("dialog", { name: "Slash command details code-review" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Review code carefully" } });
    fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "Review this diff carefully." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].body).toEqual({
      description: "Review code carefully",
      prompt: "Review this diff carefully.",
      targets: ["claude"],
    });

    dialog = await screen.findByRole("dialog", { name: "Slash command details code-review" });
    expect(within(dialog).getByText("Review code carefully")).toBeInTheDocument();
    expect(within(dialog).getByText("Review this diff carefully.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Edit command" })).not.toBeInTheDocument();
  });

  it("keeps the edit form open when saving fails", async () => {
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: (url, _input, init) => url === "/api/slash-commands/code-review" && init?.method === "PUT",
          response: errorJson("Unable to save slash command."),
        },
        {
          match: "/api/slash-commands",
          response: slashCommandsPayload({
            commands: [
              {
                name: "code-review",
                description: "Review code",
                prompt: "$ARGUMENTS",
                syncTargets: [],
              },
            ],
          }),
        },
      ]),
    );

    renderWithAppProviders(<SlashCommandsPage />);

    fireEvent.click(await screen.findByText("code-review"));
    const dialog = screen.getByRole("dialog", { name: "Slash command details code-review" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Review code carefully" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Unable to save slash command.")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Edit command" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Slash command details code-review" })).not.toBeInTheDocument();
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

    fireEvent.click(await screen.findByText("print-1-9"));

    const dialog = screen.getByRole("dialog", { name: "Slash command details print-1-9" });
    expect(within(dialog).getByRole("button", { name: "Enable Claude Code for print-1-9" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Enable Codex for print-1-9" })).toBeInTheDocument();
    expect(within(dialog).getByText("No harness locations are enabled.")).toBeInTheDocument();
  });

  it("toggles harnesses from the adopted command detail sheet", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: (url, _input, init) => url === "/api/slash-commands/code-review/sync" && init?.method === "POST",
          response: (url: string, _input: RequestInfo | URL, init?: RequestInit) => {
            requests.push({ url, body: JSON.parse(String(init?.body)) });
            return okJson({
              ok: true,
              command: null,
              sync: [],
            });
          },
        },
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
                    path: "/tmp/home/.codex/prompts/code-review.md",
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

    fireEvent.click(await screen.findByText("code-review"));
    const dialog = screen.getByRole("dialog", { name: "Slash command details code-review" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Disable Codex for code-review" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].body).toEqual({ targets: ["claude"] });
  });

  it("opens delete confirmation from detail with raw command name", async () => {
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
                syncTargets: [],
              },
            ],
          }),
        },
      ]),
    );

    renderWithAppProviders(<SlashCommandsPage />);

    fireEvent.click(await screen.findByText("code-review"));
    const dialog = screen.getByRole("dialog", { name: "Slash command details code-review" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("heading", { name: "Delete code-review?" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Delete /code-review?" })).not.toBeInTheDocument();
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
    expect(within(disabledColumn!).getByText("disabled-command")).toBeInTheDocument();
    expect(within(selectiveColumn!).getByText("selective-command")).toBeInTheDocument();
    expect(within(enabledColumn!).getByText("enabled-command")).toBeInTheDocument();
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
    expect(screen.getByText("code-review")).toBeInTheDocument();
    expect(screen.queryByText("/prompts:code-review")).not.toBeInTheDocument();
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
    storePath: "/tmp/home/Library/Application Support/skill-manager/slash-commands/commands",
    syncStatePath: "/tmp/home/Library/Application Support/skill-manager/slash-commands/sync-state.json",
    targets: [
      {
        id: "claude",
        label: "Claude Code",
        rootPath: "/tmp/home/.claude",
        outputDir: "/tmp/home/.claude/commands",
        invocationPrefix: "/",
        renderFormat: "frontmatter_markdown",
        scope: "global",
        docsUrl: "https://code.claude.com/docs/en/slash-commands",
        fileGlob: "*.md",
        supportsFrontmatter: true,
        supportNote: null,
        enabled: true,
        available: true,
        defaultSelected: true,
      },
      {
        id: "codex",
        label: "Codex",
        rootPath: "/tmp/home/.codex",
        outputDir: "/tmp/home/.codex/prompts",
        invocationPrefix: "/prompts:",
        renderFormat: "frontmatter_markdown",
        scope: "global",
        docsUrl: "https://developers.openai.com/codex/custom-prompts",
        fileGlob: "*.md",
        supportsFrontmatter: true,
        supportNote: null,
        enabled: true,
        available: true,
        defaultSelected: true,
      },
    ],
    defaultTargets: ["claude", "codex"],
    commands,
    reviewCommands: [],
  };
}

function getDetailHeader(container: HTMLElement, className: string): HTMLElement {
  const header = container.querySelector(`.${className}`);
  expect(header).not.toBeNull();
  return header as HTMLElement;
}
