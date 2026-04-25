import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiTooltipProvider } from "../../../components/ui/UiTooltipProvider";
import { McpInstallButton } from "./McpInstallButton";

const installTargets = [
  {
    harness: "cursor",
    label: "Cursor",
    logoKey: "cursor",
    smitheryClient: "cursor",
    supported: true,
    reason: null,
  },
  {
    harness: "codex",
    label: "Codex",
    logoKey: "codex",
    smitheryClient: "codex",
    supported: true,
    reason: null,
  },
  {
    harness: "claude",
    label: "Claude",
    logoKey: "claude",
    smitheryClient: "claude-code",
    supported: true,
    reason: null,
  },
  {
    harness: "openclaw",
    label: "OpenClaw",
    logoKey: "openclaw",
    smitheryClient: null,
    supported: false,
    reason: "Smithery does not provide an OpenClaw MCP installer target",
  },
];

function renderButton(props: Partial<Parameters<typeof McpInstallButton>[0]> = {}) {
  const onInstall = vi.fn();
  const utils = render(
    <UiTooltipProvider delayDuration={0} skipDelayDuration={0}>
      <MemoryRouter>
        <McpInstallButton
          displayName="Exa Search"
          availability={{ kind: "available" }}
          installedState={{ kind: "not-installed" }}
          installTargetState={{ kind: "ready", targets: installTargets }}
          installing={false}
          onInstall={onInstall}
          {...props}
        />
      </MemoryRouter>
    </UiTooltipProvider>,
  );
  return { ...utils, onInstall };
}

describe("McpInstallButton", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders 'Add to MCPs' when available and installs through the selected source harness", async () => {
    const { onInstall } = renderButton();
    const button = screen.getByRole("button", { name: /add exa search to mcps/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: /claude/i })).toHaveTextContent("claude-code");
    expect(screen.queryByRole("button", { name: /openclaw/i })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /cursor/i }));
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onInstall).toHaveBeenCalledWith("cursor");
  });

  it("renders disabled 'Add to MCPs' with tooltip when unavailable", async () => {
    const { onInstall } = renderButton({
      availability: {
        kind: "unavailable",
        reason: "Unavailable reason",
      },
    });
    const button = screen.getByRole("button", { name: /add exa search to mcps \(unavailable\)/i });
    expect(button).toBeDisabled();

    const trigger = button.closest(".ui-tooltip-trigger");
    expect(trigger).not.toBeNull();
    fireEvent.focus(trigger!);

    await waitFor(() => {
      const bubble = document.querySelector(".ui-popup--tooltip");
      expect(bubble).not.toBeNull();
      expect(bubble).toHaveTextContent("Unavailable reason");
    });

    fireEvent.click(button);
    expect(onInstall).not.toHaveBeenCalled();
  });

  it("renders loading state while source harness installers load", async () => {
    const { onInstall } = renderButton({
      installTargetState: { kind: "loading" },
    });

    await expectDisabledTooltip("Loading source harness installers");
    expect(onInstall).not.toHaveBeenCalled();
  });

  it("renders install-target API failures as load errors", async () => {
    renderButton({
      installTargetState: {
        kind: "error",
        message: "Unable to load source harness installers: unknown api path",
      },
    });

    await expectDisabledTooltip(
      "Unable to load source harness installers: unknown api path",
    );
    expect(screen.queryByText(/no compatible/i)).not.toBeInTheDocument();
  });

  it("renders empty successful target responses as unsupported", async () => {
    renderButton({
      installTargetState: {
        kind: "ready",
        targets: [
          {
            harness: "openclaw",
            label: "OpenClaw",
            logoKey: "openclaw",
            smitheryClient: null,
            supported: false,
            reason: "Smithery does not provide an OpenClaw MCP installer target",
          },
        ],
      },
    });

    await expectDisabledTooltip("No supported Smithery source harness installers are available");
  });

  it("renders 'Open in MCPs' when already installed", () => {
    renderButton({
      installedState: { kind: "installed", managedName: "exa-mcp" },
    });
    const link = screen.getByRole("link", { name: /open exa search in mcps/i });
    expect(link).toHaveAttribute("href", "/mcp/use?server=exa-mcp");
    expect(link).toHaveTextContent(/open in mcps/i);
  });

  it("renders 'Installing' while an install is in flight", () => {
    renderButton({ installing: true });
    const button = screen.getByRole("button", { name: /installing exa search/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/installing/i);
  });
});

async function expectDisabledTooltip(message: string): Promise<void> {
  const button = screen.getByRole("button", { name: /add exa search to mcps \(unavailable\)/i });
  expect(button).toBeDisabled();

  const trigger = button.closest(".ui-tooltip-trigger");
  expect(trigger).not.toBeNull();
  fireEvent.focus(trigger!);

  await waitFor(() => {
    const bubble = document.querySelector(".ui-popup--tooltip");
    expect(bubble).not.toBeNull();
    expect(bubble).toHaveTextContent(message);
  });
}
