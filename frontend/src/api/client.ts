import type { CatalogEntrySummary, CentralizeAllResult, ControlPlaneSummary, SkillListing } from "./types";

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

export async function centralizeSkill(skillRef: string): Promise<CatalogEntrySummary> {
  return expectJson<CatalogEntrySummary>(
    fetch(`/catalog/${encodeURIComponent(skillRef)}/centralize`, { method: "POST" }),
  );
}

export async function searchSources(query: string): Promise<SkillListing[]> {
  return expectJson<SkillListing[]>(fetch(`/search?q=${encodeURIComponent(query)}`));
}

export async function installSkill(sourceKind: string, sourceLocator: string): Promise<CatalogEntrySummary> {
  return expectJson<CatalogEntrySummary>(
    fetch("/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceKind, sourceLocator }),
    }),
  );
}

export async function updateSkill(skillRef: string): Promise<CatalogEntrySummary> {
  return expectJson<CatalogEntrySummary>(
    fetch(`/catalog/${encodeURIComponent(skillRef)}/update`, { method: "POST" }),
  );
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

export async function centralizeAll(): Promise<CentralizeAllResult> {
  return expectJson<CentralizeAllResult>(
    fetch("/centralize-all", { method: "POST" }),
  );
}
