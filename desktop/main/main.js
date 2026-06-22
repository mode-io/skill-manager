import { app, dialog } from "electron";

import { startBackend } from "./backend.js";
import { assertSupportedPlatform } from "./platform.js";
import { createMainWindow } from "./window.js";

let backendHandle = null;
let mainWindow = null;
let cleanupComplete = false;
let cleanupPromise = null;

async function boot() {
  assertSupportedPlatform();

  backendHandle = await startBackend({
    resourcesPath: app.isPackaged ? process.resourcesPath : undefined,
  });
  mainWindow = createMainWindow(backendHandle.url);
  mainWindow.once("closed", () => {
    mainWindow = null;
  });
}

async function stopBackend() {
  if (cleanupPromise) {
    return cleanupPromise;
  }

  cleanupPromise = (async () => {
    try {
      if (backendHandle) {
        await backendHandle.stop();
      }
    } catch (error) {
      console.error("Failed to stop skill-manager backend cleanly.", error);
    } finally {
      backendHandle = null;
      cleanupComplete = true;
    }
  })();
  return cleanupPromise;
}

app.whenReady().then(boot).catch((error) => {
  dialog.showErrorBox("Skill Manager failed to start", error instanceof Error ? error.message : String(error));
  void stopBackend().finally(() => {
    app.quit();
  });
});

app.on("before-quit", (event) => {
  if (cleanupComplete) {
    return;
  }

  event.preventDefault();
  void stopBackend().finally(() => {
    app.quit();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (!mainWindow && backendHandle) {
    mainWindow = createMainWindow(backendHandle.url);
    mainWindow.once("closed", () => {
      mainWindow = null;
    });
  }
});
