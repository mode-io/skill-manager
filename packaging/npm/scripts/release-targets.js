#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const targetsPath = path.resolve(__dirname, "..", "release-targets.json");

function loadTargets() {
  const payload = JSON.parse(fs.readFileSync(targetsPath, "utf8"));
  if (!Array.isArray(payload.targets)) {
    throw new Error(`Release target file is missing a targets list: ${targetsPath}`);
  }
  return payload.targets;
}

function resolveTarget({ platform = process.platform, arch = process.arch } = {}) {
  const target = loadTargets().find((item) => item.nodePlatform === platform && item.nodeArch === arch);
  if (!target) {
    throw new Error(`No packaged release artifact is available for platform=${platform} architecture=${arch}.`);
  }
  return target;
}

function artifactName(version, target = resolveTarget()) {
  return `skill-manager-v${version}-${target.id}.tar.gz`;
}

module.exports = {
  artifactName,
  loadTargets,
  resolveTarget,
};
