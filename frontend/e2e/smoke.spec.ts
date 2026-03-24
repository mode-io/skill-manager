import { expect, test } from "@playwright/test";

test("renders My Skills page with shared skills", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("skill-manager")).toBeVisible();
  await expect(page.getByText("My Skills")).toBeVisible();
  await expect(page.getByText("Shared Audit")).toBeVisible();
});

test("navigates to Setup page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /setup/i }).click();
  await expect(page.getByText("Detected Harnesses")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Codex", exact: true })).toBeVisible();
});

test("navigates to Marketplace page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /marketplace/i }).click();
  await expect(page.getByText("Search for skills")).toBeVisible();
});

test("navigates to Health page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /health/i }).click();
  await expect(page.getByRole("heading", { name: "Health" })).toBeVisible();
  await expect(page.getByText("Harness Summary")).toBeVisible();
});
