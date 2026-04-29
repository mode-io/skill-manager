import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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

    await waitFor(() => expect(screen.getByText("code-review")).toBeInTheDocument());
    expect(screen.queryByText("/code-review")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));

    await waitFor(() => expect(requests).toEqual([{ target: "codex", name: "code-review" }]));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens an unmanaged command detail modal and imports from the footer", async () => {
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

    fireEvent.click(await screen.findByText("code-review"));

    const dialog = screen.getByRole("dialog", { name: "Slash command to review code-review" });
    expect(within(dialog).getByRole("heading", { name: "code-review" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("heading", { name: "/code-review" })).not.toBeInTheDocument();
    const header = getDetailHeader(dialog);
    expect(within(header).queryByText("Unmanaged")).not.toBeInTheDocument();
    expect(within(header).queryByText("Codex")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("State")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Harness")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Invocation")).not.toBeInTheDocument();
    expectLegacyTargetLanguageAbsent(dialog);
    expect(within(dialog).getByText("/tmp/home/.codex/prompts/code-review.md")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Locations" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Description" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Prompt" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("heading", { name: "Command content" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Harnesses" })).toBeInTheDocument();
    expectHeadingOrder(dialog, "Description", "Prompt");
    expectHeadingOrder(dialog, "Prompt", "Harnesses");
    expectHeadingOrder(dialog, "Harnesses", "Locations");
    const harnesses = getDetailSection(dialog, "Harnesses");
    expectSlashHarnessLabels(harnesses);
    expect(within(harnesses).getByText("Found in harness")).toBeInTheDocument();
    expect(within(harnesses).getByText("Adopt this command to manage it")).toBeInTheDocument();
    expect(within(dialog).queryByText("Parsed command")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Review code")).toBeInTheDocument();
    expect(within(dialog).getByText("$ARGUMENTS")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close slash command detail" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByText("code-review"));
    const reopened = screen.getByRole("dialog", { name: "Slash command to review code-review" });
    fireEvent.click(within(reopened).getByRole("button", { name: "Adopt" }));

    await waitFor(() => expect(requests).toEqual([{ target: "codex", name: "code-review" }]));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows drifted and missing rows with resolve actions", async () => {
    const requests: unknown[] = [];
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: (url, _input, init) => url === "/api/slash-commands/review/resolve" && init?.method === "POST",
          response: (_url: string, _input: RequestInfo | URL, init?: RequestInit) => {
            requests.push(JSON.parse(String(init?.body)));
            return okJson({ ok: true, command: null, sync: [] });
          },
        },
        {
          match: "/api/slash-commands",
          response: slashCommandsPayload({
            commands: [
              {
                name: "code-review",
                description: "Canonical review",
                prompt: "Canonical prompt",
                syncTargets: [],
              },
              {
                name: "missing-command",
                description: "Canonical missing command",
                prompt: "Restore this command",
                syncTargets: [],
              },
            ],
            reviewCommands: [
              {
                reviewRef: "codex:code-review:drifted",
                kind: "drifted",
                target: "codex",
                targetLabel: "Codex",
                name: "code-review",
                path: "/tmp/home/.codex/prompts/code-review.md",
                description: "Review code",
                prompt: "$ARGUMENTS",
                commandExists: true,
                canImport: false,
                actions: ["restore_managed", "adopt_target", "remove_binding"],
                error: null,
              },
              {
                reviewRef: "claude:missing-command:missing",
                kind: "missing",
                target: "claude",
                targetLabel: "Claude Code",
                name: "missing-command",
                path: "/tmp/home/.claude/commands/missing-command.md",
                description: "Missing command",
                prompt: null,
                commandExists: true,
                canImport: false,
                actions: ["restore_managed", "remove_binding"],
                error: null,
              },
            ],
          }),
        },
      ]),
    );

    renderWithAppProviders(<SlashCommandsReviewPage />);

    await waitFor(() => expect(screen.getByText("Changed in Codex")).toBeInTheDocument());
    expect(screen.getByText("Missing from Claude Code")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Restore" })[0]);

    await waitFor(() =>
      expect(requests).toEqual([{ target: "codex", name: "code-review", action: "restore_managed" }]),
    );
  });

  it("shows drifted detail with canonical and target content and adopts target", async () => {
    const requests: unknown[] = [];
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: (url, _input, init) => url === "/api/slash-commands/review/resolve" && init?.method === "POST",
          response: (_url: string, _input: RequestInfo | URL, init?: RequestInit) => {
            requests.push(JSON.parse(String(init?.body)));
            return okJson({ ok: true, command: null, sync: [] });
          },
        },
        {
          match: "/api/slash-commands",
          response: slashCommandsPayload({
            commands: [
              {
                name: "code-review",
                description: "Canonical review",
                prompt: "Canonical prompt",
                syncTargets: [],
              },
            ],
            reviewCommands: [
              {
                reviewRef: "codex:code-review:drifted",
                kind: "drifted",
                target: "codex",
                targetLabel: "Codex",
                name: "code-review",
                path: "/tmp/home/.codex/prompts/code-review.md",
                description: "Target review",
                prompt: "Target prompt",
                commandExists: true,
                canImport: false,
                actions: ["restore_managed", "adopt_target", "remove_binding"],
                error: null,
              },
            ],
          }),
        },
      ]),
    );

    renderWithAppProviders(<SlashCommandsReviewPage />);

    fireEvent.click(await screen.findByText("code-review"));
    const dialog = screen.getByRole("dialog", { name: "Slash command to review code-review" });
    expect(within(getDetailHeader(dialog)).queryByText("Changed")).not.toBeInTheDocument();
    expect(within(getDetailHeader(dialog)).queryByText("Codex")).not.toBeInTheDocument();
    expectLegacyTargetLanguageAbsent(dialog);
    expect(within(dialog).queryByText("Parsed command")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Locations" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Skill Manager source" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Harness command" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Harnesses" })).toBeInTheDocument();
    expectHeadingOrder(dialog, "Skill Manager source", "Harnesses");
    expectHeadingOrder(dialog, "Harness command", "Harnesses");
    expectHeadingOrder(dialog, "Harnesses", "Locations");
    const harnesses = getDetailSection(dialog, "Harnesses");
    expect(within(harnesses).getByText("Changed in harness")).toBeInTheDocument();
    expect(within(harnesses).getByText("Resolve from footer")).toBeInTheDocument();
    expect(within(dialog).getByText("Canonical prompt")).toBeInTheDocument();
    expect(within(dialog).getByText("Target prompt")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Adopt" }));

    await waitFor(() =>
      expect(requests).toEqual([{ target: "codex", name: "code-review", action: "adopt_target" }]),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows missing detail with canonical content", async () => {
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: "/api/slash-commands",
          response: slashCommandsPayload({
            commands: [
              {
                name: "missing-command",
                description: "Canonical missing command",
                prompt: "Restore this command",
                syncTargets: [],
              },
            ],
            reviewCommands: [
              {
                reviewRef: "claude:missing-command:missing",
                kind: "missing",
                target: "claude",
                targetLabel: "Claude Code",
                name: "missing-command",
                path: "/tmp/home/.claude/commands/missing-command.md",
                description: "Missing command",
                prompt: "",
                commandExists: true,
                canImport: false,
                actions: ["restore_managed", "remove_binding"],
                error: null,
              },
            ],
          }),
        },
      ]),
    );

    renderWithAppProviders(<SlashCommandsReviewPage />);

    fireEvent.click(await screen.findByText("missing-command"));
    const dialog = screen.getByRole("dialog", { name: "Slash command to review missing-command" });
    expect(within(getDetailHeader(dialog)).queryByText("Missing")).not.toBeInTheDocument();
    expect(within(getDetailHeader(dialog)).queryByText("Claude Code")).not.toBeInTheDocument();
    expectLegacyTargetLanguageAbsent(dialog);
    expect(within(dialog).queryByText("Parsed command")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Locations" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Skill Manager source" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Harnesses" })).toBeInTheDocument();
    expectHeadingOrder(dialog, "Skill Manager source", "Harnesses");
    expectHeadingOrder(dialog, "Harnesses", "Locations");
    const harnesses = getDetailSection(dialog, "Harnesses");
    expect(within(harnesses).getByText("Missing from harness")).toBeInTheDocument();
    expect(within(harnesses).getByText("Resolve from footer")).toBeInTheDocument();
    expect(within(dialog).getByText("/tmp/home/.claude/commands/missing-command.md")).toBeInTheDocument();
    expect(within(dialog).getByText("Restore this command")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Remove binding" })).toBeInTheDocument();
  });

  it("shows same-name unmanaged conflicts with canonical and target content", async () => {
    fetchMock.mockImplementation(
      createRouteFetchMock([
        {
          match: "/api/slash-commands",
          response: slashCommandsPayload({
            commands: [
              {
                name: "code-review",
                description: "Canonical review",
                prompt: "Canonical prompt",
                syncTargets: [],
              },
            ],
            reviewCommands: [
              {
                reviewRef: "codex:code-review:unmanaged",
                kind: "unmanaged",
                target: "codex",
                targetLabel: "Codex",
                name: "code-review",
                path: "/tmp/home/.codex/prompts/code-review.md",
                description: "Target review",
                prompt: "Target prompt",
                commandExists: true,
                canImport: false,
                actions: ["adopt_target"],
                error: null,
              },
            ],
          }),
        },
      ]),
    );

    renderWithAppProviders(<SlashCommandsReviewPage />);

    fireEvent.click(await screen.findByText("code-review"));
    const dialog = screen.getByRole("dialog", { name: "Slash command to review code-review" });
    expect(within(getDetailHeader(dialog)).queryByText("Name conflict")).not.toBeInTheDocument();
    expect(within(getDetailHeader(dialog)).queryByText("Codex")).not.toBeInTheDocument();
    expect(within(dialog).getByText(/already uses this name/i)).toBeInTheDocument();
    expectLegacyTargetLanguageAbsent(dialog);
    expect(within(dialog).queryByText("Parsed command")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Skill Manager source" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Harness command" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Locations" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Harnesses" })).toBeInTheDocument();
    expectHeadingOrder(dialog, "Skill Manager source", "Harnesses");
    expectHeadingOrder(dialog, "Harness command", "Harnesses");
    expectHeadingOrder(dialog, "Harnesses", "Locations");
    const harnesses = getDetailSection(dialog, "Harnesses");
    expect(within(harnesses).getByText("Found in harness")).toBeInTheDocument();
    expect(within(harnesses).getByText("Resolve from footer")).toBeInTheDocument();
    expect(within(dialog).getByText("Canonical prompt")).toBeInTheDocument();
    expect(within(dialog).getByText("Target prompt")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Adopt" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Remove binding" })).not.toBeInTheDocument();
  });
});

