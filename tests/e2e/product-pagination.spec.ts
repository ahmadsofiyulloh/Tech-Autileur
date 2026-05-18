import { expect, test, type Locator } from "@playwright/test";
import { classifySmokeError } from "./support/blockers";
import { readSmokeBootstrapState, type SmokeBootstrapState } from "./support/bootstrap";
import { createSmokeServiceClient } from "./support/supabase";
import { formatAppDateKey, formatAppOffsetIsoString, formatAppTimestampCode } from "../../src/lib/app-time";

async function seedProductPaginationRows(state: SmokeBootstrapState, count: number) {
  const client = createSmokeServiceClient();
  const products: Array<{ id: string; product_name: string }> = [];

  for (let index = 0; index < count; index += 1) {
    const productName = `Product Pagination Page ${String(index).padStart(2, "0")} ${state.run_tag}`;
    const productCode = `PG${state.run_tag.slice(-6)}${String(index).padStart(2, "0")}`;
    const timestamp = new Date(Date.now() - index * 60_000).toISOString();
    const { data, error } = await client
      .from("products")
      .insert({
        user_id: state.user.id,
        workspace_id: state.workspace.id,
        product_code: productCode,
        product_name: productName,
        status: "DRAFT",
        workflow_status_json: {
          video_generated: false,
          uploaded_shopee: false,
          uploaded_tiktok: false,
        },
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select("id, product_name")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    products.push({ id: data.id, product_name: data.product_name });
  }

  return products;
}

async function cleanupProductPaginationRows(productIds: string[]) {
  if (!productIds.length) {
    return;
  }

  const client = createSmokeServiceClient();
  const { error } = await client.from("products").delete().in("id", productIds);

  if (error) {
    throw new Error(error.message);
  }
}

type SeededProductActivityRows = {
  activeProductId: string;
  activeProductName: string;
  marketplaceLink: string;
  passiveProductId: string;
  passiveProductName: string;
  promptPackId: string;
  searchTerm: string;
};

async function seedProductActivityRows(state: SmokeBootstrapState): Promise<SeededProductActivityRows> {
  const client = createSmokeServiceClient();
  const tag = `Activity Sort ${state.run_tag} ${Date.now()}`;
  const olderTimestamp = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const newerTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const activeProductName = `${tag} Prompt Active`;
  const passiveProductName = `${tag} Product Only`;
  const marketplaceLink = `https://example.com/products/${encodeURIComponent(state.run_tag)}`;
  const { data: products, error: productError } = await client
    .from("products")
    .insert([
      {
        user_id: state.user.id,
        workspace_id: state.workspace.id,
        product_code: `PA${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        product_name: activeProductName,
        marketplace: "Shopee",
        marketplace_product_link: marketplaceLink,
        status: "DRAFT",
        workflow_status_json: {
          video_generated: false,
          uploaded_shopee: false,
          uploaded_tiktok: false,
        },
        created_at: olderTimestamp,
        updated_at: olderTimestamp,
      },
      {
        user_id: state.user.id,
        workspace_id: state.workspace.id,
        product_code: `PA${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        product_name: passiveProductName,
        marketplace: "Shopee",
        marketplace_product_link: `${marketplaceLink}-passive`,
        status: "DRAFT",
        workflow_status_json: {
          video_generated: false,
          uploaded_shopee: false,
          uploaded_tiktok: false,
        },
        created_at: newerTimestamp,
        updated_at: newerTimestamp,
      },
    ])
    .select("id, product_name");

  if (productError) {
    throw new Error(productError.message);
  }

  const activeProduct = products?.find((product) => product.product_name === activeProductName);
  const passiveProduct = products?.find((product) => product.product_name === passiveProductName);

  if (!activeProduct?.id || !passiveProduct?.id) {
    throw new Error("Failed to seed product activity rows.");
  }

  const { data: promptPack, error: promptPackError } = await client
    .from("prompt_packs")
    .insert({
      user_id: state.user.id,
      product_id: activeProduct.id,
      prompt_code: `PROMPT-ACTIVITY-${state.run_tag}-${crypto.randomUUID()}`,
      version: 1,
      status: "GENERATED",
      product_analysis_json: null,
      i2i_prompts_json: null,
      i2v_prompts_json: null,
      consistency_rules_json: null,
      negative_rules_json: null,
      personalization_json: null,
      error_message: null,
      notes: null,
    })
    .select("id")
    .single();

  if (promptPackError) {
    await client.from("products").delete().in("id", [activeProduct.id, passiveProduct.id]);
    throw new Error(promptPackError.message);
  }

  if (!promptPack?.id) {
    await client.from("products").delete().in("id", [activeProduct.id, passiveProduct.id]);
    throw new Error("Failed to seed prompt activity row.");
  }

  return {
    activeProductId: activeProduct.id,
    activeProductName,
    marketplaceLink,
    passiveProductId: passiveProduct.id,
    passiveProductName,
    promptPackId: promptPack.id,
    searchTerm: tag,
  };
}

async function cleanupProductActivityRows(seed: SeededProductActivityRows | null) {
  if (!seed) {
    return;
  }

  const client = createSmokeServiceClient();
  const { error: promptPackError } = await client.from("prompt_packs").delete().eq("id", seed.promptPackId);

  if (promptPackError) {
    throw new Error(promptPackError.message);
  }

  const { error: productError } = await client.from("products").delete().in("id", [seed.activeProductId, seed.passiveProductId]);

  if (productError) {
    throw new Error(productError.message);
  }
}

test("app timestamp helpers use Jakarta UTC+7", () => {
  const utcEvening = "2026-05-17T18:30:00.000Z";

  expect(formatAppDateKey(utcEvening)).toBe("2026-05-18");
  expect(formatAppTimestampCode(utcEvening)).toBe("20260518013000");
  expect(formatAppOffsetIsoString(utcEvening)).toBe("2026-05-18T01:30:00+07:00");
});

async function expectSearchActionInline(toolbar: Locator) {
  const searchInput = toolbar.getByLabel("Cari produk");
  const searchButton = toolbar.getByRole("button", { name: "Cari" });
  await expect(searchInput).toBeVisible();
  await expect(searchButton).toBeVisible();

  const [inputBox, buttonBox] = await Promise.all([searchInput.boundingBox(), searchButton.boundingBox()]);

  if (!inputBox || !buttonBox) {
    throw new Error("Search toolbar layout could not be measured.");
  }

  const inputCenterY = inputBox.y + inputBox.height / 2;
  const buttonCenterY = buttonBox.y + buttonBox.height / 2;
  expect(Math.abs(inputCenterY - buttonCenterY)).toBeLessThan(8);
  expect(buttonBox.x).toBeGreaterThan(inputBox.x);
}

test("desktop product list uses numbered server pagination", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const seededProducts = await seedProductPaginationRows(state, 30);

  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/products?q=${encodeURIComponent(state.run_tag)}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByText("30 hasil")).toBeVisible();
    await expect(page.getByText("Halaman 1/2")).toBeVisible();
    const desktopTable = page.locator(".products-table-desktop");
    await expect(desktopTable.locator(".product-table tbody tr")).toHaveCount(25);
    await expect(desktopTable.getByText(`Product Pagination Page 00 ${state.run_tag}`)).toBeVisible();

    await page.getByRole("link", { name: "2" }).click();
    await page.waitForURL((url) => url.pathname === "/products" && url.searchParams.get("page") === "2", {
      timeout: 30_000,
    });

    await expect(page.getByText("Halaman 2/2")).toBeVisible();
    await expect(desktopTable.locator(".product-table tbody tr")).toHaveCount(5);
    await expect(desktopTable.getByText(`Product Pagination Page 25 ${state.run_tag}`)).toBeVisible();
  } catch (error) {
    throw classifySmokeError("desktop product pagination", error);
  } finally {
    await cleanupProductPaginationRows(seededProducts.map((product) => product.id));
  }
});

