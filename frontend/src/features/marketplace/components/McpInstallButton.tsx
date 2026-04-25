import { type MouseEvent } from "react";
import { Link } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";
import { ArrowUpRight, Loader2, Plus } from "lucide-react";

import { UiTooltip } from "../../../components/ui/UiTooltip";
import { UiTooltipTriggerBoundary } from "../../../components/ui/UiTooltipTriggerBoundary";
import type { McpInstallTargetDto } from "../api/mcp-types";
import type { InstalledState } from "../model/installed-lookup";
import type {
  McpInstallAvailability,
  McpInstallTargetState,
  McpSourceHarness,
} from "../model/mcp-install-action";

type SupportedMcpInstallTarget = McpInstallTargetDto & { smitheryClient: string };

interface McpInstallButtonProps {
  displayName: string;
  availability: McpInstallAvailability;
  installedState: InstalledState;
  installTargetState: McpInstallTargetState;
  installing: boolean;
  onInstall: (sourceHarness: McpSourceHarness) => void;
}

/**
 * Three-state install affordance for a marketplace server.
 *
 *   unavailable → disabled pill with an explanatory tooltip
 *   installing  → disabled pill with spinner + "Installing"
 *   installed   → link to /mcp/use?server=<name> with "Open in MCPs"
 *   default     → normal Add to MCPs pill that triggers onInstall
 */
export function McpInstallButton({
  displayName,
  availability,
  installedState,
  installTargetState,
  installing,
  onInstall,
}: McpInstallButtonProps) {
  const sourceOptions =
    installTargetState.kind === "ready"
      ? installTargetState.targets.filter(
          (target): target is SupportedMcpInstallTarget =>
            target.supported && Boolean(target.smitheryClient),
        )
      : [];

  if (installing) {
    return (
      <button
        type="button"
        className="action-pill"
        disabled
        aria-label={`Installing ${displayName}`}
        onClick={stopPropagation}
      >
        <Loader2 size={12} className="mcp-dialog__spinner" aria-hidden="true" />
        Installing
      </button>
    );
  }

  if (installedState.kind === "installed") {
    return (
      <UiTooltip content="Open in MCP servers in use">
        <Link
          to={`/mcp/use?server=${encodeURIComponent(installedState.managedName)}`}
          className="action-pill"
          style={{ textDecoration: "none" }}
          aria-label={`Open ${displayName} in MCPs`}
          onClick={stopPropagation}
        >
          <ArrowUpRight size={12} aria-hidden="true" />
          Open in MCPs
        </Link>
      </UiTooltip>
    );
  }

  if (availability.kind === "unavailable") {
    const button = (
      <button
        type="button"
        className="action-pill"
        disabled
        aria-label={`Add ${displayName} to MCPs (unavailable)`}
        onClick={stopPropagation}
      >
        <Plus size={12} aria-hidden="true" />
        Add to MCPs
      </button>
    );

    return (
      <UiTooltipTriggerBoundary content={availability.reason}>{button}</UiTooltipTriggerBoundary>
    );
  }

  if (installTargetState.kind !== "ready" || sourceOptions.length === 0) {
    const reason =
      installTargetState.kind === "loading"
        ? "Loading source harness installers"
        : installTargetState.kind === "error"
          ? installTargetState.message
          : "No supported Smithery source harness installers are available";
    const button = (
      <button
        type="button"
        className="action-pill"
        disabled
        aria-label={`Add ${displayName} to MCPs (unavailable)`}
        onClick={stopPropagation}
      >
        <Plus size={12} aria-hidden="true" />
        Add to MCPs
      </button>
    );

    return <UiTooltipTriggerBoundary content={reason}>{button}</UiTooltipTriggerBoundary>;
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="action-pill"
          onClick={stopPropagation}
          aria-label={`Add ${displayName} to MCPs`}
        >
          <Plus size={12} aria-hidden="true" />
          Add to MCPs
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="ui-popup ui-popup--menu ui-menu"
          align="end"
          sideOffset={6}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="ui-menu__section-label">Install into source harness</div>
          <ul className="ui-menu__list">
            {sourceOptions.map((option) => (
              <li key={option.harness}>
                <Popover.Close asChild>
                  <button
                    type="button"
                    className="ui-menu__item"
                    onClick={(event) => {
                      event.stopPropagation();
                      onInstall(option.harness);
                    }}
                  >
                    <span className="ui-menu__icon" aria-hidden="true" />
                    <span className="ui-menu__label">{option.label}</span>
                    <span className="ui-menu__meta">
                      Install with Smithery&apos;s {option.smitheryClient} target
                    </span>
                  </button>
                </Popover.Close>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function stopPropagation(event: MouseEvent): void {
  event.stopPropagation();
}
