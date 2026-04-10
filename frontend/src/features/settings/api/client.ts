import { apiPath } from "../../../api/paths";
import type { SettingsData } from "./types";

async function expectJson<T>(responsePromise: Promise<Response>): Promise<T> {
  const response = await responsePromise;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (
      payload
      && typeof payload === "object"
      && "error" in payload
      && typeof payload.error === "string"
    )
      ? payload.error
      : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return payload as T;
}

export async function fetchSettings(): Promise<SettingsData> {
  return expectJson<SettingsData>(fetch(apiPath("/settings")));
}

export async function updateHarnessSupport(harness: string, enabled: boolean): Promise<{ ok: boolean; enabled: boolean }> {
  return expectJson<{ ok: boolean; enabled: boolean }>(
    fetch(apiPath(`/settings/harnesses/${encodeURIComponent(harness)}/support`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }),
  );
}
