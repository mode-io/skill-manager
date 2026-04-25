import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

if (typeof ResizeObserver === "undefined") {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserver);
}
