import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/* Static, re-exported, side-effect, and dynamic specifiers. Statement forms are
 * anchored to the start of a line so an "import" string literal cannot open a
 * match, and the clause before `from` is restricted to identifier characters so
 * a match cannot run across statements. */
const SPECIFIER_PATTERNS = [
  /^\s*import\s+[\w${},*\s]*?\bfrom\s*["']([^"']+)["']/gm,
  /^\s*export\s+[\w${},*\s]*?\bfrom\s*["']([^"']+)["']/gm,
  /^\s*import\s*["']([^"']+)["']/gm,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

const PUBLIC_ENTRY = /^features\/[^/]+\/public\.tsx?$/;

/* App.tsx owns the route table, main.tsx owns style registration, and the
 * shared fixtures build DTOs from each feature's api types. */
const EXCEPTIONS = [
  { importer: /^App\.tsx$/, target: /^features\/[^/]+\/screens\// },
  { importer: /^main\.tsx$/, target: /^features\/[^/]+\/styles\// },
  { importer: /^test\//, target: /^features\/[^/]+\/api\// },
];

describe("feature public import boundaries", () => {
  it("keeps cross-feature imports on public APIs", () => {
    const root = join(process.cwd(), "frontend", "src");
    const violations: string[] = [];
    for (const file of sourceFiles(root)) {
      const importer = relative(root, file);
      for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
        const target = resolveModule(file, specifier);
        if (target && crossesFeatureBoundary(importer, relative(root, target))) {
          violations.push(`${importer} → ${relative(root, target)}`);
        }
      }
    }

    expect(violations, "cross-feature imports must go through features/<name>/public").toEqual([]);
  });
});

function crossesFeatureBoundary(importer: string, target: string): boolean {
  const feature = featureName(target);
  if (!feature || featureName(importer) === feature || PUBLIC_ENTRY.test(target)) {
    return false;
  }
  return !EXCEPTIONS.some((rule) => rule.importer.test(importer) && rule.target.test(target));
}

function featureName(path: string): string | null {
  const segments = path.split("/");
  return segments[0] === "features" && segments.length > 2 ? segments[1] : null;
}

function importSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      specifiers.add(match[1]);
    }
  }
  return [...specifiers];
}

function resolveModule(file: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }
  const base = resolve(dirname(file), specifier);
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = `${base}${suffix}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

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
