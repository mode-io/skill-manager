import { EventEmitter } from "node:events";
import path from "node:path";

import { describe, expect, test, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";

import { buildBackendEnv, parseBackendUrl, resolveBackendBinary, startBackend } from "./backend.js";

class FakeProcess extends EventEmitter {
  closeOnSigterm: boolean;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  killSignal: string | undefined;
  killSignals: string[] = [];

  constructor({ closeOnSigterm = true }: { closeOnSigterm?: boolean } = {}) {
    super();
    this.closeOnSigterm = closeOnSigterm;
  }

  kill(signal?: string): boolean {
    this.killed = true;
    this.killSignal = signal;
    this.killSignals.push(signal ?? "SIGTERM");
    if (signal === "SIGKILL" || this.closeOnSigterm) {
      queueMicrotask(() => this.emit("close", 0));
    }
    return true;
  }
}

describe("desktop backend process", () => {
  test("extracts the first local backend URL from stdout", () => {
    expect(parseBackendUrl("booting\nhttp://127.0.0.1:49321\nready")).toBe("http://127.0.0.1:49321");
  });

  test("resolves the development backend binary on macOS and Linux", () => {
    const repoRoot = path.resolve("/repo/skill-manager");

    expect(resolveBackendBinary({ platform: "darwin", repoRoot })).toBe(
      path.join(repoRoot, "dist", "skill-manager", "skill-manager"),
    );
    expect(resolveBackendBinary({ platform: "linux", repoRoot })).toBe(
      path.join(repoRoot, "dist", "skill-manager", "skill-manager"),
    );
  });

  test("resolves the packaged backend binary from Electron resources", () => {
    expect(
      resolveBackendBinary({
        platform: "darwin",
        resourcesPath: "/Applications/Skill Manager.app/Contents/Resources",
      }),
    ).toBe(
      path.join(
        "/Applications/Skill Manager.app/Contents/Resources",
        "backend",
        "skill-manager",
        "skill-manager",
      ),
    );
  });

  test("rejects unsupported platforms instead of adding Windows fallback paths", () => {
    expect(() => resolveBackendBinary({ platform: "win32", repoRoot: "/repo/skill-manager" })).toThrow(
      "Unsupported desktop platform",
    );
  });

  test("starts the backend, resolves its URL, and stops the process", async () => {
    const fakeProcess = new FakeProcess();
    const spawnFn = vi.fn(() => fakeProcess);
    const handlePromise = startBackend({
      binaryPath: "/repo/skill-manager/dist/skill-manager/skill-manager",
      spawnFn,
      timeoutMs: 100,
    });

    fakeProcess.stdout.emit("data", Buffer.from("http://127.0.0.1:50123\n"));

    const handle = await handlePromise;
    expect(handle.url).toBe("http://127.0.0.1:50123");
    expect(spawnFn).toHaveBeenCalledWith(
      "/repo/skill-manager/dist/skill-manager/skill-manager",
      ["serve", "--host", "127.0.0.1", "--port", "0", "--no-open-browser"],
      expect.objectContaining({
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );

    await handle.stop();

    expect(fakeProcess.killed).toBe(true);
    expect(fakeProcess.killSignal).toBe("SIGTERM");
  });

  test("adds common macOS user binary paths for packaged app launches", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "skill-manager-home-"));
    const nvmBin = path.join(home, ".nvm", "versions", "node", "v24.15.0", "bin");
    fs.mkdirSync(nvmBin, { recursive: true });

    const env = buildBackendEnv({
      HOME: home,
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    });

    expect(env.PATH?.split(":")).toContain(nvmBin);
    expect(env.PATH?.split(":")).toContain("/opt/homebrew/bin");
    expect(env.PYTHONUNBUFFERED).toBe("1");
  });

  test("escalates backend startup timeout cleanup when SIGTERM does not close the process", async () => {
    vi.useFakeTimers();
    const fakeProcess = new FakeProcess({ closeOnSigterm: false });
    const spawnFn = vi.fn(() => fakeProcess);
    const handlePromise = startBackend({
      binaryPath: "/repo/skill-manager/dist/skill-manager/skill-manager",
      spawnFn,
      timeoutMs: 10,
      forceKillAfterMs: 20,
    });
    const rejected = handlePromise.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(30);

    expect(await rejected).toBeInstanceOf(Error);
    expect(fakeProcess.killSignals).toEqual(["SIGTERM", "SIGKILL"]);
    vi.useRealTimers();
  });
});
