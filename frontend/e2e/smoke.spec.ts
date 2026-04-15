import { expect, test } from "@playwright/test";

test("renders the managed skills page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Skills", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Managed skills" })).toBeVisible();
  await expect(page.getByPlaceholder("Search managed skills by name, description, or state")).toBeVisible();
  await expect(page.getByLabel("Managed skills list")).toBeVisible();
  await expect(page.getByRole("switch").first()).toBeVisible();
  await expect(page.getByText("Shared Audit")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Skills views" }).getByRole("link", { name: /Unmanaged/i })).toBeVisible();
});

test("keeps managed skills scroll contained to the list surface on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByLabel("Managed skills list")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const scroller = document.querySelector(".skills-pane__scroll") as HTMLDivElement | null;
    const chrome = document.querySelector(".skills-pane__chrome") as HTMLElement | null;
    const content = document.querySelector(".skills-pane__content") as HTMLElement | null;
    if (!scroller || !chrome) {
      throw new Error("Skills pane scaffold was not rendered.");
    }
    if (content) {
      content.style.minHeight = `${scroller.clientHeight + 640}px`;
    }
    const chromeTop = Math.round(chrome.getBoundingClientRect().top);
    scroller.scrollTop = 320;
    window.scrollTo(0, 240);

    return {
      windowScrollY: window.scrollY,
      bodyScrollHeight: document.body.scrollHeight,
      viewportHeight: window.innerHeight,
      chromeTop,
      chromeTopAfterScroll: Math.round(chrome.getBoundingClientRect().top),
      scrollerClientHeight: scroller.clientHeight,
      scrollerScrollHeight: scroller.scrollHeight,
      scrollerScrollTop: scroller.scrollTop,
    };
  });

  expect(metrics.windowScrollY).toBe(0);
  expect(metrics.bodyScrollHeight).toBe(metrics.viewportHeight);
  expect(metrics.scrollerScrollHeight).toBeGreaterThan(metrics.scrollerClientHeight);
  expect(metrics.scrollerScrollTop).toBe(320);
  expect(metrics.chromeTopAfterScroll).toBe(metrics.chromeTop);
});

test("keeps managed skills scroll contained to the list surface below the old breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/");
  await expect(page.getByLabel("Managed skills list")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const scroller = document.querySelector(".skills-pane__scroll") as HTMLDivElement | null;
    const content = document.querySelector(".skills-pane__content") as HTMLElement | null;
    if (!scroller) {
      throw new Error("Skills pane scroller was not rendered.");
    }
    if (content) {
      content.style.minHeight = `${scroller.clientHeight + 520}px`;
    }
    scroller.scrollTop = 260;
    window.scrollTo(0, 180);

    return {
      windowScrollY: window.scrollY,
      bodyScrollHeight: document.body.scrollHeight,
      viewportHeight: window.innerHeight,
      scrollerClientHeight: scroller.clientHeight,
      scrollerScrollHeight: scroller.scrollHeight,
      scrollerScrollTop: scroller.scrollTop,
    };
  });

  expect(metrics.windowScrollY).toBe(0);
  expect(metrics.bodyScrollHeight).toBe(metrics.viewportHeight);
  expect(metrics.scrollerScrollHeight).toBeGreaterThan(metrics.scrollerClientHeight);
  expect(metrics.scrollerScrollTop).toBe(260);
});

test("renders the unmanaged intake page", async ({ page }) => {
  await page.goto("/skills/unmanaged");
  await expect(page.getByRole("heading", { name: "Unmanaged skills" })).toBeVisible();
  await expect(page.getByPlaceholder("Search unmanaged skills by name, description, or tool")).toBeVisible();
  await expect(page.getByLabel("Unmanaged skills list")).toBeVisible();
  await expect(page.getByText("Trace Lens")).toBeVisible();
  await expect(page.getByRole("button", { name: "Bring all eligible skills under management" })).toBeVisible();
});

test("restores managed list scroll after switching tabs", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByLabel("Managed skills list")).toBeVisible();

  await page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = ".skills-pane__content { min-height: 1200px; }";
    document.head.appendChild(style);
    const scroller = document.querySelector(".skills-pane__scroll") as HTMLDivElement | null;
    if (!scroller) {
      throw new Error("Managed skills scroller was not rendered.");
    }
    scroller.scrollTop = 280;
  });

  const skillsTabs = page.getByRole("navigation", { name: "Skills views" });
  await skillsTabs.getByRole("link", { name: /^Unmanaged/i }).click();
  await expect(page.getByRole("heading", { name: "Unmanaged skills" })).toBeVisible();
  await skillsTabs.getByRole("link", { name: /^Managed/i }).click();
  await expect(page.getByRole("heading", { name: "Managed skills" })).toBeVisible();

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const scroller = document.querySelector(".skills-pane__scroll") as HTMLDivElement | null;
        return scroller?.scrollTop ?? 0;
      });
    })
    .toBe(280);
});

test("opens the Settings drawer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harnesses" })).toBeVisible();
});

test("navigates to Marketplace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Marketplace" }).click();
  await expect(page.getByRole("heading", { name: "Marketplace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "All-time leaderboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "mode-io/skills" }).first()).toBeVisible();
});
