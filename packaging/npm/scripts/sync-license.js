#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const source = path.join(repoRoot, "LICENSE");
const destination = path.join(packageRoot, "LICENSE");

if (process.argv.includes("--clean")) {
  fs.rmSync(destination, { force: true });
} else {
  fs.copyFileSync(source, destination);
}
