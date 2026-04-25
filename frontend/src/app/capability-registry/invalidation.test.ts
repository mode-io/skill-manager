import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";

import { invalidateCapabilityQueries } from "./invalidation";

describe("capability invalidation", () => {
  it("invalidates every capability-backed app surface", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    await invalidateCapabilityQueries(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["skills", "list"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["skills", "detail"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["skills", "source-status"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["mcp"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["settings"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["marketplace"] });
  });
});
