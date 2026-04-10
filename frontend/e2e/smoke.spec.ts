import { expect, test } from "@playwright/test";

test("renders the managed skills page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Skills" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Managed skills" })).toBeVisible();
  await expect(page.getByPlaceholder("Search managed skills by name, description, or state")).toBeVisible();
  await expect(page.getByLabel("Managed skills list")).toBeVisible();
  await expect(page.getByRole("switch").first()).toBeVisible();
  await expect(page.getByText("Shared Audit")).toBeVisible();
  await expect(page.getByRole("link", { name: /Unmanaged/i })).toBeVisible();
});

test("renders the unmanaged intake page", async ({ page }) => {
  await page.goto("/skills/unmanaged");
  await expect(page.getByRole("heading", { name: "Unmanaged skills" })).toBeVisible();
  await expect(page.getByPlaceholder("Search unmanaged skills by name, description, or tool")).toBeVisible();
  await expect(page.getByLabel("Unmanaged skills list")).toBeVisible();
  await expect(page.getByText("Trace Lens")).toBeVisible();
  await expect(page.getByRole("button", { name: "Bring all eligible skills under management" })).toBeVisible();
});

test("opens the Settings drawer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tools" })).toBeVisible();
});

test("navigates to Marketplace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Marketplace" }).click();
  await expect(page.getByRole("heading", { name: "Marketplace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Popular skills" })).toBeVisible();
  await expect(page.getByAltText("Avatar for openclaw")).toBeVisible();
  await expect(page.getByRole("link", { name: "mode-io/skills" })).toBeVisible();
  await expect(page.getByAltText("Avatar for mode-io")).toBeVisible();
});
