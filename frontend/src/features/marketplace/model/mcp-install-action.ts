import { useCallback } from "react";

import { useAddMcpServerMutation, useMcpInstallTargetsQuery } from "../api/mcp-queries";
import type {
  AddMcpServerResponseDto,
  McpInstallTargetDto,
  McpMarketplaceDetailDto,
  McpMarketplaceItemDto,
} from "../api/mcp-types";
import { type InstalledState, useInstalledServerLookup } from "./installed-lookup";
import { useInstallingState } from "./installing-context";

export type McpInstallAvailability =
  | { kind: "available" }
  | { kind: "unavailable"; reason: string };

export type McpSourceHarness = string;
export type McpInstallTargetState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; targets: McpInstallTargetDto[] };

const INSTALL_TARGET_LOAD_ERROR = "Unable to load source harness installers";

export function summaryInstallAvailability(
  _item: Pick<McpMarketplaceItemDto, "isRemote" | "isDeployed">,
): McpInstallAvailability {
  return { kind: "available" };
}

export function detailInstallAvailability(
  _detail: McpMarketplaceDetailDto,
): McpInstallAvailability {
  return { kind: "available" };
}

interface UseMcpInstallActionStateParams {
  qualifiedName: string;
  displayName: string;
  onInstalled?: (response: AddMcpServerResponseDto) => void;
}

interface McpInstallActionState {
  installedState: InstalledState;
  installTargetState: McpInstallTargetState;
  installing: boolean;
  onInstall: (sourceHarness: McpSourceHarness) => void;
}

export function useMcpInstallActionState({
  qualifiedName,
  displayName,
  onInstalled,
}: UseMcpInstallActionStateParams): McpInstallActionState {
  const { lookup } = useInstalledServerLookup();
  const { isInstalling } = useInstallingState();
  const installMutation = useAddMcpServerMutation();
  const installTargetsQuery = useMcpInstallTargetsQuery();

  const onInstall = useCallback(
    (sourceHarness: McpSourceHarness) => {
      installMutation.mutate(
        { qualifiedName, sourceHarness, displayName },
        { onSuccess: (response) => onInstalled?.(response) },
      );
    },
    [displayName, installMutation, onInstalled, qualifiedName],
  );

  return {
    installedState: lookup(qualifiedName),
    installTargetState: resolveInstallTargetState(
      installTargetsQuery.isPending,
      installTargetsQuery.error,
      installTargetsQuery.data?.targets,
    ),
    installing: isInstalling(qualifiedName),
    onInstall,
  };
}

function resolveInstallTargetState(
  isPending: boolean,
  error: unknown,
  targets: McpInstallTargetDto[] | undefined,
): McpInstallTargetState {
  if (isPending) {
    return { kind: "loading" };
  }
  if (error) {
    const message = error instanceof Error ? error.message.trim() : "";
    return {
      kind: "error",
      message: message ? `${INSTALL_TARGET_LOAD_ERROR}: ${message}` : INSTALL_TARGET_LOAD_ERROR,
    };
  }
  return { kind: "ready", targets: targets ?? [] };
}
