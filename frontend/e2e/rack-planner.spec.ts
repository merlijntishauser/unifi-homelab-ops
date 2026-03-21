import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures";

test.describe("rack planner module", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/rack-planner");
  });

  test.describe("rack overview", () => {
    test("shows rack cards", async ({ page }) => {
      await expect(page.getByText("Main Rack")).toBeVisible();
      await expect(page.getByText("19-inch / 12U")).toBeVisible();
    });

    test("shows new rack button", async ({ page }) => {
      await expect(page.getByTestId("new-rack-button")).toBeVisible();
    });

    test("new rack form appears on button click", async ({ page }) => {
      await page.getByTestId("new-rack-button").click();
      await expect(page.getByTestId("new-rack-form")).toBeVisible();
      await expect(page.getByPlaceholder("e.g. Main Rack")).toBeVisible();
    });
  });

  test.describe("rack editor", () => {
    test.beforeEach(async ({ page }) => {
      await page.getByText("Main Rack").click();
    });

    test("shows rack details in toolbar", async ({ page }) => {
      await expect(page.getByText("Main Rack")).toBeVisible();
      await expect(page.getByText(/19-inch/)).toBeVisible();
    });

    test("shows rack items in the grid", async ({ page }) => {
      await expect(page.getByText("USW-Pro-24")).toBeVisible();
      await expect(page.getByText("UDM-Pro")).toBeVisible();
    });

    test("shows rack grid with U labels", async ({ page }) => {
      await expect(page.getByTestId("rack-grid")).toBeVisible();
    });

    test("has Add Item button", async ({ page }) => {
      await expect(page.getByTestId("add-item-button")).toBeVisible();
    });

    test("add item form opens with UniFi Device and Custom tabs", async ({ page }) => {
      await page.getByTestId("add-item-button").click();
      await expect(page.getByTestId("add-item-form")).toBeVisible();
      await expect(page.getByText("UniFi Device")).toBeVisible();
      await expect(page.getByText("Custom")).toBeVisible();
    });

    test("has Bill of Materials button", async ({ page }) => {
      await expect(page.getByTestId("bom-button") .or(page.getByRole("button", { name: "Bill of Materials" }))).toBeVisible();
    });

    test("back button returns to overview", async ({ page }) => {
      await page.getByTestId("back-button").click();
      await expect(page.getByText("Rack Planner")).toBeVisible();
      await expect(page.getByTestId("new-rack-button")).toBeVisible();
    });
  });
});
