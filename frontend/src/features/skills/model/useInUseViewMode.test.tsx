import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useInUseViewMode } from "./useInUseViewMode";

function Probe() {
  const [mode] = useInUseViewMode();
  const location = useLocation();
  return (
    <>
      <div data-testid="mode">{mode}</div>
      <div data-testid="search">{location.search}</div>
    </>
  );
}

function renderProbe(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <Probe />
    </MemoryRouter>,
  );
}

describe("useInUseViewMode", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
      },
    });
  });

  it("uses matrix as the canonical skills coverage view", () => {
    renderProbe("/skills/use?view=matrix");

    expect(screen.getByTestId("mode")).toHaveTextContent("matrix");
  });

  it("canonicalizes the legacy table URL value to matrix", async () => {
    renderProbe("/skills/use?view=table");

    expect(screen.getByTestId("mode")).toHaveTextContent("matrix");
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("?view=matrix"));
  });

  it("canonicalizes the legacy stored table preference to matrix", async () => {
    window.localStorage.setItem("skillmgr.inUse.view", "table");

    renderProbe("/skills/use");

    expect(screen.getByTestId("mode")).toHaveTextContent("matrix");
    await waitFor(() => expect(window.localStorage.getItem("skillmgr.inUse.view")).toBe("matrix"));
  });
});
