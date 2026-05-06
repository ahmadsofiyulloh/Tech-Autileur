import { expect, test } from "@playwright/test";
import { classifySmokeError } from "./support/blockers";

test("operator shell and settings surfaces stay reachable", async ({ page }) => {
  try {
    page.on("dialog", (dialog) => {
      void dialog.accept();
    });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const desktopSidebar = page.getByRole("complementary", { name: "Operator navigation" });
    await expect(desktopSidebar).toContainText("Intake");
    await expect(desktopSidebar).toContainText("Produk");
    await expect(desktopSidebar).toContainText("Prompt");
    await expect(desktopSidebar).toContainText("Drive");
    await expect(desktopSidebar).not.toContainText("Dashboard");
    await expect(desktopSidebar).not.toContainText("Flow Control");
    await expect(desktopSidebar).not.toContainText("Pengaturan");
    await expect(page.getByRole("link", { name: "Pengaturan" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile operator navigation" })).not.toBeVisible();

    await page.goto("/settings");
    await expect(page.locator('a.settings-native-row[href="/settings"]')).toHaveCount(0);

    await page.goto("/settings/account");
    await expect(page.getByRole("heading", { name: "Account", level: 1 })).toBeVisible();
    await expect(page.locator(".tab-nav")).toHaveCount(0);

    const helperApiTokenSchemaWarning = page.getByText("App API Token unavailable.");
    if (await helperApiTokenSchemaWarning.isVisible()) {
      const schemaMessage =
        (await page.getByText(/Could not find the table 'public\.helper_api_tokens' in the schema cache/i).textContent().catch(() => null)) ??
        "Helper API token schema missing.";
      throw classifySmokeError("settings account", new Error(schemaMessage));
    }

    await expect
      .poll(
        async () => {
          await page.getByRole("button", { name: "Buat", exact: true }).click();
          return (await page.locator("pre.json-block").first().textContent({ timeout: 500 }).catch(() => "")) ?? "";
        },
        { timeout: 15_000 },
      )
      .toContain('"pairing_code"');
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Unduh JSON" }).click();
    const pairingDownload = await downloadPromise;
    expect(pairingDownload.suggestedFilename()).toBe("chrome-pairing.json");
    await expect
      .poll(
        async () => {
          if ((await page.locator("pre.json-block").count()) > 0) {
            await page.getByRole("button", { name: "Lepas Pairing" }).click();
          }

          return page.locator("pre.json-block").count();
        },
        { timeout: 15_000 },
      )
      .toBe(0);

    await page.getByRole("button", { name: "Buat token" }).click();
    await expect(page.locator("pre.json-block")).toContainText('"raw_token"');
    await expect(page.getByRole("button", { name: "Simpan hash" })).toBeVisible();
    await page.getByRole("button", { name: "Simpan hash" }).click();
    const revokeTokenButton = page.locator(".desktop-action-set").getByRole("button", { name: "Cabut token" });
    await expect(revokeTokenButton).toBeEnabled();
    await expect(page.getByText("ACTIVE")).toBeVisible();
    await revokeTokenButton.click();
    await expect(page.getByText("Belum ada token aktif.")).toBeVisible();

    await page.goto("/settings/workspace");
    await expect(page.getByRole("heading", { name: "Workspace", level: 1 })).toBeVisible();
    await expect(page.locator(".tab-nav")).toHaveCount(0);
    const workspaceSchemaWarning = page.getByText("Workspace schema pending.");
    if (!(await workspaceSchemaWarning.isVisible())) {
      await page.getByRole("button", { name: "Workspace baru" }).click();
      await expect(page.getByRole("complementary", { name: "Detail workspace" })).toBeVisible();
      await expect(page.locator('input[name="workspace_name"]')).toBeVisible();
      await page.keyboard.press("Escape");
    }

    await page.goto("/settings/affiliate-profiles");
    await expect(page.getByRole("heading", { name: "Akun Affiliate", level: 1 })).toBeVisible();
    await expect(page.locator(".tab-nav")).toHaveCount(0);
    const affiliateDetailButton = page.getByRole("button", { name: "Detail" });
    if (await affiliateDetailButton.count()) {
      await affiliateDetailButton.first().click();
      await expect(page.locator(".image-preview-upload-card__frame")).toHaveCount(2);
      await expect(page.getByText("Upload / replace character image")).toHaveCount(0);
      await expect(page.getByText("Upload / replace environment image")).toHaveCount(0);
      await expect(page.getByText("Hapus referensi")).toHaveCount(0);
      await page.keyboard.press("Escape");
    }

    await page.goto("/settings/gemini");
    await expect(page.getByRole("heading", { name: "Gemini", level: 1 })).toBeVisible();
    await expect(page.locator(".tab-nav")).toHaveCount(0);

    await page.goto("/gemini");
    await expect(page).toHaveURL(/\/settings\/gemini$/);

    await page.goto("/settings/drive");
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Pengaturan", level: 1 })).toBeVisible();
    await expect(page.locator(".tab-nav")).toHaveCount(0);
  } catch (error) {
    throw classifySmokeError("shell and settings", error);
  }
});

test("affiliate profile drawer stays compact on mobile", async ({ page }) => {
  try {
    page.on("dialog", (dialog) => {
      void dialog.accept();
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings/affiliate-profiles", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Akun Affiliate", level: 1 })).toBeVisible();
    await expect(page.locator(".tab-nav")).toHaveCount(0);

    const affiliateDetailButton = page.getByRole("button", { name: "Detail" });
    if (await affiliateDetailButton.count()) {
      await affiliateDetailButton.first().click();

      const drawer = page.getByRole("complementary", { name: "Detail akun affiliate" });
      await expect(drawer).toBeVisible();
      await expect(page.locator(".product-drawer__header .product-status-stack")).toBeVisible();

      const assetGrid = page.locator(".affiliate-profile-assets-grid");
      await expect(assetGrid).toBeVisible();

      const assetCards = assetGrid.locator(".affiliate-profile-asset-card");
      await expect(assetCards).toHaveCount(2);

      const cardBoxes = await assetCards.evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          };
        }),
      );
      expect(Math.abs(cardBoxes[0].top - cardBoxes[1].top)).toBeLessThan(10);
      expect(Math.max(cardBoxes[0].width, cardBoxes[1].width)).toBeLessThan(220);

      const previewFrames = assetGrid.locator(".image-preview-upload-card__frame");
      await expect(previewFrames).toHaveCount(2);

      const frameHeights = await previewFrames.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
      expect(Math.max(...frameHeights)).toBeLessThan(190);

      await page.keyboard.press("Escape");
    }
  } catch (error) {
    throw classifySmokeError("affiliate profile drawer mobile", error);
  }
});
