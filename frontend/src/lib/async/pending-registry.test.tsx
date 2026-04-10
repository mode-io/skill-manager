import { describe, expect, it } from "vitest";

import { PendingRegistry } from "./pending-registry";

describe("PendingRegistry", () => {
  it("tracks pending keys until the final matching finish", () => {
    const registry = new PendingRegistry<string>();

    registry.begin("settings:support:codex");
    registry.begin("settings:support:codex");

    expect(registry.isPending("settings:support:codex")).toBe(true);
    expect(registry.hasAnyPending()).toBe(true);

    registry.finish("settings:support:codex");
    expect(registry.isPending("settings:support:codex")).toBe(true);

    registry.finish("settings:support:codex");
    expect(registry.isPending("settings:support:codex")).toBe(false);
    expect(registry.hasAnyPending()).toBe(false);
  });

  it("keeps other keys pending when one key finishes", () => {
    const registry = new PendingRegistry<string>();

    registry.begin("marketplace:search:trace");
    registry.begin("marketplace:install:mode-switch");

    registry.finish("marketplace:search:trace");

    expect(registry.isPending("marketplace:search:trace")).toBe(false);
    expect(registry.isPending("marketplace:install:mode-switch")).toBe(true);
    expect(registry.snapshot()).toEqual(new Set(["marketplace:install:mode-switch"]));
  });
});