function slashCommandsPayload({
  targets = slashTargetsPayload(),
  commands = [],
  reviewCommands = [
    {
      reviewRef: "codex:code-review:unmanaged",
      kind: "unmanaged",
      target: "codex",
      targetLabel: "Codex",
      name: "code-review",
      path: "/tmp/home/.codex/prompts/code-review.md",
      description: "Review code",
      prompt: "$ARGUMENTS",
      commandExists: false,
      canImport: true,
      actions: ["import"],
      error: null,
    },
  ],
}: {
  targets?: Array<{
    id: string;
    label: string;
    rootPath: string;
    outputDir: string;
    invocationPrefix: string;
    renderFormat: string;
    scope: string;
    docsUrl: string;
    fileGlob: string;
    supportsFrontmatter: boolean;
    supportNote: string | null;
    defaultSelected: boolean;
    enabled: boolean;
    available: boolean;
  }>;
  commands?: Array<{
    name: string;
    description: string;
    prompt: string;
    syncTargets: unknown[];
  }>;
  reviewCommands?: Array<{
    reviewRef: string;
    kind: string;
    target: string;
    targetLabel: string;
    name: string;
    path: string;
    description: string | null;
    prompt: string | null;
    commandExists: boolean;
    canImport: boolean;
    actions: string[];
    error: string | null;
  }>;
} = {}) {
  return {
    storePath: "/tmp/home/Library/Application Support/skill-manager/slash-commands/commands",
    syncStatePath: "/tmp/home/Library/Application Support/skill-manager/slash-commands/sync-state.json",
    targets,
    defaultTargets: [],
    commands,
    reviewCommands,
  };
}

