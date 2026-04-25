import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmActionDialog } from "./ConfirmActionDialog";

function renderDialog(props: Partial<Parameters<typeof ConfirmActionDialog>[0]> = {}) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();

  const utils = render(
    <ConfirmActionDialog
      open
      title="Uninstall Exa Search?"
      description="Remove this server from your central catalog."
      note="This action updates local harness config files."
      confirmLabel="Uninstall"
      pendingLabel="Uninstalling"
      isPending={false}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      {...props}
    />,
  );

  return { ...utils, onOpenChange, onConfirm };
}

describe("ConfirmActionDialog", () => {
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

  it("renders the title, description, and secondary note in the standard dialog body", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: /uninstall exa search\?/i })).toBeInTheDocument();
    expect(screen.getByText(/remove this server from your central catalog/i)).toBeInTheDocument();
    expect(screen.getByText(/updates local harness config files/i)).toBeInTheDocument();
  });

  it("closes through the cancel button when not pending", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables the footer while pending", () => {
    renderDialog({ isPending: true });
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /uninstalling/i })).toBeDisabled();
  });
});
