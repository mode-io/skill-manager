import type { CatalogEntrySummary, ControlPlaneSummary } from "./types";

async function expectJson<T>(responsePromise: Promise<Response>): Promise<T> {
  const response = await responsePromise;
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchControlPlaneSummary(): Promise<ControlPlaneSummary> {
  const [harnesses, catalog, check] = await Promise.all([
    expectJson(fetch("/harnesses")),
    expectJson(fetch("/catalog")),
    expectJson(fetch("/check")),
  ]);
  return { harnesses, catalog, check };
}

export async function toggleBinding(
  skillRef: string,
  action: "enable" | "disable",
  harness: string,
): Promise<CatalogEntrySummary> {
  return expectJson<CatalogEntrySummary>(
    fetch(`/catalog/${encodeURIComponent(skillRef)}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ harness }),
    }),
  );
}
