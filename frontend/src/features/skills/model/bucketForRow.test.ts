import { describe, expect, it } from "vitest";

import { bucketForRow, bucketRows } from "./bucketForRow";
import type { HarnessCell, SkillListRow } from "./types";

function row(cells: HarnessCell[], skillRef = "test:row"): SkillListRow {
  return {
    skillRef,
    name: "Test skill",
    description: "",
    displayStatus: "Managed",
    actions: { canManage: false, canStopManaging: true, canDelete: false },
    cells,
  } as unknown as SkillListRow;
}

const enabled: HarnessCell = { harness: "codex", label: "Codex", state: "enabled", interactive: true };
const disabled: HarnessCell = { harness: "cursor", label: "Cursor", state: "disabled", interactive: true };
const found: HarnessCell = { harness: "claude", label: "Claude", state: "found", interactive: false };
const empty: HarnessCell = { harness: "other", label: "Other", state: "empty", interactive: false };

describe("bucketForRow", () => {
  it("classifies all-enabled as 'enabled'", () => {
    expect(bucketForRow(row([enabled, { ...enabled, harness: "cursor", label: "Cursor" }]))).toBe("enabled");
  });

  it("classifies all-disabled as 'disabled'", () => {
    expect(bucketForRow(row([disabled, { ...disabled, harness: "codex", label: "Codex" }]))).toBe("disabled");
  });

  it("classifies mixed interactive states as 'selective'", () => {
    expect(bucketForRow(row([enabled, disabled]))).toBe("selective");
  });

  it("ignores non-interactive cells when classifying", () => {
    expect(bucketForRow(row([enabled, found, empty]))).toBe("enabled");
    expect(bucketForRow(row([disabled, found, empty]))).toBe("disabled");
    expect(bucketForRow(row([enabled, disabled, found]))).toBe("selective");
  });

  it("treats rows with no interactive cells as 'enabled'", () => {
    expect(bucketForRow(row([found, empty]))).toBe("enabled");
    expect(bucketForRow(row([]))).toBe("enabled");
  });
});

describe("bucketRows", () => {
  it("partitions rows into three buckets preserving order", () => {
    const a = row([disabled], "a");
    const b = row([enabled, disabled], "b");
    const c = row([enabled], "c");
    const d = row([disabled, disabled], "d");
    const result = bucketRows([a, b, c, d]);
    expect(result.disabled.map((r) => r.skillRef)).toEqual(["a", "d"]);
    expect(result.selective.map((r) => r.skillRef)).toEqual(["b"]);
    expect(result.enabled.map((r) => r.skillRef)).toEqual(["c"]);
  });
});
