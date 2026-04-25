import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN = [
  ["../..", "mcp", "api"].join("/"),
  ["../..", "skills", "api"].join("/"),
  ["../..", "settings", "queries"].join("/"),
  ["..", "mcp", "api"].join("/"),
  ["..", "skills", "api"].join("/"),
  ["..", "settings", "queries"].join("/"),
];

describe("feature public import boundaries", () => {
  it("keeps cross-feature imports on public APIs", () => {
    const root = join(process.cwd(), "frontend", "src");
    const violations: string[] = [];
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, "utf8");
      if (FORBIDDEN.some((pattern) => source.includes(pattern))) {
        violations.push(relative(root, file));
      }
    }

    expect(violations).toEqual([]);
  });
});

function sourceFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      result.push(...sourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      result.push(path);
    }
  }
  return result;
}
