import { useState } from "react";

import {
  useHarnessSupportMutation,
  useSettingsQuery,
} from "../queries";

export function useSettingsPageController() {
  const [errorMessage, setErrorMessage] = useState("");
  const settingsQuery = useSettingsQuery();
  const supportMutation = useHarnessSupportMutation();

  async function handleSupportToggle(harness: string, nextEnabled: boolean) {
    try {
      await supportMutation.mutateAsync({ harness, enabled: nextEnabled });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update harness support.");
    }
  }

  return {
    data: settingsQuery.data ?? null,
    errorMessage: errorMessage || (settingsQuery.error instanceof Error ? settingsQuery.error.message : ""),
    isPending: settingsQuery.isPending,
    pendingHarness: supportMutation.variables?.harness ?? null,
    setErrorMessage,
    handleSupportToggle,
  };
}
