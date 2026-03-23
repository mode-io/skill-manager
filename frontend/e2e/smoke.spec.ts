import { expect, test } from "@playwright/test";

test("renders the mixed fake-home control plane", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Skill Manager Control Plane")).toBeVisible();
  await expect(page.getByText("Shared Audit")).toBeVisible();
  await expect(page.getByText("Trace Lens")).toBeVisible();
  await expect(page.getByText("Scout")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harnesses" })).toBeVisible();
});
