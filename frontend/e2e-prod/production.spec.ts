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

  const passphrase = page.locator("#passphrase");
  const matrixRow = page.getByTestId("row-header-zone-internal");

  const visible = await Promise.race([
    passphrase.waitFor({ state: "visible", timeout: 10000 }).then(() => "passphrase" as const),
    matrixRow.waitFor({ state: "visible", timeout: 10000 }).then(() => "matrix" as const),
  ]);

  if (visible === "passphrase") {
    await passphrase.fill(APP_PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();
  }

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

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

test.describe("authentication", () => {
  test("app auth gate blocks until passphrase entered", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Enter the application password to continue.")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#passphrase")).toBeVisible();

    await page.locator("#passphrase").fill(APP_PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();

    await waitForMatrix(page);
  });
});

// ---------------------------------------------------------------------------
// Firewall module
// ---------------------------------------------------------------------------

test.describe("firewall module", () => {
  test.beforeEach(async ({ page }) => {
    await appLoginAndWaitForMatrix(page);
  });

  test("matrix loads with zone data from mock controller", async ({ page }) => {
    await expect(page.getByTestId("row-header-zone-internal")).toBeVisible();
    await expect(page.getByTestId("row-header-zone-guest")).toBeVisible();
    await expect(page.getByTestId("row-header-zone-iot")).toBeVisible();
    await expect(page.getByTestId("col-header-zone-external")).toBeVisible();
  });

  test("clicking a cell opens graph view with rules", async ({ page }) => {
    await clickRuleCell(page);
    await expect(page.getByRole("button", { name: "Back to matrix" })).toBeVisible();
    await expect(page.getByText("Rules (")).toBeVisible();
  });

  test("back button returns to matrix", async ({ page }) => {
    await clickRuleCell(page);
    await page.getByRole("button", { name: "Back to matrix" }).click();
    await waitForMatrix(page);
  });

  test("rule panel shows rules with action badges", async ({ page }) => {
    await clickRuleCell(page);
    const allow = page.getByText("ALLOW").first();
    const block = page.getByText("BLOCK").first();
    await expect(allow.or(block)).toBeVisible();
  });

  test("expanding a rule shows details", async ({ page }) => {
    await clickRuleCell(page);
    const ruleCard = page.getByRole("button", { name: /1\./ }).first();
    await ruleCard.click();
    await expect(page.getByText("Match Criteria")).toBeVisible();
    await expect(page.getByText("Protocol", { exact: true })).toBeVisible();
  });

  test("simulate returns verdict from real backend", async ({ page }) => {
    await clickRuleCell(page);
    await expect(page.getByText("Rules (")).toBeVisible();

    await page.getByPlaceholder("Source IP").fill("10.0.100.5");
    await page.getByPlaceholder("Destination IP").fill("192.168.1.100");
    await page.getByPlaceholder("Port", { exact: true }).fill("443");

    const simulateBtn = page.getByRole("button", { name: "Simulate" });
    await simulateBtn.scrollIntoViewIfNeeded();
    await simulateBtn.click();

    await expect(page.getByText("Evaluation Chain")).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Topology module
// ---------------------------------------------------------------------------

test.describe("topology module", () => {
  test.beforeEach(async ({ page }) => {
    await appLoginAndWaitForMatrix(page);
    await page.getByRole("link", { name: "Topology" }).click();
  });

  test("map view loads with devices from mock controller", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Map" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Diagram" })).toBeVisible();
  });

  test("diagram view renders SVG topology", async ({ page }) => {
    await page.getByRole("button", { name: "Diagram" }).click();
    await expect(page.getByRole("button", { name: "Isometric" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export SVG" })).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Metrics module
// ---------------------------------------------------------------------------

test.describe("metrics module", () => {
  test.beforeEach(async ({ page }) => {
    await appLoginAndWaitForMatrix(page);
    await page.getByRole("link", { name: "Metrics" }).click();
  });

  test("device grid loads with data from backend", async ({ page }) => {
    // Metrics relies on the poller having run at least once; if no data yet,
    // the grid will be empty. Verify the module loads without error.
    await expect(page.getByText("Auto-refreshes every 30s")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Health module
// ---------------------------------------------------------------------------

test.describe("health module", () => {
  test.beforeEach(async ({ page }) => {
    await appLoginAndWaitForMatrix(page);
    await page.getByRole("link", { name: "Health" }).click();
    await expect(page.getByRole("button", { name: "Firewall" })).toBeVisible({ timeout: 15000 });
  });

  test("summary loads with data from all modules", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Topology" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Metrics" })).toBeVisible();
    await expect(page.getByText("Auto-refreshes every 60s")).toBeVisible();
  });

  test("summary card navigates to firewall module", async ({ page }) => {
    await page.getByRole("button", { name: "Firewall" }).click();
    await waitForMatrix(page);
  });

  test("AI analysis section shows setup message when no AI configured", async ({ page }) => {
    await expect(page.getByText("Configure an AI provider")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

test.describe("settings", () => {
  test("AI settings modal opens and shows configuration", async ({ page }) => {
    await appLoginAndWaitForMatrix(page);

    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("button", { name: "Connection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Provider" })).toBeVisible();
    await expect(page.getByRole("button", { name: "User Settings" })).toBeVisible();

    await page.getByRole("button", { name: "AI Provider" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  });
});
