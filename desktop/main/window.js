import { BrowserWindow, shell } from "electron";

import { APP_NAME, MAIN_WINDOW_BOUNDS } from "./config.js";
import { shouldOpenExternal } from "./navigation.js";

export function createMainWindow(backendUrl) {
  const window = new BrowserWindow({
    width: MAIN_WINDOW_BOUNDS.width,
    height: MAIN_WINDOW_BOUNDS.height,
    minWidth: MAIN_WINDOW_BOUNDS.minWidth,
    minHeight: MAIN_WINDOW_BOUNDS.minHeight,
    show: false,
    title: APP_NAME,
    backgroundColor: "#0b0c0f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  const backendOrigin = new URL(backendUrl).origin;
  window.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalIfNeeded(url, backendOrigin);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (openExternalIfNeeded(url, backendOrigin)) {
      event.preventDefault();
    }
  });

  const startUrl = new URL("/overview", backendUrl);
  void window.loadURL(startUrl.toString());
  return window;
}

function openExternalIfNeeded(url, backendOrigin) {
  if (!shouldOpenExternal(url, backendOrigin)) {
    return false;
  }

  void shell.openExternal(url);
  return true;
}
