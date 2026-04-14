#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { assertNoHomebrewConflict } = require("../scripts/channel-ownership");

const binaryPath = path.resolve(__dirname, "..", "vendor", "skill-manager", "skill-manager");

if (!fs.existsSync(binaryPath)) {
  console.error("skill-manager binary is missing. Reinstall the npm package to restore it.");
  process.exit(1);
}

try {
  assertNoHomebrewConflict({ invocationPath: process.argv[1] });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const result = spawnSync(binaryPath, process.argv.slice(2), {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
