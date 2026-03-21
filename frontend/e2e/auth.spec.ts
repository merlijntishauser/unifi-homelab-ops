import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures";

test.describe("authentication", () => {
  test("shows login screen when not authenticated", async ({ page }) => {
    await mockApi(page, { authenticated: false });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Connect to UniFi Controller" })).toBeVisible();
    await expect(page.getByLabel("Controller URL")).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
  });

  test("login flow navigates to app", async ({ page }) => {
    await mockApi(page, { authenticated: false });
    await page.goto("/");

    await page.getByLabel("Controller URL").fill("https://192.168.1.1");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Connect" }).click();

    // After login, the app loads with the default route (Health)
    await expect(page.getByRole("navigation", { name: "Module navigation" })).toBeVisible();
  });
});
