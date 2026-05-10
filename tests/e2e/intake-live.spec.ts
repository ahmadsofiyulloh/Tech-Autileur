import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { classifySmokeError, isControlledGeminiTemporaryUnavailableBlocker, SmokeBlockerError } from "./support/blockers";
import { readSmokeBootstrapState } from "./support/bootstrap";
import { createSmokeImageFixtures } from "./support/images";
import { createSmokeServiceClient } from "./support/supabase";

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
  const client = createSmokeServiceClient();
  let geminiTemporaryUnavailableMessage: string | null = null;

  try {
    const files = await createSmokeImageFixtures(fixtureContext, fixtureDir);

    await ensureWorkspaceDriveRoot(page, state.workspace.name);
    await page.goto("/products/new");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(250);

    await expect(page.locator(".intake-native-header")).toHaveCount(0);
    await expect(page.locator(".image-preview-upload-card")).toHaveCount(3);

    const uploadCards = page.locator(".image-preview-upload-card");
    await expect(page.getByRole("button", { name: "Tambah gambar" })).toHaveCount(3);

    const productChooserPromise = page.waitForEvent("filechooser");
    await uploadCards.nth(0).getByRole("button").first().click();
    await (await productChooserPromise).setFiles(files.productImage);

    const shopeeDraftChooserPromise = page.waitForEvent("filechooser");
    await uploadCards.nth(1).getByRole("button").first().click();
    await (await shopeeDraftChooserPromise).setFiles(files.shopeeScreenshot);

    const tiktokDraftChooserPromise = page.waitForEvent("filechooser");
    await uploadCards.nth(2).getByRole("button").first().click();
    await (await tiktokDraftChooserPromise).setFiles(files.tiktokScreenshot);

    await expect(page.getByRole("button", { name: "Simpan Produk" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Analisis Metadata" })).toBeDisabled();
    await page.getByRole("button", { name: "Simpan Produk" }).click();

    await page.waitForURL(
      (url) =>
        url.pathname === "/products/new" &&
        (url.searchParams.get("message") === "Produk disimpan" || url.searchParams.has("error") || url.searchParams.has("warning")),
      {
        timeout: 180_000,
      },
    );

    const currentUrl = new URL(page.url());
    const errorMessage = currentUrl.searchParams.get("error");
    const warningMessage = currentUrl.searchParams.get("warning");

    if (errorMessage || warningMessage) {
      const message = errorMessage ?? warningMessage ?? "";
      if (
        isControlledGeminiTemporaryUnavailableBlocker(message) ||
        message.includes("Stored Gemini keys could not be decrypted")
      ) {
        geminiTemporaryUnavailableMessage = message;
      } else {
        throw classifySmokeError("intake live", message);
      }
    } else {
      expect(currentUrl.searchParams.has("intake_id")).toBe(false);
      await expect(page.getByRole("button", { name: "Simpan Produk" })).toBeDisabled();
      await expect(page.getByRole("heading", { name: "Draft tersimpan" })).toBeVisible();

      const { data: savedIntake, error: savedIntakeError } = await client
        .from("product_intake_sessions")
        .select("id, product_id, status")
        .eq("user_id", state.user.id)
        .eq("workspace_id", state.workspace.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (savedIntakeError) {
        throw new Error(savedIntakeError.message);
      }

      expect(savedIntake.status).toBe("DRAFT");
      expect(savedIntake.product_id).toBeTruthy();

      if (!savedIntake.product_id) {
        throw new Error("Saved intake did not create a product.");
      }

      const { data: savedProduct, error: savedProductError } = await client
        .from("products")
        .select("status")
        .eq("id", savedIntake.product_id)
        .single();

      if (savedProductError) {
        throw new Error(savedProductError.message);
      }

      expect(savedProduct.status).toBe("DRAFT");

      const { data: savedMarketplaceSources, error: savedMarketplaceSourcesError } = await client
        .from("product_marketplace_sources")
        .select("platform, screenshot_drive_item_ref_id, status")
        .eq("product_id", savedIntake.product_id);

      if (savedMarketplaceSourcesError) {
        throw new Error(savedMarketplaceSourcesError.message);
      }

      const savedSourceByPlatform = new Map(savedMarketplaceSources.map((source) => [source.platform, source]));
      expect(savedSourceByPlatform.get("SHOPEE")?.screenshot_drive_item_ref_id).toBeTruthy();
      expect(savedSourceByPlatform.get("TIKTOK")?.screenshot_drive_item_ref_id).toBeTruthy();

      await page.goto(`/products/new?intake_id=${savedIntake.id}&affiliate_profile_id=${state.affiliate_profile.id}`);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("button", { name: "Foto Produk Utama. Ganti gambar" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Screenshot Shopee. Ganti gambar" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Screenshot TikTok. Ganti gambar" })).toBeVisible();

      await expect(page.getByRole("button", { name: "Analisis Metadata" })).toBeEnabled();
      await page.getByRole("button", { name: "Analisis Metadata" }).click();

      await page.waitForURL(
        (url) => url.pathname === "/products/new" && (url.searchParams.has("intake_id") || url.searchParams.has("error") || url.searchParams.has("warning")),
        {
          timeout: 180_000,
        },
      );

      const analysisUrl = new URL(page.url());
      const analysisError = analysisUrl.searchParams.get("error");
      const analysisWarning = analysisUrl.searchParams.get("warning");

      if (analysisError || analysisWarning) {
        const message = analysisError ?? analysisWarning ?? "";
        if (
          isControlledGeminiTemporaryUnavailableBlocker(message) ||
          message.includes("Stored Gemini keys could not be decrypted")
        ) {
          geminiTemporaryUnavailableMessage = message;
        } else {
          throw classifySmokeError("intake live", message);
        }
      } else {
        await expect(page.getByRole("heading", { name: "Review Hasil" })).toBeVisible();
        await expect(page.getByText("NEEDS REVIEW")).toBeVisible();
        const { data: analyzedProduct, error: analyzedProductError } = await client
          .from("products")
          .select("status")
          .eq("id", savedIntake.product_id)
          .single();

        if (analyzedProductError) {
          throw new Error(analyzedProductError.message);
        }

        expect(analyzedProduct.status).toBe("DRAFT");
        const reviewPanel = page.locator("#review-panel");
        await expect(reviewPanel).toBeVisible();
        await expect(reviewPanel.getByRole("button", { name: "Simpan" })).toBeVisible();
        await reviewPanel.getByRole("button", { name: "Simpan" }).click();
        await page.waitForURL((url) => url.pathname === "/prompts" && url.searchParams.has("product_id"));
        await expect(page.getByRole("heading", { name: "Paket Prompt", level: 1 })).toBeVisible();
        const promptCard = page.locator("article").filter({ hasText: state.product.name }).first();
        await expect(promptCard).toBeVisible();
        await expect(promptCard.getByRole("button", { name: "Buat Prompt" })).toBeVisible();
        await expect(promptCard.getByRole("button", { name: "Buat Prompt" })).toBeEnabled();
      }
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

test("metadata failure fallback keeps retry visible", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const client = createSmokeServiceClient();
  const intakeCode = `SMOKE-ERROR-${state.run_tag}`;
  const { data, error } = await client
    .from("product_intake_sessions")
    .insert({
      user_id: state.user.id,
      workspace_id: state.workspace.id,
      intake_code: intakeCode,
      product_title: "Smoke Failure Panel",
      status: "ERROR",
      error_message: "Gemini service is temporarily unavailable.",
      parsed_metadata_json: null,
      reviewed_metadata_json: null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const intakeId = data.id;

  try {
    await page.goto(`/products/new?intake_id=${intakeId}&affiliate_profile_id=${state.affiliate_profile.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Analisis metadata gagal.", level: 3 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Kembali ke intake" })).toBeVisible();

    await page.getByRole("link", { name: "Kembali ke intake" }).click();
    await page.waitForURL(
      (url) =>
        url.pathname === "/products/new" &&
        url.searchParams.get("step") === "intake" &&
        url.searchParams.get("intake_id") === intakeId,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("timeout")) {
      throw classifySmokeError("intake failure fallback timeout", error);
    }

    throw classifySmokeError("intake failure fallback", error);
  } finally {
    await client.from("product_intake_sessions").delete().eq("id", intakeId);
  }
});

test("intake draft queue excludes archived products", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const client = createSmokeServiceClient();
  const uniqueSuffix = randomUUID().slice(0, 8).toUpperCase();
  const archivedProductName = `Archived Draft Hidden ${uniqueSuffix}`;
  const archivedProductCode = `ARCHIVED-${uniqueSuffix}`;
  const intakeCode = `ARCHIVED-INTAKE-${uniqueSuffix}`;
  let intakeId: string | null = null;
  let productId: string | null = null;

  try {
    const { data: product, error: productError } = await client
      .from("products")
      .insert({
        user_id: state.user.id,
        workspace_id: state.workspace.id,
        product_code: archivedProductCode,
        product_name: archivedProductName,
        niche: "Smoke hidden draft",
        marketplace: "SHOPEE + TIKTOK",
        marketplace_product_link: "https://example.com/archived-draft-hidden",
        status: "ARCHIVED",
        notes: "Archived product used to verify intake draft filtering.",
      })
      .select("id")
      .single();

    if (productError) {
      throw new Error(productError.message);
    }

    productId = product.id;

    const { data: intake, error: intakeError } = await client
      .from("product_intake_sessions")
      .insert({
        user_id: state.user.id,
        workspace_id: state.workspace.id,
        product_id: productId,
        intake_code: intakeCode,
        product_title: archivedProductName,
        status: "DRAFT",
        error_message: null,
      })
      .select("id")
      .single();

    if (intakeError) {
      throw new Error(intakeError.message);
    }

    intakeId = intake.id;

    await page.goto("/products/new");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(archivedProductName)).toHaveCount(0);

    await page.goto(`/products/new?intake_id=${intakeId}&affiliate_profile_id=${state.affiliate_profile.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Metadata siap muncul di sini", level: 3 })).toBeVisible();
    await expect(page.getByText(archivedProductName)).toHaveCount(0);
  } catch (error) {
    if (error instanceof Error && error.message.includes("timeout")) {
      throw classifySmokeError("intake archived draft filter timeout", error);
    }

    throw classifySmokeError("intake archived draft filter", error);
  } finally {
    if (intakeId) {
      await client.from("product_intake_sessions").delete().eq("id", intakeId);
    }

    if (productId) {
      await client.from("products").delete().eq("id", productId);
    }
  }
});
