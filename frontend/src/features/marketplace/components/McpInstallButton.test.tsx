import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiTooltipProvider } from "../../../components/ui/UiTooltipProvider";
import { McpInstallButton } from "./McpInstallButton";

function renderButton(props: Partial<Parameters<typeof McpInstallButton>[0]> = {}) {
  const onInstall = vi.fn();
  const utils = render(
    <UiTooltipProvider delayDuration={0} skipDelayDuration={0}>
      <MemoryRouter>
        <McpInstallButton
          displayName="Exa Search"
          installedState={{ kind: "not-installed" }}
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

  it("renders 'Install' when available and installs directly without choosing an Agent", () => {
    const { onInstall } = renderButton();
    const button = screen.getByRole("button", { name: /install exa search/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Install");
    fireEvent.click(button);
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onInstall).toHaveBeenCalledWith();
    expect(screen.queryByRole("button", { name: /cursor/i })).not.toBeInTheDocument();
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
