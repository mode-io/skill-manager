import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

import { installMockLocalStorage } from "./local-storage";

try {
  if (typeof window.localStorage.clear !== "function") {
    installMockLocalStorage();
  }
} catch {
  installMockLocalStorage();
}

if (typeof ResizeObserver === "undefined") {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserver);
}
