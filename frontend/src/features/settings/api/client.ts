import { fetchJson, putJson } from "../../../api/http";
import type { SetHarnessSupportRequest, SettingsData } from "./types";

export async function fetchSettings(): Promise<SettingsData> {
  return fetchJson<SettingsData>("/settings");
}

export async function updateHarnessSupport(harness: string, enabled: boolean): Promise<{ ok: boolean; enabled: boolean }> {
  const body: SetHarnessSupportRequest = { enabled };
  return putJson<{ ok: boolean; enabled: boolean }>(
    `/settings/harnesses/${encodeURIComponent(harness)}/support`,
    body,
  );
}
