import { describe, expect, test } from "vitest";

import { shouldOpenExternal } from "./navigation.js";

describe("desktop navigation policy", () => {
  test("keeps backend-origin navigation inside the app", () => {
    expect(shouldOpenExternal("http://127.0.0.1:5000/overview", "http://127.0.0.1:5000")).toBe(false);
  });

  test("opens http and https links outside the backend origin externally", () => {
    expect(shouldOpenExternal("https://example.com/docs", "http://127.0.0.1:5000")).toBe(true);
    expect(shouldOpenExternal("http://example.com/docs", "http://127.0.0.1:5000")).toBe(true);
  });

  test("ignores unsupported protocols and malformed URLs without throwing", () => {
    expect(shouldOpenExternal("mailto:support@example.com", "http://127.0.0.1:5000")).toBe(false);
    expect(shouldOpenExternal("::::", "http://127.0.0.1:5000")).toBe(false);
  });
});
