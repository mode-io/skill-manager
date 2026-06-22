import { describe, expect, test } from "vitest";

import { assertSupportedPlatform, isSupportedPlatform, SUPPORTED_PLATFORMS } from "./platform.js";

describe("desktop platform policy", () => {
  test("supports only macOS and Linux", () => {
    expect(SUPPORTED_PLATFORMS).toEqual(new Set(["darwin", "linux"]));
    expect(isSupportedPlatform("darwin")).toBe(true);
    expect(isSupportedPlatform("linux")).toBe(true);
    expect(isSupportedPlatform("win32")).toBe(false);
  });

  test("throws a consistent error for unsupported platforms", () => {
    expect(() => assertSupportedPlatform("win32")).toThrow("Unsupported desktop platform: win32");
  });
});
