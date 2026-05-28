import { type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Loader2, Plus } from "lucide-react";

import { UiTooltip } from "../../../components/ui/UiTooltip";
import { useMarketplaceCopy } from "../i18n";
import type { InstalledState } from "../model/installed-lookup";

interface McpInstallButtonProps {
  displayName: string;
  installedState: InstalledState;
  installing: boolean;
  onInstall: () => void;
}

/**
 * Three-state install affordance for a marketplace server.
 *
 *   installing  → disabled pill with spinner + "Installing"
 *   installed   → link to /mcp/use?server=<name> with "Open in MCPs"
 *   default     → normal Install pill that triggers onInstall
 */
export function McpInstallButton({
  displayName,
  installedState,
  installing,
  onInstall,
}: McpInstallButtonProps) {
  const copy = useMarketplaceCopy();

  if (installing) {
    return (
      <button
        type="button"
        className="action-pill"
        disabled
        aria-label={copy.detail.installButton.installingAria(displayName)}
        onClick={stopPropagation}
      >
        <Loader2 size={12} className="mcp-dialog__spinner" aria-hidden="true" />
        {copy.detail.installButton.installing}
      </button>
    );
  }

  if (installedState.kind === "installed") {
    return (
      <UiTooltip content={copy.detail.installButton.openInMcpTooltip}>
        <Link
          to={`/mcp/use?server=${encodeURIComponent(installedState.managedName)}`}
          className="action-pill"
          style={{ textDecoration: "none" }}
          aria-label={copy.detail.installButton.openInMcpAria(displayName)}
          onClick={stopPropagation}
        >
          <ArrowUpRight size={12} aria-hidden="true" />
          {copy.detail.installButton.openInMcp}
        </Link>
      </UiTooltip>
    );
  }

  return (
    <button
      type="button"
      className="action-pill"
      onClick={(event) => {
        stopPropagation(event);
        onInstall();
      }}
      aria-label={copy.detail.installButton.addToMcpAria(displayName)}
    >
      <Plus size={12} aria-hidden="true" />
      {copy.detail.installButton.addToMcp}
    </button>
  );
}

function stopPropagation(event: MouseEvent): void {
  event.stopPropagation();
}
