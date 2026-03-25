import { expect, test } from "@playwright/test";

test("renders the Skills page with the matrix layout", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Skills" })).toBeVisible();
  await expect(page.getByPlaceholder("Search skills by name, description, or state")).toBeVisible();
  await expect(page.getByRole("switch").first()).toBeVisible();
  await expect(page.getByText("Trace Lens")).toBeVisible();
  await expect(page.getByRole("button", { name: "Bring all eligible skills under management" })).toBeVisible();
});

test("toggles the Settings panel", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Open settings" });
  await trigger.click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tools" })).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("heading", { name: "Settings" })).not.toBeVisible();
});

test("navigates to Marketplace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Marketplace" }).click();
  await expect(page.getByRole("heading", { name: "Marketplace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Popular skills" })).toBeVisible();
  await expect(page.getByAltText("Avatar for openclaw").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "mode-io/skills" }).first()).toBeVisible();
  await expect(page.getByAltText("Avatar for mode-io").first()).toBeVisible();
});

test("auto loads more marketplace skills on scroll", async ({ page }) => {
  await page.goto("/marketplace");
  const initialCount = await page.locator(".marketplace-card").count();
  expect(initialCount).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(async () => page.locator(".marketplace-card").count()).toBeGreaterThan(initialCount);
});
