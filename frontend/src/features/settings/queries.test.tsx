import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mcpManagementKeys } from "../mcp/public";
import { skillsKeys } from "../skills/public";
import { okJson } from "../../test/fetch";
import { renderWithAppProviders } from "../../test/render";
import { settingsKeys, useHarnessSupportMutation } from "./queries";

const fetchMock = vi.fn();

function HarnessSupportProbe() {
  const mutation = useHarnessSupportMutation();

  return (
    <button
      type="button"
      onClick={() => mutation.mutate({ harness: "codex", enabled: false })}
    >
      Disable Codex support
    </button>
  );
}

describe("settings queries", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("invalidates settings, skills, and MCP after harness support changes", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/settings/harnesses/codex/support") {
        expect(init?.method).toBe("PUT");
        expect(JSON.parse(String(init?.body))).toEqual({ enabled: false });
        return okJson({ ok: true, enabled: false });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    const { queryClient } = renderWithAppProviders(<HarnessSupportProbe />);
    queryClient.setQueryData(settingsKeys.detail(), {
      harnesses: [
        {
          harness: "codex",
          label: "Codex",
          logoKey: "codex",
          supportEnabled: true,
          installed: true,
          managedLocation: "/tmp/codex",
        },
      ],
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    fireEvent.click(screen.getByRole("button", { name: "Disable Codex support" }));

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mcpManagementKeys.all }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: settingsKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: skillsKeys.list() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: skillsKeys.detailPrefix() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: skillsKeys.sourceStatusPrefix() });
  });
});
