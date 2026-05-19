#!/usr/bin/env node

const assert = require("node:assert/strict");
const { artifactName, resolveTarget } = require("../packaging/npm/scripts/release-targets");

const cases = [
  ["darwin", "arm64", "skill-manager-v1.2.3-darwin-arm64.tar.gz"],
  ["darwin", "x64", "skill-manager-v1.2.3-darwin-x64.tar.gz"],
  ["linux", "x64", "skill-manager-v1.2.3-linux-x64.tar.gz"],
  ["linux", "arm64", "skill-manager-v1.2.3-linux-arm64.tar.gz"],
];

for (const [platform, arch, expected] of cases) {
  assert.equal(artifactName("1.2.3", resolveTarget({ platform, arch })), expected);
}

assert.throws(() => resolveTarget({ platform: "win32", arch: "x64" }), /No packaged release artifact/);

console.log("release target JS resolver ok");
