import { expect, test } from "@playwright/test";
import path from "node:path";
import { classifySmokeError } from "./support/blockers";
import { createSmokeImageFixtures } from "./support/images";

test("live intake upload can reach prompt review", async ({ browser, page }, testInfo) => {
  const fixtureDir = path.join(testInfo.outputDir, "intake-fixtures");
  const fixtureContext = await browser.newContext();

  try {
    const files = await createSmokeImageFixtures(fixtureContext, fixtureDir);

    await page.goto("/products/new");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(250);

    const productInput = page.locator('input[name="product_image"]');
    const shopeeInput = page.locator('input[name="shopee_screenshot"]');
    const tiktokInput = page.locator('input[name="tiktok_screenshot"]');

    await productInput.setInputFiles(files.productImage);
    await productInput.dispatchEvent("change");
    await shopeeInput.setInputFiles(files.shopeeScreenshot);
    await shopeeInput.dispatchEvent("change");
    await tiktokInput.setInputFiles(files.tiktokScreenshot);
    await tiktokInput.dispatchEvent("change");

    await expect(page.getByRole("button", { name: "Analisis Gemini" })).toBeEnabled();
    await page.getByRole("button", { name: "Analisis Gemini" }).click();

    await page.waitForURL(
      (url) => url.pathname === "/products/new" && (url.searchParams.get("step") === "prompt" || url.searchParams.has("error")),
      {
        timeout: 180_000,
      },
    );

    const currentUrl = new URL(page.url());
    const errorMessage = currentUrl.searchParams.get("error");

    if (errorMessage) {
      throw classifySmokeError("intake live", errorMessage);
    }

    await expect(page.getByRole("heading", { name: "Review metadata" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Simpan Review" })).toBeVisible();
    await page.getByRole("button", { name: "Simpan Review" }).click();
    await expect(page.getByText("Review saved")).toBeVisible();
    await expect(page.getByRole("link", { name: "Buat Prompt" })).toBeVisible();
  } catch (error) {
    if (error instanceof Error && error.message.includes("timeout")) {
      throw classifySmokeError("intake live timeout", error);
    }

    throw classifySmokeError("intake live", error);
  } finally {
    await fixtureContext.close();
  }
});
