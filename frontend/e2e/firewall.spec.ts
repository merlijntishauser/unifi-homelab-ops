import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures";

/** Wait for the matrix to be visible by checking for a row header. */
async function waitForMatrix(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("row-header-zone-external")).toBeVisible();
}

/** Click a matrix cell that has rules (non-empty). */
async function clickCell(page: import("@playwright/test").Page) {
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

/** Click a matrix cell that has multiple rules (3+). */
async function clickMultiRuleCell(page: import("@playwright/test").Page) {
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

test.describe("firewall module", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await waitForMatrix(page);
  });

  test.describe("matrix view", () => {
    test("shows zone matrix with headers", async ({ page }) => {
      await expect(page.getByTestId("row-header-zone-internal")).toBeVisible();
      await expect(page.getByTestId("row-header-zone-guest")).toBeVisible();
      await expect(page.getByTestId("row-header-zone-iot")).toBeVisible();
      await expect(page.getByTestId("col-header-zone-external")).toBeVisible();
    });

    test("click cell opens graph view with rule panel", async ({ page }) => {
      await clickCell(page);
      await expect(page.getByRole("button", { name: "Back to matrix" })).toBeVisible();
      await expect(page.getByText("Rules (")).toBeVisible();
    });

    test("back button returns to matrix from graph", async ({ page }) => {
      await clickCell(page);
      await expect(page.getByRole("button", { name: "Back to matrix" })).toBeVisible();

      await page.getByRole("button", { name: "Back to matrix" }).click();
      await expect(page.getByRole("button", { name: "Back to matrix" })).not.toBeVisible();
      await waitForMatrix(page);
    });

  });

  test.describe("rule panel", () => {
    test.beforeEach(async ({ page }) => {
      await clickCell(page);
      await expect(page.getByText("Rules (")).toBeVisible();
    });

    test("shows rules with action badges", async ({ page }) => {
      await expect(page.getByText("ALLOW").first()).toBeVisible();
    });

    test("expand rule shows detail sections", async ({ page }) => {
      const ruleCard = page.getByRole("button", { name: /1\./ }).first();
      await ruleCard.click();
      await expect(page.getByText("Match Criteria")).toBeVisible();
      await expect(page.getByText("Metadata")).toBeVisible();
      await expect(page.getByText("Protocol")).toBeVisible();
    });

    test("collapse rule hides details", async ({ page }) => {
      const ruleCard = page.getByRole("button", { name: /1\./ }).first();
      await ruleCard.click();
      await expect(page.getByText("Match Criteria")).toBeVisible();
      await ruleCard.click();
      await expect(page.getByText("Match Criteria")).not.toBeVisible();
    });

    test("close panel", async ({ page }) => {
      await page.getByLabel("Close panel").click();
      await expect(page.getByText("Rules (")).not.toBeVisible();
    });
  });

  test.describe("traffic simulation", () => {
    test("shows simulation verdict", async ({ page }) => {
      await clickCell(page);
      await expect(page.getByText("Rules (")).toBeVisible();

      await page.getByPlaceholder("Source IP").fill("10.0.100.5");
      await page.getByPlaceholder("Destination IP").fill("8.8.8.8");
      await page.getByPlaceholder("Port", { exact: true }).fill("443");
      await page.getByRole("button", { name: "Simulate" }).click();

      await expect(page.getByText("Evaluation Chain")).toBeVisible();
    });
  });

  test.describe("rule operations", () => {
    test("toggle shows confirm dialog and completes", async ({ page }) => {
      await clickCell(page);
      await expect(page.getByText("Rules (")).toBeVisible();

      const toggle = page.getByLabel(/Disable|Enable/).first();
      await toggle.click();
      await expect(page.getByText(/This change applies immediately/)).toBeVisible();
      await page.getByTestId("confirm-backdrop").getByRole("button", { name: /Disable|Enable/ }).click();
      await expect(page.getByText(/This change applies immediately/)).not.toBeVisible();
    });

    test("move down shows confirm dialog and completes", async ({ page }) => {
      await clickMultiRuleCell(page);
      await expect(page.getByText("Rules (")).toBeVisible();

      const moveDown = page.getByLabel(/Move .+ down/).first();
      await moveDown.click();
      await expect(page.getByText(/changes rule evaluation order/)).toBeVisible();
      await page.getByRole("button", { name: /Move down/ }).click();
      await expect(page.getByText(/changes rule evaluation order/)).not.toBeVisible();
    });
  });

  test.describe("toolbar", () => {
    test("shows refresh button", async ({ page }) => {
      await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
    });
  });
});
