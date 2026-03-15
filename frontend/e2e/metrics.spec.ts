import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures";

test.describe("metrics module", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/metrics");
  });

  test.describe("device grid", () => {
    test("shows device cards with names", async ({ page }) => {
      await expect(page.getByText("Gateway")).toBeVisible();
      await expect(page.getByText("Switch")).toBeVisible();
    });

    test("shows auto-refresh label", async ({ page }) => {
      await expect(page.getByText("Auto-refreshes every 30s")).toBeVisible();
    });

    test("shows device stats on cards", async ({ page }) => {
      // CPU and memory stats from mock data
      await expect(page.getByText("12%")).toBeVisible();
      await expect(page.getByText("45%")).toBeVisible();
    });
  });

  test.describe("device detail", () => {
    test("clicking device card opens detail view", async ({ page }) => {
      await page.getByText("Gateway").click();
      // Detail view shows device name and a back button
      await expect(page.getByRole("button", { name: /back/i })).toBeVisible();
    });

    test("back button returns to device grid", async ({ page }) => {
      await page.getByText("Gateway").click();
      await expect(page.getByRole("button", { name: /back/i })).toBeVisible();

      await page.getByRole("button", { name: /back/i }).click();
      // Both device cards should be visible again
      await expect(page.getByText("Gateway")).toBeVisible();
      await expect(page.getByText("Switch")).toBeVisible();
    });
  });
});
