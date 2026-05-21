import { test } from "@playwright/test";
import path from "node:path";

const authStatePath = path.join(process.cwd(), ".playwright", ".auth", "smoke.json");

test.use({ storageState: authStatePath, viewport: { width: 1280, height: 800 } });

test("screenshot produk desktop", async ({ page }) => {
  await page.goto("/products", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const firstRow = page.locator("table.product-table tbody tr").first();
  if (await firstRow.isVisible()) {
    await firstRow.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: "screenshots/produk-desktop-detail.png", fullPage: true });
});

test("screenshot gemini desktop", async ({ page }) => {
  await page.goto("/settings/gemini", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "screenshots/settings-gemini-desktop.png", fullPage: true });
});

test("screenshot magnific desktop", async ({ page }) => {
  await page.goto("/settings/magnific", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "screenshots/settings-magnific-desktop.png", fullPage: true });
});
