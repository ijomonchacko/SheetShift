// Playwright E2E smoke test: demo chart → preview (embedded-text path) →
// generate → custom preview. Run with:
//   npx playwright test e2e/  (after `npx playwright install chromium`)
// The dev server must be running (npm run dev) or set BASE_URL.
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:5173";

test("landing → app → demo chart → preview → generate", async ({ page }) => {
  await page.goto(BASE + "/");
  await expect(page.locator("h1")).toContainText("Change the key");

  await page.click("text=Open the app");
  await page.click("text=Try the sample chart");
  await expect(page.locator(".file-name")).toContainText("demo-chart.pdf");

  // Demo preselects C → D
  await page.click("text=Preview detected chords");
  await expect(page.locator(".result-state")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".badge")).toContainText("Exact");
  const chips = page.locator(".chord-chip");
  await expect(chips.first()).toBeVisible();

  await page.click("text=Generate transposed PDF");
  await expect(page.locator(".done-state")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".pdfpreview-canvas")).toBeVisible();
});
