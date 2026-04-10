import { describe, expect, it } from "vitest";

import { ScopedReconciliationTracker } from "./scoped-reconciliation";

describe("ScopedReconciliationTracker", () => {
  it("defers global invalidation until the last in-flight action settles", () => {
    const tracker = new ScopedReconciliationTracker<string>();

    tracker.begin("shared:doc");
    tracker.begin("shared:doc");
    tracker.begin("shared:pdf");

    expect(tracker.finish("shared:doc")).toEqual({
      invalidateAll: false,
      invalidateScope: false,
    });
    expect(tracker.finish("shared:doc")).toEqual({
      invalidateAll: false,
      invalidateScope: true,
    });
    expect(tracker.finish("shared:pdf")).toEqual({
      invalidateAll: true,
      invalidateScope: true,
    });
  });

  it("fails safe with a full invalidation when finish has no matching begin", () => {
    const tracker = new ScopedReconciliationTracker<string>();

    expect(tracker.finish("shared:doc")).toEqual({
      invalidateAll: true,
      invalidateScope: true,
    });
  });
});
