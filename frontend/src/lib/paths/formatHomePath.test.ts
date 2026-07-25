import { describe, expect, it } from "vitest";

import { formatHomePath } from "./formatHomePath";

const HOME = "/Users/hgill";

describe("formatHomePath", () => {
  it("abbreviates a nested path under home", () => {
    expect(formatHomePath("/Users/hgill/.hermes", HOME)).toBe("~/.hermes");
    expect(formatHomePath("/Users/hgill/.gemini/antigravity-cli", HOME)).toBe(
      "~/.gemini/antigravity-cli",
    );
  });

  it("abbreviates the home dir itself to ~", () => {
    expect(formatHomePath("/Users/hgill", HOME)).toBe("~");
  });

  it("leaves paths outside home untouched", () => {
    expect(formatHomePath("/etc/codex/skills", HOME)).toBe("/etc/codex/skills");
  });

  it("does not abbreviate a sibling dir that merely shares the prefix", () => {
    expect(formatHomePath("/Users/hgillmore/.hermes", HOME)).toBe("/Users/hgillmore/.hermes");
  });

  it("passes the path through unchanged when home is unknown", () => {
    expect(formatHomePath("/Users/hgill/.hermes", null)).toBe("/Users/hgill/.hermes");
    expect(formatHomePath("/Users/hgill/.hermes", undefined)).toBe("/Users/hgill/.hermes");
  });

  it("tolerates a trailing slash on home", () => {
    expect(formatHomePath("/Users/hgill/.hermes", "/Users/hgill/")).toBe("~/.hermes");
  });

  it("returns an empty string for empty input", () => {
    expect(formatHomePath(null, HOME)).toBe("");
    expect(formatHomePath(undefined, HOME)).toBe("");
  });
});
