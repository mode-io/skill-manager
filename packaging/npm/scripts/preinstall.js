#!/usr/bin/env node

const { assertNoHomebrewConflict, isGlobalNpmInstall } = require("./channel-ownership");

try {
  assertNoHomebrewConflict({ globalInstall: isGlobalNpmInstall() });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
