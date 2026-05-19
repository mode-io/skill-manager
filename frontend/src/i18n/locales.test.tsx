import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LOCALE_STORAGE_KEY, LocaleProvider, useCommonCopy, useLocale } from ".";

function LocaleProbe() {
  const { locale, setLocale } = useLocale();
  const common = useCommonCopy();

  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <p>{common.nav.overview}</p>
      <p>{common.nav.skills}</p>
      <p>{common.nav.mcpServers}</p>
      <p>{common.nav.clis}</p>
      <button type="button" onClick={() => setLocale("zh-CN")}>
        中文
      </button>
    </div>
  );
}

describe("LocaleProvider", () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
  });

  it("defaults to English", () => {
    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("falls back to English for an invalid stored locale", () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "fr");

    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("switches to Chinese, preserves protected terms, and persists the locale", async () => {
    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "中文" }));

    expect(screen.getByTestId("locale")).toHaveTextContent("zh-CN");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh-CN");
    expect(screen.getByText("总览")).toBeInTheDocument();
    expect(screen.getByText("Skill")).toBeInTheDocument();
    expect(screen.getByText("MCP 服务器")).toBeInTheDocument();
    expect(screen.getByText("CLI")).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.lang).toBe("zh-CN"));
  });
});
