import { expect, test, type Page } from "@playwright/test";
import { classifySmokeError } from "./support/blockers";
import { readSmokeBootstrapState, type SmokeBootstrapState } from "./support/bootstrap";
import { createSmokeServiceClient } from "./support/supabase";

const PLATFORM = "facebook";
const BREAKPOINTS = [
  { name: "360", width: 360, height: 780, pickerColumns: 2 },
  { name: "768", width: 768, height: 1024, pickerColumns: 3 },
  { name: "1024", width: 1024, height: 800, pickerColumns: 4 },
  { name: "1280", width: 1280, height: 900, pickerColumns: 4 },
] as const;

async function cleanupShareRows(state: SmokeBootstrapState) {
  const client = createSmokeServiceClient();
  const { error: generationError } = await client
    .from("share_generations")
    .delete()
    .eq("user_id", state.user.id)
    .eq("product_id", state.product.id)
    .eq("platform", PLATFORM);

  if (generationError) {
    throw new Error(generationError.message);
  }

  const { error: linkError } = await client
    .from("share_product_links")
    .delete()
    .eq("user_id", state.user.id)
    .eq("product_id", state.product.id);

  if (linkError) {
    throw new Error(linkError.message);
  }
}

async function openShareDetail(page: Page, state: SmokeBootstrapState) {
  await page.goto(`/share/${PLATFORM}?q=${encodeURIComponent(state.product.name)}`, {
    waitUntil: "domcontentloaded",
  });

  const productLink = page.getByRole("link", { name: state.product.name }).first();
  await expect(productLink).toBeVisible();
  await productLink.click();
  await page.waitForURL(
    (url) => url.pathname === `/share/${PLATFORM}` && url.searchParams.get("detail") === state.product.id,
    { timeout: 30_000 },
  );
}

test.describe("Share workspace", () => {
  let state: SmokeBootstrapState;

  test.beforeAll(async () => {
    state = await readSmokeBootstrapState();
  });

  for (const breakpoint of BREAKPOINTS) {
    test(`/share platform picker renders ${breakpoint.pickerColumns} columns at ${breakpoint.name}px`, async ({ page }) => {
      try {
        await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
        await page.goto("/share", { waitUntil: "domcontentloaded" });

        const cards = page.locator(".share-platform-card");
        await expect(page.locator(".share-platform-picker").getByRole("heading", { name: "Share" })).toBeVisible();
        await expect(cards).toHaveCount(4);
        await expect(page.getByRole("link", { name: "Buka Facebook" })).toBeVisible();

        const columnCount = await page.locator(".share-platform-picker__grid").evaluate((element) => {
          return getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length;
        });
        expect(columnCount).toBe(breakpoint.pickerColumns);

        await page.getByRole("link", { name: "Buka Facebook" }).click();
        await page.waitForURL((url) => url.pathname === `/share/${PLATFORM}`, { timeout: 30_000 });
      } catch (error) {
        throw classifySmokeError(`share picker ${breakpoint.name}px`, error);
      }
    });
  }

  test("desktop flow opens input, generates output, shows history, and regenerates", async ({ page }) => {
    try {
      await cleanupShareRows(state);
      await page.setViewportSize({ width: 1280, height: 900 });
      await openShareDetail(page, state);

      const drawer = page.locator('aside[aria-label="Detail share produk"]');
      await expect(drawer).toContainText(state.product.name);
      await expect(page.getByRole("button", { name: "Generate Caption" })).toBeDisabled();

      await page.getByLabel("Affiliate URL").fill("https://example.com/affiliate/share-smoke");
      await page.getByLabel("Angle").selectOption({ label: "Solusi Masalah" });
      await page.getByLabel("Jumlah varian").selectOption("2");
      await page.getByRole("button", { name: "Generate Caption" }).click();
      await page.waitForURL(
        (url) =>
          url.pathname === `/share/${PLATFORM}` &&
          url.searchParams.get("detail") === state.product.id &&
          url.searchParams.get("tab") === "output",
        { timeout: 30_000 },
      );

      await expect(drawer.getByRole("link", { name: "Output" })).toHaveAttribute("aria-current", "page");
      await expect(page.locator(".share-output-item")).toHaveCount(2);
      await expect(page.locator(".share-output-item").first()).toContainText("Solusi Masalah");
      await expect(page.locator(".share-output-item").first()).toContainText("Facebook");
      await expect(page.getByRole("button", { name: "Manual Share" }).first()).toBeEnabled();

      await drawer.getByRole("link", { name: "History" }).click();
      await page.waitForURL((url) => url.searchParams.get("tab") === "history", { timeout: 30_000 });
      await expect(page.locator(".share-history-row")).toHaveCount(1);
      await expect(page.locator(".share-history-row").first()).toContainText("Solusi Masalah");

      await drawer.getByRole("link", { name: "Regenerate" }).first().click();
      await page.waitForURL((url) => url.searchParams.get("mode") === "input", { timeout: 30_000 });
      await expect(page.getByLabel("Affiliate URL")).toHaveValue("https://example.com/affiliate/share-smoke");
      await page.getByLabel("Jumlah varian").selectOption("3");
      await page.getByRole("button", { name: "Generate Caption" }).click();
      await page.waitForURL((url) => url.searchParams.get("tab") === "output", { timeout: 30_000 });
      await expect(page.locator(".share-output-item")).toHaveCount(3);

      await drawer.getByRole("link", { name: "History" }).click();
      await expect(page.locator(".share-history-row")).toHaveCount(2);
    } catch (error) {
      throw classifySmokeError("share generate and regenerate flow", error);
    } finally {
      await cleanupShareRows(state);
    }
  });

  test("mobile drawer is full-screen and closes back to the product list", async ({ page }) => {
    try {
      await cleanupShareRows(state);
      await page.setViewportSize({ width: 360, height: 780 });
      await openShareDetail(page, state);

      const drawer = page.locator('aside[aria-label="Detail share produk"]');
      await expect(drawer).toBeVisible();
      const box = await drawer.boundingBox();

      if (!box) {
        throw new Error("Share drawer could not be measured.");
      }

      expect(Math.round(box.width)).toBe(360);
      expect(Math.round(box.height)).toBeGreaterThanOrEqual(760);

      await page.getByRole("link", { name: "Tutup detail" }).click();
      await page.waitForURL(
        (url) => url.pathname === `/share/${PLATFORM}` && !url.searchParams.has("detail"),
        { timeout: 30_000 },
      );
      await expect(drawer).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Share Facebook" })).toBeVisible();
    } catch (error) {
      throw classifySmokeError("share mobile full-screen drawer", error);
    } finally {
      await cleanupShareRows(state);
    }
  });
});
