import { useCallback } from "react";

import { useAddMcpServerMutation } from "../api/mcp-queries";
import type {
  AddMcpServerResponseDto,
} from "../api/mcp-types";
import { type InstalledState, useInstalledServerLookup } from "./installed-lookup";
import { useInstallingState } from "./installing-context";

interface UseMcpInstallActionStateParams {
  qualifiedName: string;
  displayName: string;
  onInstalled?: (response: AddMcpServerResponseDto) => void;
}

interface McpInstallActionState {
  installedState: InstalledState;
  installing: boolean;
  onInstall: () => void;
}

export function useMcpInstallActionState({
  qualifiedName,
  displayName,
  onInstalled,
}: UseMcpInstallActionStateParams): McpInstallActionState {
  const { lookup } = useInstalledServerLookup();
  const { isInstalling } = useInstallingState();
  const installMutation = useAddMcpServerMutation();

  const submitInstall = useCallback(
    () => {
      installMutation.mutate(
        { qualifiedName, displayName },
        {
          onSuccess: (response) => {
            onInstalled?.(response);
          },
        },
      );
    },
    [displayName, installMutation, onInstalled, qualifiedName],
  );

  return {
    installedState: lookup(qualifiedName),
    installing: isInstalling(qualifiedName),
    onInstall: submitInstall,
  };
}
