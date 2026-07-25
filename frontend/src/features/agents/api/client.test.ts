import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { okJson } from "../../../test/fetch";
import {
  adoptAgent,
  adoptAllAgents,
  createAgent,
  deleteAgent,
  disableAgent,
  enableAgent,
  fetchAgentsInventory,
  fetchAgentDetail,
  setAgentHarnesses,
  updateAgent,
} from "./client";

/**
 * These assert the FULLY COMPOSED url, not a substring.
 *
 * The http helpers already run every path through `apiPath`, which prepends the
 * `/api` base. A client that also spells `/api/...` produces `/api/api/...` — which
 * a `.includes("/enable")` style assertion happily passes. That shipped once.
 */
const fetchMock = vi.fn();

function calledUrl(index = 0): string {
  return String(fetchMock.mock.calls[index][0]);
}

describe("agents api client urls", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(okJson({}));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never doubles the /api base", async () => {
    await fetchAgentsInventory();
    expect(calledUrl()).toBe("/api/agents");
    expect(calledUrl()).not.toContain("/api/api");
  });

  it("composes fetchAgentDetail url exactly", async () => {
    await fetchAgentDetail("red-team");
    expect(calledUrl()).toBe("/api/agents/red-team");
  });

  it("composes every mutation path exactly once", async () => {
    await createAgent({ name: "Red Team", description: "d", prompt: "p", tools: [] });
    expect(calledUrl()).toBe("/api/agents");

    fetchMock.mockClear();
    await updateAgent({ ref: "red-team", request: { description: "d2" } });
    expect(calledUrl()).toBe("/api/agents/red-team");

    fetchMock.mockClear();
    await deleteAgent("red-team");
    expect(calledUrl()).toBe("/api/agents/red-team");

    fetchMock.mockClear();
    await enableAgent("red-team", "claude");
    expect(calledUrl()).toBe("/api/agents/red-team/enable");

    fetchMock.mockClear();
    await disableAgent("red-team", "claude");
    expect(calledUrl()).toBe("/api/agents/red-team/disable");

    fetchMock.mockClear();
    await setAgentHarnesses("red-team", ["claude"]);
    expect(calledUrl()).toBe("/api/agents/red-team/set-harnesses");

    fetchMock.mockClear();
    await adoptAllAgents();
    expect(calledUrl()).toBe("/api/agents/adopt-all");
  });

  it("keeps the slash in a namespaced unmanaged ref", async () => {
    // Unmanaged refs are `<harness>/<slug>`; the backend route is a :path param,
    // so the slash must survive into the url rather than being percent-encoded.
    await adoptAgent("claude/stray");
    expect(calledUrl()).toBe("/api/agents/claude/stray/adopt");
    expect(calledUrl()).not.toContain("%2F");
  });

  it("sends the conflict resolution as a body, and reads a 409 back", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: "Conflict",
      json: async () => ({
        conflict: "store-name-exists",
        slug: "stray",
        storePath: "/store/stray.md",
        harnessPath: "/home/.claude/agents/stray.md",
      }),
    } as Response);

    const conflict = await adoptAgent("claude/stray");

    expect(conflict).toMatchObject({ conflict: "store-name-exists", slug: "stray" });

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(okJson({ ok: true, ref: "stray" }));
    await adoptAgent("claude/stray", "keep_store");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      onConflict: "keep_store",
    });
  });
});
