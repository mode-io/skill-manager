#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const virtualEnvCandidates =
  process.platform === "win32"
    ? [
        path.join(repoRoot, ".venv", "Scripts", "python.exe"),
        path.join(repoRoot, ".venv-windows", "Scripts", "python.exe"),
      ]
    : [path.join(repoRoot, ".venv", "bin", "python")];
const candidates = [
  process.env.PYTHON_BIN,
  ...virtualEnvCandidates,
  process.platform === "win32" ? "python" : "python3",
  process.platform === "win32" ? "py" : "python",
].filter(Boolean);

function isPathCandidate(candidate) {
  return path.isAbsolute(candidate) || candidate.includes(path.sep);
}

let python;
for (const candidate of candidates) {
  if (isPathCandidate(candidate) && !fs.existsSync(candidate)) {
    continue;
  }
  const probe = spawnSync(candidate, ["--version"], {
    stdio: "ignore",
    windowsHide: true,
  });
  if (!probe.error && probe.status === 0) {
    python = candidate;
    break;
  }
}

if (!python) {
  console.error("Python 3.11+ was not found. Create .venv or set PYTHON_BIN.");
  process.exit(1);
}

const result = spawnSync(python, process.argv.slice(2), {
  cwd: repoRoot,
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 0);
