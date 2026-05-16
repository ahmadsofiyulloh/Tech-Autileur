import { expect, test, type Locator } from "@playwright/test";
import { classifySmokeError } from "./support/blockers";
import { readSmokeBootstrapState, type SmokeBootstrapState } from "./support/bootstrap";
import { createSmokeServiceClient } from "./support/supabase";

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
