import { describe, expect, it } from "vitest";

import { ToggleReconciliationTracker } from "./toggle-reconciliation";

describe("ToggleReconciliationTracker", () => {
  it("defers list invalidation until the last toggle settles globally", () => {
    const tracker = new ToggleReconciliationTracker();

    tracker.begin("shared:doc");
    tracker.begin("shared:doc");
    tracker.begin("shared:pdf");

    expect(tracker.finish("shared:doc")).toEqual({
      invalidateList: false,
      invalidateSkill: false,
    });
    expect(tracker.finish("shared:doc")).toEqual({
      invalidateList: false,
      invalidateSkill: true,
    });
    expect(tracker.finish("shared:pdf")).toEqual({
      invalidateList: true,
      invalidateSkill: true,
    });
  });

  it("invalidates skill detail once the last toggle for that skill settles even if other skills remain in flight", () => {
    const tracker = new ToggleReconciliationTracker();

    tracker.begin("shared:doc");
    tracker.begin("shared:pdf");

    expect(tracker.finish("shared:doc")).toEqual({
      invalidateList: false,
      invalidateSkill: true,
    });
  });

  it("fails safe with a full refresh decision when finish is called without a matching begin", () => {
    const tracker = new ToggleReconciliationTracker();

    expect(tracker.finish("shared:doc")).toEqual({
      invalidateList: true,
      invalidateSkill: true,
    });
  });
});
