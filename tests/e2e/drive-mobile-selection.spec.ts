import { expect, test, type Locator, type Page } from "@playwright/test";
import { classifySmokeError } from "./support/blockers";

test.use({
  hasTouch: true,
  isMobile: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  viewport: {
    width: 390,
    height: 844,
  },
});

async function longPressTile(page: Page, tile: Locator) {
  const box = await tile.boundingBox();

  if (!box) {
    throw new Error("Drive tile is not visible.");
  }

  const clientX = Math.round(box.x + box.width / 2);
  const clientY = Math.round(box.y + box.height / 2);

  await tile.dispatchEvent("pointerdown", {
    button: 0,
    buttons: 1,
    clientX,
    clientY,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
  });

  await page.waitForTimeout(500);
  await tile.dispatchEvent("contextmenu", {
    clientX,
    clientY,
    button: 2,
  });
  await tile.dispatchEvent("pointerup", {
    button: 0,
    buttons: 0,
    clientX,
    clientY,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
  });
}

test("mobile drive long-press selection persists after release", async ({ page }) => {
  try {
    await page.goto("/drive");
    await expect(page.getByRole("heading", { name: "Drive", level: 1 })).toBeVisible();

    const tiles = page.locator(".drive-tile");
    const firstTile = tiles.first();
    const secondTile = tiles.nth(1);

    await expect(firstTile).toBeVisible();
    await expect(secondTile).toBeVisible();

    await longPressTile(page, firstTile);

    await expect(firstTile).toHaveAttribute("data-selected", "true");
    await expect(page.locator(".muted-box strong")).toHaveText("1 dipilih");

    await secondTile.click();

    await expect(firstTile).toHaveAttribute("data-selected", "true");
    await expect(secondTile).toHaveAttribute("data-selected", "true");
    await expect(page.locator(".muted-box strong")).toHaveText("2 dipilih");
    await expect(page.getByRole("dialog", { name: "Preview Drive" })).toHaveCount(0);
  } catch (error) {
    throw classifySmokeError("drive mobile selection", error);
  }
});

test("mobile drive tap still opens preview when no selection is active", async ({ page }) => {
  try {
    await page.goto("/drive");
    await expect(page.getByRole("heading", { name: "Drive", level: 1 })).toBeVisible();

    const firstTile = page.locator(".drive-tile").first();
    await expect(firstTile).toBeVisible();

    await firstTile.click();

    await expect(page.getByRole("dialog", { name: "Preview Drive" })).toBeVisible();
  } catch (error) {
    throw classifySmokeError("drive preview tap fallback", error);
  }
});
