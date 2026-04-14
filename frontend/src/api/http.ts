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
