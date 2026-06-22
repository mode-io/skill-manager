import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BACKEND_FORCE_KILL_AFTER_MS, BACKEND_STARTUP_TIMEOUT_MS } from "./config.js";
import { assertSupportedPlatform } from "./platform.js";

const LOCAL_BACKEND_URL = /^https?:\/\/(?:127\.0\.0\.1|localhost):\d+(?:\/.*)?$/;

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(moduleDir, "../..");

export function parseBackendUrl(output) {
  for (const line of String(output).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (LOCAL_BACKEND_URL.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

export function resolveBackendBinary(options = {}) {
  const platform = options.platform ?? process.platform;
  assertSupportedPlatform(platform);

  if (options.binaryPath) {
    return options.binaryPath;
  }

  if (process.env.SKILL_MANAGER_BACKEND_BINARY) {
    return process.env.SKILL_MANAGER_BACKEND_BINARY;
  }

  if (options.resourcesPath) {
    return path.join(options.resourcesPath, "backend", "skill-manager", "skill-manager");
  }

  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  return path.join(repoRoot, "dist", "skill-manager", "skill-manager");
}

export function buildBackendEnv(baseEnv = process.env) {
  const pathSegments = [];
  const appendPath = (segment) => {
    if (segment && !pathSegments.includes(segment)) {
      pathSegments.push(segment);
    }
  };

  for (const segment of String(baseEnv.PATH ?? "").split(":")) {
    appendPath(segment);
  }

  const home = baseEnv.HOME;
  if (home) {
    appendPath(path.join(home, ".local", "bin"));
    const nvmVersionsDir = path.join(home, ".nvm", "versions", "node");
    try {
      for (const version of fs.readdirSync(nvmVersionsDir)) {
        appendPath(path.join(nvmVersionsDir, version, "bin"));
      }
    } catch {
      // Finder-launched macOS apps often have a minimal PATH; NVM may simply not be installed.
    }
  }

  for (const segment of [
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ]) {
    appendPath(segment);
  }

  return {
    ...baseEnv,
    PATH: pathSegments.join(":"),
    PYTHONUNBUFFERED: "1",
  };
}

export function startBackend(options = {}) {
  const binaryPath = options.binaryPath ?? resolveBackendBinary(options);
  const spawnFn = options.spawnFn ?? spawn;
  const timeoutMs = options.timeoutMs ?? BACKEND_STARTUP_TIMEOUT_MS;
  const forceKillAfterMs = options.forceKillAfterMs ?? BACKEND_FORCE_KILL_AFTER_MS;
  const args = ["serve", "--host", "127.0.0.1", "--port", "0", "--no-open-browser"];
  const backendProcess = spawnFn(binaryPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: buildBackendEnv(process.env),
  });

  let closed = false;
  let stderr = "";
  let stdout = "";

  backendProcess.once("close", () => {
    closed = true;
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      rejectOnce(new Error(`Timed out waiting for skill-manager backend to print its URL after ${timeoutMs}ms.`));
    }, timeoutMs);

    function rejectOnce(error) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      void terminateBackendProcess(backendProcess, {
        isClosed: () => closed,
        forceKillAfterMs,
      }).finally(() => {
        reject(error);
      });
    }

    function resolveOnce(url) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({
        url,
        stop: () =>
          terminateBackendProcess(backendProcess, {
            isClosed: () => closed,
            forceKillAfterMs,
          }),
      });
    }

    backendProcess.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      const url = parseBackendUrl(stdout);
      if (url) {
        resolveOnce(url);
      }
    });

    backendProcess.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    backendProcess.once("error", (error) => {
      rejectOnce(error);
    });

    backendProcess.once("close", (code, signal) => {
      if (!settled) {
        const suffix = stderr.trim() ? `\n${stderr.trim()}` : "";
        rejectOnce(new Error(`skill-manager backend exited before startup. code=${code} signal=${signal}${suffix}`));
      }
    });
  });
}

export function terminateBackendProcess(
  backendProcess,
  { isClosed = () => false, forceKillAfterMs = BACKEND_FORCE_KILL_AFTER_MS } = {},
) {
  if (isClosed()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let finished = false;
    function finish() {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(forceTimer);
      resolve();
    }

    const forceTimer = setTimeout(() => {
      if (!isClosed()) {
        backendProcess.kill("SIGKILL");
      }
      finish();
    }, forceKillAfterMs);

    backendProcess.once("close", finish);
    backendProcess.kill("SIGTERM");
  });
}