function slashTargetsPayload() {
  return [
    slashTarget("codex", "Codex", "/tmp/home/.codex", "/tmp/home/.codex/prompts", "/prompts:"),
    slashTarget("claude", "Claude Code", "/tmp/home/.claude", "/tmp/home/.claude/commands", "/"),
    slashTarget("cursor", "Cursor", "/tmp/home/.cursor", "/tmp/home/.cursor/commands", "/"),
    slashTarget("opencode", "OpenCode", "/tmp/home/.config/opencode", "/tmp/home/.config/opencode/commands", "/"),
  ];
}

function slashTarget(id: string, label: string, rootPath: string, outputDir: string, invocationPrefix: string) {
  return {
    id,
    label,
    rootPath,
    outputDir,
    invocationPrefix,
    renderFormat: id === "cursor" ? "cursor_plaintext" : "frontmatter_markdown",
    scope: "global",
    docsUrl: "https://example.com",
    fileGlob: "*.md",
    supportsFrontmatter: id !== "cursor",
    supportNote: null,
    defaultSelected: true,
    enabled: true,
    available: true,
  };
}

function expectHeadingOrder(container: HTMLElement, firstName: string, secondName: string) {
  const first = within(container).getByRole("heading", { name: firstName });
  const second = within(container).getByRole("heading", { name: secondName });
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

function getDetailSection(container: HTMLElement, heading: string): HTMLElement {
  const headingNode = within(container).getByRole("heading", { name: heading });
  const section = headingNode.closest("section");
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

function getDetailHeader(container: HTMLElement): HTMLElement {
  const header = container.querySelector(".slash-review-detail-shell__chrome");
  expect(header).not.toBeNull();
  return header as HTMLElement;
}

function expectSlashHarnessLabels(container: HTMLElement) {
  expect(within(container).getByText("Codex")).toBeInTheDocument();
  expect(within(container).getByText("Claude Code")).toBeInTheDocument();
  expect(within(container).getByText("Cursor")).toBeInTheDocument();
  expect(within(container).getByText("OpenCode")).toBeInTheDocument();
}

function expectLegacyTargetLanguageAbsent(container: HTMLElement) {
  expect(within(container).queryByText("Target file")).not.toBeInTheDocument();
  expect(within(container).queryByText("Target file content")).not.toBeInTheDocument();
  expect(within(container).queryByText("Missing target")).not.toBeInTheDocument();
  expect(within(container).queryByText("Parsed target file")).not.toBeInTheDocument();
}
