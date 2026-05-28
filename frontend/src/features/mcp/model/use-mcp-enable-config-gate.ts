import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { fetchMcpMarketplaceDetail } from "../api/marketplace-client";
import type { McpServerSpecDto } from "../api/management-types";
import type { McpInstallConfigValues, PendingMcpInstallConfig } from "./install-config";

const mcpRegistryDetailKey = (qualifiedName: string) =>
  ["mcp", "registry-detail", qualifiedName] as const;

interface UseMcpEnableConfigGateParams {
  loadErrorMessage: string;
}

export function useMcpEnableConfigGate({
  loadErrorMessage,
}: UseMcpEnableConfigGateParams) {
  const queryClient = useQueryClient();
  const [pendingConfig, setPendingConfig] = useState<PendingMcpInstallConfig | null>(null);
  const [configError, setConfigError] = useState("");
  const pendingSubmitRef = useRef<((config?: McpInstallConfigValues) => void) | null>(null);

  const requestEnable = useCallback(
    ({
      spec,
      displayName,
      targetLabel,
      onProceed,
    }: {
      spec: McpServerSpecDto | null;
      displayName: string;
      targetLabel: string;
      onProceed: (config?: McpInstallConfigValues) => void;
    }): void => {
      const locator = spec?.source.kind === "marketplace" ? spec.source.locator : null;
      if (!locator) {
        onProceed();
        return;
      }

      setConfigError("");
      pendingSubmitRef.current = onProceed;
      void queryClient
        .fetchQuery({
          queryKey: mcpRegistryDetailKey(locator),
          queryFn: () => fetchMcpMarketplaceDetail(locator),
        })
        .then((marketplaceDetail) => {
          const installConfig = marketplaceDetail.installConfig;
          if (installConfig?.fields?.length) {
            setPendingConfig({
              qualifiedName: locator,
              targetLabel,
              displayName,
              installConfig,
            });
            return;
          }
          pendingSubmitRef.current = null;
          onProceed();
        })
        .catch((error) => {
          pendingSubmitRef.current = null;
          setConfigError(error instanceof Error ? error.message : loadErrorMessage);
        });
    },
    [loadErrorMessage, queryClient],
  );

  const cancelConfig = useCallback(() => {
    setPendingConfig(null);
    pendingSubmitRef.current = null;
  }, []);

  const submitConfig = useCallback(
    (config: McpInstallConfigValues): void => {
      if (!pendingConfig) {
        return;
      }
      pendingSubmitRef.current?.(config);
      pendingSubmitRef.current = null;
      setPendingConfig(null);
    },
    [pendingConfig],
  );

  return {
    requestEnable,
    pendingConfig,
    cancelConfig,
    submitConfig,
    configError,
  };
}
