/**
 * Production e2e tests.
 *
 * Run against the real production Docker image + mock UniFi controller.
 * No browser-level API mocking -- all requests go through the full stack.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const APP_PASSWORD = "test";

/** Wait for the matrix to be visible by checking for row headers. */
async function waitForMatrix(page: Page) {
  await expect(page.getByTestId("row-header-zone-internal")).toBeVisible({ timeout: 15000 });
}

/** Authenticate through the app passphrase gate, then wait for the matrix. */
async function appLoginAndWaitForMatrix(page: Page) {
  await page.goto("/");

  // App-password gate: wait for either the passphrase screen or the matrix
  const passphrase = page.locator("#passphrase");
  const matrixRow = page.getByTestId("row-header-zone-internal");

  // Try to detect what screen we're on
  const visible = await Promise.race([
    passphrase.waitFor({ state: "visible", timeout: 10000 }).then(() => "passphrase" as const),
    matrixRow.waitFor({ state: "visible", timeout: 10000 }).then(() => "matrix" as const),
  ]);

  if (visible === "passphrase") {
    await passphrase.fill(APP_PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();
  }

  // Wait for matrix to load (env credentials auto-connect)
  await waitForMatrix(page);
}

/** Click a matrix cell that contains rules. */
async function clickRuleCell(page: Page) {
  const cells = page.getByTestId("matrix-cell");
  const count = await cells.count();
  for (let i = 0; i < count; i++) {
    const text = await cells.nth(i).innerText();
    if (/\d/.test(text)) {
      await cells.nth(i).click();
      return;
    }
  }
  throw new Error("No matrix cell with rules found");
}

/** Click a matrix cell with 3+ rules. */
async function clickMultiRuleCell(page: Page) {
  const cells = page.getByTestId("matrix-cell");
  const count = await cells.count();
  for (let i = 0; i < count; i++) {
    const text = await cells.nth(i).innerText();
    const match = text.match(/(\d+)/);
    if (match && Number(match[1]) >= 3) {
      await cells.nth(i).click();
      return;
    }
  }
  throw new Error("No matrix cell with 3+ rules found");
}

test.describe("login flow", () => {
  test("app auth gate blocks until passphrase entered", async ({ page }) => {
    await page.goto("/");

    // Should see the passphrase screen
    await expect(page.getByText("Enter the application password to continue.")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#passphrase")).toBeVisible();

    // Enter password and unlock
    await page.locator("#passphrase").fill(APP_PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();

    // After unlock, should proceed to matrix (env credentials auto-connect)
    await waitForMatrix(page);
  });

  test("matrix loads with zone data from mock controller", async ({ page }) => {
    await appLoginAndWaitForMatrix(page);

    // Verify zones from mock controller fixtures
    await expect(page.getByTestId("row-header-zone-internal")).toBeVisible();
    await expect(page.getByTestId("row-header-zone-guest")).toBeVisible();
    await expect(page.getByTestId("row-header-zone-iot")).toBeVisible();
    await expect(page.getByTestId("col-header-zone-external")).toBeVisible();
  });
});

test.describe("matrix and graph navigation", () => {
  test.beforeEach(async ({ page }) => {
    await appLoginAndWaitForMatrix(page);
  });

  test("clicking a cell opens graph view with rules", async ({ page }) => {
    await clickRuleCell(page);

    await expect(page.getByRole("button", { name: "Back to matrix" })).toBeVisible();
    await expect(page.getByText("Rules (")).toBeVisible();
  });

  test("back button returns to matrix", async ({ page }) => {
    await clickRuleCell(page);
    await expect(page.getByRole("button", { name: "Back to matrix" })).toBeVisible();

    await page.getByRole("button", { name: "Back to matrix" }).click();
    await waitForMatrix(page);
  });
});

test.describe("rule panel and findings", () => {
  test.beforeEach(async ({ page }) => {
    await appLoginAndWaitForMatrix(page);
    await clickRuleCell(page);
    await expect(page.getByText("Rules (")).toBeVisible();
  });

  test("rule panel shows rules with action badges", async ({ page }) => {
    const allow = page.getByText("ALLOW").first();
    const block = page.getByText("BLOCK").first();
    await expect(allow.or(block)).toBeVisible();
  });

  test("expanding a rule shows details", async ({ page }) => {
    const ruleCard = page.getByRole("button", { name: /1\./ }).first();
    await ruleCard.click();

    await expect(page.getByText("Match Criteria")).toBeVisible();
    await expect(page.getByText("Protocol", { exact: true })).toBeVisible();
  });
});

test.describe("traffic simulation", () => {
  test("simulate returns verdict from real backend", async ({ page }) => {
    await appLoginAndWaitForMatrix(page);
    await clickRuleCell(page);
    await expect(page.getByText("Rules (")).toBeVisible();

    // Use IPs that resolve to zones with subnets:
    // Guest (10.0.100.0/24) -> Internal (192.168.1.0/24)
    await page.getByPlaceholder("Source IP").fill("10.0.100.5");
    await page.getByPlaceholder("Destination IP").fill("192.168.1.100");
    await page.getByPlaceholder("Port", { exact: true }).fill("443");

    const simulateBtn = page.getByRole("button", { name: "Simulate" });
    await simulateBtn.scrollIntoViewIfNeeded();
    await simulateBtn.click();

    // Should show evaluation results
    await expect(page.getByText("Evaluation Chain")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("health module", () => {
  test("health summary loads with data from all modules", async ({ page }) => {
    await appLoginAndWaitForMatrix(page);

    // Navigate to health module via sidebar
    await page.getByRole("link", { name: "Health" }).click();

    // Summary cards should load with real data from the backend
    await expect(page.getByRole("button", { name: "Firewall" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "Topology" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Metrics" })).toBeVisible();

    // Auto-refresh label
    await expect(page.getByText("Auto-refreshes every 60s")).toBeVisible();
  });

  test("health summary card navigates to firewall module", async ({ page }) => {
    await appLoginAndWaitForMatrix(page);
    await page.getByRole("link", { name: "Health" }).click();
    await expect(page.getByRole("button", { name: "Firewall" })).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Firewall" }).click();
    await waitForMatrix(page);
  });

  test("AI analysis section shows setup message when no AI configured", async ({ page }) => {
    await appLoginAndWaitForMatrix(page);
    await page.getByRole("link", { name: "Health" }).click();
    await expect(page.getByRole("button", { name: "Firewall" })).toBeVisible({ timeout: 15000 });

    // No AI provider configured in production e2e, so should show setup message
    await expect(page.getByText("Configure an AI provider")).toBeVisible();
  });
});

test.describe("settings", () => {
  test("AI settings modal opens and shows configuration", async ({ page }) => {
    await appLoginAndWaitForMatrix(page);

    // Open settings
    await page.getByRole("button", { name: "Settings" }).click();

    // Settings modal should show tabbed panes
    await expect(page.getByRole("button", { name: "Connection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Provider" })).toBeVisible();
    await expect(page.getByRole("button", { name: "User Settings" })).toBeVisible();

    // Navigate to AI Provider tab and verify it has the Save button
    await page.getByRole("button", { name: "AI Provider" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  });
});
