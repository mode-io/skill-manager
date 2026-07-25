import { describe, expect, it } from "vitest";

import type { HookInventoryColumnDto, HookInventoryEntryDto } from "../api/management-types";
import { bucketForHookEntry, bucketHookEntries } from "./bucketForEntry";

const columns: HookInventoryColumnDto[] = [
  { harness: "h0", label: "H0", logoKey: null, installed: true, configPresent: true, hooksWritable: true },
  { harness: "h1", label: "H1", logoKey: null, installed: true, configPresent: true, hooksWritable: true },
];

function entry(id: string, states: ("managed" | "drifted" | "missing")[]): HookInventoryEntryDto {
  return {
    id,
    displayName: id,
    kind: "managed",
    canEnable: true,
    enabledStatus: states.some((s) => s === "managed") ? "enabled" : "disabled",
    spec: null,
    sightings: states.map((state, i) => ({ harness: `h${i}`, state })),
  } as HookInventoryEntryDto;
}

describe("bucketForHookEntry", () => {
  it("classifies all-managed as 'enabled'", () => {
    expect(bucketForHookEntry(entry("a", ["managed", "managed"]), columns)).toBe("enabled");
  });

  it("classifies none-managed as 'disabled'", () => {
    expect(bucketForHookEntry(entry("a", ["missing", "missing"]), columns)).toBe("disabled");
  });

  it("classifies mixed as 'selective'", () => {
    expect(bucketForHookEntry(entry("a", ["managed", "missing"]), columns)).toBe("selective");
  });

  it("treats entries with no addressable harnesses as 'disabled'", () => {
    expect(bucketForHookEntry(entry("a", []), [])).toBe("disabled");
  });
});

describe("bucketHookEntries", () => {
  it("partitions entries into three buckets preserving order", () => {
    const a = entry("a", ["missing", "missing"]);
    const b = entry("b", ["managed", "missing"]);
    const c = entry("c", ["managed", "managed"]);
    const result = bucketHookEntries([a, b, c], columns);
    expect(result.disabled.map((e) => e.id)).toEqual(["a"]);
    expect(result.selective.map((e) => e.id)).toEqual(["b"]);
    expect(result.enabled.map((e) => e.id)).toEqual(["c"]);
  });
});