test("desktop product list sorts by latest prompt activity", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  let seeded: SeededProductActivityRows | null = null;

  try {
    seeded = await seedProductActivityRows(state);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/products?q=${encodeURIComponent(seeded.searchTerm)}`, {
      waitUntil: "domcontentloaded",
    });

    const rows = page.locator(".products-table-desktop .product-table tbody tr");
    await expect(rows.first()).toContainText(seeded.activeProductName);
    await expect(rows.nth(1)).toContainText(seeded.passiveProductName);
  } catch (error) {
    throw classifySmokeError("product activity sort", error);
  } finally {
    await cleanupProductActivityRows(seeded);
  }
});

test("prompt overview product link opens specific product detail drawer on desktop", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  let seeded: SeededProductActivityRows | null = null;

  try {
    seeded = await seedProductActivityRows(state);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/prompts?q=${encodeURIComponent(seeded.activeProductName)}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    const card = page.locator(".prompt-list-card").filter({ hasText: seeded.activeProductName }).first();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Aksi prompt" }).click();
    await page.locator(".overflow-action-menu__panel").getByRole("link", { name: "Produk" }).click();
    await page.waitForURL((url) => {
      return url.pathname === "/products" && url.searchParams.get("detail") === seeded?.activeProductId && url.searchParams.get("tab") === "metadata";
    });

    const drawer = page.locator('aside[aria-label="Detail produk"]');
    await expect(drawer).toContainText(seeded.activeProductName, { timeout: 45_000 });
    await expect(page.getByRole("link", { name: "Metadata" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("link", { name: "Output" }).click();
    const outputCard = page.locator(".section-card").filter({ hasText: "Output Siap Copy" }).first();
    await expect(outputCard.getByRole("link", { name: "Buka link" })).toHaveAttribute("href", seeded.marketplaceLink);
    await expect(page.locator(".product-table thead th")).toHaveCount(3);

    const [layoutBox, listBox, tableWrapBox, lastTableCellBox, drawerBox] = await Promise.all([
      page.locator(".operator-detail-layout").boundingBox(),
      page.locator(".operator-detail-layout__list").boundingBox(),
      page.locator(".products-table-desktop").boundingBox(),
      page.locator(".product-table tbody tr").first().locator("td").last().boundingBox(),
      drawer.boundingBox(),
    ]);

    if (!layoutBox || !listBox || !tableWrapBox || !lastTableCellBox || !drawerBox) {
      throw new Error("Product detail layout could not be measured.");
    }

    const rightGap = layoutBox.x + layoutBox.width - (drawerBox.x + drawerBox.width);
    const tableBlankRight = tableWrapBox.x + tableWrapBox.width - (lastTableCellBox.x + lastTableCellBox.width);
    expect(rightGap).toBeLessThan(24);
    expect(tableBlankRight).toBeLessThan(24);
    expect(drawerBox.width).toBeLessThanOrEqual(430);
    expect(listBox.x).toBeLessThan(drawerBox.x);
  } catch (error) {
    throw classifySmokeError("prompt product detail link", error);
  } finally {
    await cleanupProductActivityRows(seeded);
  }
});

test("mobile product and prompt search keep submit action inline", async ({ page }) => {
  const state = await readSmokeBootstrapState();

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/products?q=${encodeURIComponent(state.run_tag)}`, {
      waitUntil: "domcontentloaded",
    });
    await expectSearchActionInline(page.locator(".product-list-toolbar"));

    await page.goto(`/prompts?q=${encodeURIComponent(state.run_tag)}`, {
      waitUntil: "domcontentloaded",
    });
    await expectSearchActionInline(page.locator(".prompt-workbench-search-toolbar"));
  } catch (error) {
    throw classifySmokeError("mobile search inline action", error);
  }
});

test("mobile product list appends rows through infinite pagination fallback", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const seededProducts = await seedProductPaginationRows(state, 30);

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/products?q=${encodeURIComponent(state.run_tag)}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator(".products-cards-mobile .visual-list-card")).toHaveCount(20);

    const loadMore = page.getByRole("button", { name: "Muat lagi" });
    await loadMore.scrollIntoViewIfNeeded();
    await loadMore.click();

    await expect(page.locator(".products-cards-mobile .visual-list-card")).toHaveCount(30);
    await expect(page.getByText(`Product Pagination Page 29 ${state.run_tag}`)).toBeVisible();
  } catch (error) {
    throw classifySmokeError("mobile product infinite pagination", error);
  } finally {
    await cleanupProductPaginationRows(seededProducts.map((product) => product.id));
  }
});
