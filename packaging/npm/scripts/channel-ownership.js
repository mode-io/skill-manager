#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REMEDIATION_MESSAGE = "skill-manager is already installed via Homebrew. Run 'brew uninstall skill-manager' before 'npm install -g @mode-io/skill-manager', or keep using the Homebrew installation.";

function isGlobalNpmInstall() {
  const value = String(process.env.npm_config_global || "").toLowerCase();
  return value === "true" || value === "1";
}

function isRepoCheckout(packageRoot = packageRootPath()) {
  let current = packageRoot;
  for (let depth = 0; depth < 4; depth += 1) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return true;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return false;
}

function isLocalBinInvocation(invocationPath) {
  if (!invocationPath) {
    return false;
  }
  const normalized = path.resolve(invocationPath);
  return normalized.includes(`${path.sep}node_modules${path.sep}.bin${path.sep}`);
}

function packageRootPath() {
  return path.resolve(__dirname, "..");
}

function isNonEmptyDirectory(directory) {
  try {
    return fs.statSync(directory).isDirectory() && fs.readdirSync(directory).length > 0;
  } catch {
    return false;
  }
}

function detectHomebrewInstall() {
  const prefixes = new Set();
  const envPrefix = String(process.env.HOMEBREW_PREFIX || "").trim();
  if (envPrefix) {
    prefixes.add(envPrefix);
  }

  const brewPrefix = spawnSync("brew", ["--prefix"], { encoding: "utf8" });
  if (brewPrefix.status === 0 && brewPrefix.stdout.trim()) {
    prefixes.add(brewPrefix.stdout.trim());
  } else {
    prefixes.add("/opt/homebrew");
    prefixes.add("/usr/local");
  }

  const brewList = spawnSync("brew", ["list", "--versions", "skill-manager"], { encoding: "utf8" });
  if (brewList.status === 0 && brewList.stdout.trim()) {
    return true;
  }

  for (const prefix of prefixes) {
    if (!prefix) {
      continue;
    }
    if (fs.existsSync(path.join(prefix, "opt", "skill-manager"))) {
      return true;
    }
    if (isNonEmptyDirectory(path.join(prefix, "Cellar", "skill-manager"))) {
      return true;
    }
  }
  return false;
}

function assertNoHomebrewConflict({ globalInstall = false, invocationPath } = {}) {
  if (isRepoCheckout()) {
    return;
  }
  if (!globalInstall && !invocationPath) {
    return;
  }
  if (!globalInstall && isLocalBinInvocation(invocationPath)) {
    return;
  }
  if (!detectHomebrewInstall()) {
    return;
  }
  throw new Error(REMEDIATION_MESSAGE);
}

module.exports = {
  REMEDIATION_MESSAGE,
  assertNoHomebrewConflict,
  detectHomebrewInstall,
  isGlobalNpmInstall,
  isLocalBinInvocation,
  isRepoCheckout,
};
