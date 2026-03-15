import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures";

test.describe("topology module", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/topology");
  });

  test.describe("map view", () => {
    test("shows map view by default with Map/Diagram toggle", async ({ page }) => {
      await expect(page.getByRole("button", { name: "Map" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Diagram" })).toBeVisible();
    });

    test("does not show diagram controls in map view", async ({ page }) => {
      await expect(page.getByRole("button", { name: "Isometric" })).not.toBeVisible();
      await expect(page.getByRole("button", { name: "Export SVG" })).not.toBeVisible();
    });
  });

  test.describe("diagram view", () => {
    test("switches to diagram view and shows controls", async ({ page }) => {
      await page.getByRole("button", { name: "Diagram" }).click();
      await expect(page.getByRole("button", { name: "Isometric" })).toBeVisible();
    });

    test("shows projection toggle and export buttons", async ({ page }) => {
      await page.getByRole("button", { name: "Diagram" }).click();
      await expect(page.getByRole("button", { name: "Isometric" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Export SVG" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
    });

    test("switches back to map view", async ({ page }) => {
      await page.getByRole("button", { name: "Diagram" }).click();
      await expect(page.getByRole("button", { name: "Export SVG" })).toBeVisible();

      await page.getByRole("button", { name: "Map" }).click();
      await expect(page.getByRole("button", { name: "Export SVG" })).not.toBeVisible();
    });
  });
});
