import { expect, test } from "@playwright/test";
import path from "node:path";
import { classifySmokeError, isControlledGeminiTemporaryUnavailableBlocker, SmokeBlockerError } from "./support/blockers";
import { readSmokeBootstrapState } from "./support/bootstrap";
import { createSmokeImageFixtures } from "./support/images";

async function ensureWorkspaceDriveRoot(page: import("@playwright/test").Page, workspaceName: string) {
  await page.goto("/settings/workspace");
  await page.waitForLoadState("networkidle");

  const workspaceRow = page.locator("tr", { hasText: workspaceName }).first();
  await expect(workspaceRow).toBeVisible();
  await workspaceRow.getByRole("button", { name: "Kelola" }).click();

  const provisionButton = page.getByRole("button", { name: "Buat Folder Drive" });
  await expect(provisionButton).toBeVisible();
  await provisionButton.click();

  await page.waitForURL(
    (url) => url.pathname === "/settings/workspace" && url.searchParams.get("message") === "Folder Drive disinkronkan",
    {
      timeout: 180_000,
    },
  );
}

test("live intake upload can reach prompt review", async ({ browser, page }, testInfo) => {
  const fixtureDir = path.join(testInfo.outputDir, "intake-fixtures");
  const fixtureContext = await browser.newContext();
  const state = await readSmokeBootstrapState();
  let geminiTemporaryUnavailableMessage: string | null = null;

  try {
    const files = await createSmokeImageFixtures(fixtureContext, fixtureDir);

    await ensureWorkspaceDriveRoot(page, state.workspace.name);
    await page.goto("/products/new");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(250);

    await expect(page.locator(".intake-native-header")).toHaveCount(0);
    await expect(page.locator(".image-preview-upload-card")).toHaveCount(3);

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
      if (isControlledGeminiTemporaryUnavailableBlocker(errorMessage)) {
        geminiTemporaryUnavailableMessage = errorMessage;
      } else {
        throw classifySmokeError("intake live", errorMessage);
      }
    } else {
      await expect(page.getByRole("heading", { name: "Review metadata" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Simpan Review" })).toBeVisible();
      await page.getByRole("button", { name: "Simpan Review" }).click();
      await page.waitForURL((url) => url.pathname === "/prompts" && url.searchParams.has("product_id"));
      await expect(page.getByRole("heading", { name: "Paket Prompt", level: 1 })).toBeVisible();
      const promptCard = page.locator("article").filter({ hasText: state.product.name }).first();
      await expect(promptCard).toBeVisible();
      await expect(promptCard.getByRole("button", { name: "Buat Prompt" })).toBeVisible();
    }
  } catch (error) {
    if (error instanceof SmokeBlockerError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes("timeout")) {
      throw classifySmokeError("intake live timeout", error);
    }

    throw classifySmokeError("intake live", error);
  } finally {
    await fixtureContext.close();
  }

  if (geminiTemporaryUnavailableMessage) {
    testInfo.annotations.push({
      type: "external-blocker",
      description: `GEMINI_BLOCKER: ${geminiTemporaryUnavailableMessage}`,
    });
    test.skip(true, `Expected external Gemini blocker: ${geminiTemporaryUnavailableMessage}`);
  }
});
