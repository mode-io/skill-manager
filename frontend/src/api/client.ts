import type { SettingsData } from "./types";
import { apiPath } from "./paths";

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
