import { useState } from "react";

import { usePendingRegistry } from "../../../lib/async/pending-registry";
import {
  useHarnessSupportMutation,
  useSettingsQuery,
} from "../queries";
import { settingsSupportActionKey } from "./pending";

export function useSettingsPageController() {
  const [errorMessage, setErrorMessage] = useState("");
  const settingsQuery = useSettingsQuery();
  const supportMutation = useHarnessSupportMutation();
  const pendingRegistry = usePendingRegistry<string>();

  async function handleSupportToggle(harness: string, nextEnabled: boolean) {
    setErrorMessage("");
    try {
      await pendingRegistry.run(
        settingsSupportActionKey(harness),
        () => supportMutation.mutateAsync({ harness, enabled: nextEnabled }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update harness support.");
    }
  }

  return {
    data: settingsQuery.data ?? null,
    errorMessage: errorMessage || (settingsQuery.error instanceof Error ? settingsQuery.error.message : ""),
    isPending: settingsQuery.isPending,
    isHarnessPending: (harness: string) => pendingRegistry.isPending(settingsSupportActionKey(harness)),
    setErrorMessage,
    handleSupportToggle,
  };
}
