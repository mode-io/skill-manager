#!/usr/bin/env node
/**
 * Dependency audit gate: fails when `npm audit` reports high/critical
 * advisories in production dependencies, minus a reviewed allowlist.
 *
 * `npm audit` has no built-in ignore mechanism, so exemptions live here.
 * Every allowlist entry MUST state why the advisory does not apply and when
 * to re-check. Keep entries rare and specific.
 */
"use strict";

const { spawnSync } = require("node:child_process");

const ALLOWLIST = [
  {
    advisory: "GHSA-qwww-vcr4-c8h2", // react-router RSC-mode CSRF bypass
    package: "react-router",
    reason:
      "Affects only the unstable RSC / server-action code paths (patched in 8.3.0). " +
      "skill-manager is a client-only SPA: react-router-dom in library mode, no SSR, " +
      "no RSC, no framework mode. Re-check if the app adopts SSR/RSC or upgrades " +
      "react-router within the affected range.",
  },
];

const FAIL_SEVERITIES = new Set(["high", "critical"]);

function collectAdvisories(auditJson) {
  // npm audit attributes advisories two ways: inline objects on the owning
  // package, and plain strings ("react-router-dom" via ["react-router"]) that
  // point at another entry in the vulnerabilities map. Follow the strings so
  // every finding names the package that actually carries the advisory.
  const vulnerabilities = auditJson.vulnerabilities ?? {};
  const findings = [];
  const seen = new Set();

  function visit(name, seenPackages) {
    const vuln = vulnerabilities[name];
    if (!vuln) return;
    const via = Array.isArray(vuln.via) ? vuln.via : [];
    for (const entry of via) {
      if (typeof entry === "string") {
        if (!seenPackages.has(entry)) {
          seenPackages.add(entry);
          visit(entry, seenPackages);
        }
        continue;
      }
      if (entry && typeof entry === "object" && entry.url) {
        const finding = {
          name,
          severity: entry.severity ?? vuln.severity,
          id: extractAdvisoryId(entry.url),
          title: entry.title,
        };
        const key = `${finding.name}|${finding.id}|${finding.title}`;
        if (!seen.has(key)) {
          seen.add(key);
          findings.push(finding);
        }
      }
    }
  }

  for (const name of Object.keys(vulnerabilities)) {
    visit(name, new Set([name]));
  }
  return findings;
}

function extractAdvisoryId(url) {
  const match = /advisories\/(GHSA-[a-z0-9-]+)/i.exec(String(url ?? ""));
  return match ? match[1] : null;
}

function main() {
  // AUDIT_GATE_JSON_FILE reads a saved `npm audit --json` payload instead of
  // querying npm — used to test the gate against recorded advisory shapes.
  let auditJson;
  const replayFile = process.env.AUDIT_GATE_JSON_FILE;
  if (replayFile) {
    const { readFileSync } = require("node:fs");
    auditJson = JSON.parse(readFileSync(replayFile, "utf-8"));
  } else {
    const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf-8" });
    try {
      auditJson = JSON.parse(result.stdout);
    } catch {
      process.stderr.write(`audit_gate: could not parse npm audit output.\n${result.stderr}\n${result.stdout}\n`);
      process.exit(2);
    }
  }

  const findings = collectAdvisories(auditJson);
  const failures = [];
  for (const finding of findings) {
    if (!FAIL_SEVERITIES.has(finding.severity)) {
      process.stdout.write(`info: ${finding.severity} ${finding.name} (${finding.id ?? finding.title}) — below gate threshold\n`);
      continue;
    }
    const exemption = ALLOWLIST.find((entry) => entry.advisory === finding.id && entry.package === finding.name);
    if (exemption) {
      process.stdout.write(`allowlisted: ${finding.id} ${finding.name} — ${exemption.reason}\n`);
      continue;
    }
    failures.push(finding);
  }

  if (failures.length > 0) {
    process.stderr.write("\nDependency audit gate FAILED:\n");
    for (const failure of failures) {
      process.stderr.write(`  ${failure.severity}  ${failure.name}  ${failure.id ?? ""}  ${failure.title}\n`);
    }
    process.stderr.write("Fix the dependency, or add a justified allowlist entry in scripts/audit_gate.cjs.\n");
    process.exit(1);
  }
  process.stdout.write("Dependency audit gate passed.\n");
}

main();
