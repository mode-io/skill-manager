import { describe, expect, it } from "vitest";
import type {
  PermissionInventoryEntryDto,
  PermissionInventoryColumnDto,
} from "../api/management-types";
import type { PermissionInventoryDto } from "../api/management-types";
import { filterPermissionsNeedsReview, matrixCellFor } from "./selectors";

describe("permissions selectors", () => {
  const column: PermissionInventoryColumnDto = {
    harness: "antigravity-permissions",
    label: "Antigravity",
    installed: true,
    configPresent: true,
    permissionsWritable: true,
  };

  it("appends caveat to tooltip for enabled permissions when caveat exists", () => {
    const entry: PermissionInventoryEntryDto = {
      id: "my-permission",
      displayName: "My Permission",
      kind: "managed",
      canEnable: true,
      enabledStatus: "enabled",
      sightings: [
        {
          harness: "antigravity-permissions",
          state: "managed",
          caveat: "On Antigravity this maps to PreInvocation, which fires before every model invocation, not only on user-prompt submit.",
        },
      ],
    };

    const cell = matrixCellFor(entry, column);
    expect(cell.state).toBe("enabled");
    expect(cell.tooltip).toBe(
      "Applied on Antigravity (Caveat: On Antigravity this maps to PreInvocation, which fires before every model invocation, not only on user-prompt submit.)"
    );
  });

  it("appends caveat to tooltip for disabled/missing permissions when caveat exists", () => {
    const entry: PermissionInventoryEntryDto = {
      id: "my-permission",
      displayName: "My Permission",
      kind: "managed",
      canEnable: true,
      enabledStatus: "disabled",
      sightings: [
        {
          harness: "antigravity-permissions",
          state: "missing",
          caveat: "On Antigravity this maps to PreInvocation, which fires before every model invocation, not only on user-prompt submit.",
        },
      ],
    };

    const cell = matrixCellFor(entry, column);
    expect(cell.state).toBe("disabled");
    expect(cell.tooltip).toBe(
      "Not applied on Antigravity (Caveat: On Antigravity this maps to PreInvocation, which fires before every model invocation, not only on user-prompt submit.)"
    );
  });

  it("filterPermissionsNeedsReview returns only unmanaged entries and honors search", () => {
    const inventory: PermissionInventoryDto = {
      columns: [column],
      entries: [
        {
          id: "managed-1",
          displayName: "allow · shell: git push",
          kind: "managed",
          canEnable: true,
          enabledStatus: "enabled",
          sightings: [{ harness: "antigravity-permissions", state: "managed" }],
        },
        {
          id: "manual:abc",
          displayName: "allow · shell: docker ps",
          kind: "unmanaged",
          spec: { id: "", decision: "allow", scope: "shell", pattern: "docker ps", description: "", installedAt: "", revision: "" },
          canEnable: true,
          enabledStatus: "disabled",
          sightings: [{ harness: "antigravity-permissions", state: "unmanaged" }],
        },
      ],
      issues: [],
    };

    const all = filterPermissionsNeedsReview(inventory, "");
    expect(all.map((e) => e.id)).toEqual(["manual:abc"]);

    expect(filterPermissionsNeedsReview(inventory, "docker")).toHaveLength(1);
    expect(filterPermissionsNeedsReview(inventory, "git push")).toHaveLength(0);
    expect(filterPermissionsNeedsReview(null, "")).toEqual([]);
  });

  it("does not append caveat when caveat is absent", () => {
    const entry: PermissionInventoryEntryDto = {
      id: "my-permission",
      displayName: "My Permission",
      kind: "managed",
      canEnable: true,
      enabledStatus: "enabled",
      sightings: [
        {
          harness: "antigravity-permissions",
          state: "managed",
        },
      ],
    };

    const cell = matrixCellFor(entry, column);
    expect(cell.state).toBe("enabled");
    expect(cell.tooltip).toBe("Applied on Antigravity");
  });
});
