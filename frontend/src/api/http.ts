import { apiPath } from "./paths";

async function expectJson<T>(responsePromise: Promise<Response>): Promise<T> {
  const response = await responsePromise;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, response));
  }
  return payload as T;
}

function extractErrorMessage(payload: unknown, response: Response): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === "string") {
      return record.error;
    }
    if (typeof record.detail === "string") {
      return record.detail;
    }
    if (Array.isArray(record.detail) && record.detail.length > 0) {
      const first = record.detail[0] as { msg?: unknown; loc?: unknown };
      if (first && typeof first.msg === "string") {
        const field = Array.isArray(first.loc) ? first.loc.join(".") : "";
        return field ? `${field}: ${first.msg}` : first.msg;
      }
    }
  }
  return `${response.status} ${response.statusText}`;
}

export async function fetchJson<T>(path: string): Promise<T> {
  return expectJson<T>(fetch(apiPath(path)));
}

export async function postJson<T>(path: string, body?: object): Promise<T> {
  return expectJson<T>(
    fetch(apiPath(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

export async function putJson<T>(path: string, body?: object): Promise<T> {
  return expectJson<T>(
    fetch(apiPath(path), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

export async function deleteJson<T>(path: string): Promise<T> {
  return expectJson<T>(fetch(apiPath(path), { method: "DELETE" }));
}
