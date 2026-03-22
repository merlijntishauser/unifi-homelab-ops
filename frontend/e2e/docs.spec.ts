import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures";

test.describe("documentation module", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/docs");
  });

  test("shows documentation sections", async ({ page }) => {
    await expect(page.getByText("Network Topology")).toBeVisible();
    await expect(page.getByText("Device Inventory")).toBeVisible();
    await expect(page.getByText("Firewall Summary")).toBeVisible();
  });

  test("sections are collapsible", async ({ page }) => {
    const heading = page.getByText("Device Inventory");
    await expect(heading).toBeVisible();
    // Click to collapse
    await heading.click();
  });

  test("expanding a section shows action buttons", async ({ page }) => {
    // Sections are collapsed by default; click to expand
    await page.getByText("Firewall Summary").click();
    await expect(page.getByRole("button", { name: "Copy MD" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Download MD" }).first()).toBeVisible();
  });

  test("shows download complete markdown button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Download complete markdown" })).toBeVisible();
  });
});
