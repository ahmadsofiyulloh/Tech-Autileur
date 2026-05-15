import { expect, test, type Page } from "@playwright/test";
import { classifySmokeError } from "./support/blockers";

async function readThemeCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === "aicos_theme")?.value ?? null;
}

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
    await expect(desktopSidebar).toContainText("Dashboard");
    await expect(desktopSidebar).not.toContainText("Flow Control");
    await expect(desktopSidebar).not.toContainText("Pengaturan");
    await expect(page.getByRole("link", { name: "Pengaturan" })).toBeVisible();
    await expect(page.locator('.topbar-profile-link[href="/settings"]')).toBeVisible();
    await expect(page.locator(".topbar-settings-link")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Mobile operator navigation" })).not.toBeVisible();

    const sidebarHeader = desktopSidebar.locator(".sidebar-header");
    const sidebarNav = desktopSidebar.locator(".sidebar-nav");
    const sidebarFooter = desktopSidebar.locator(".sidebar-footer");
    const sidebarWidth = () => desktopSidebar.evaluate((node) => node.getBoundingClientRect().width);
    const expandedSidebarWidth = await sidebarWidth();
    await expect(sidebarHeader.getByRole("button", { name: /sidebar/i })).toHaveCount(0);
    await expect(sidebarFooter.getByRole("button", { name: "Ciutkan sidebar" })).toBeVisible();

    const [navBox, footerBox] = await Promise.all([
      sidebarNav.evaluate((node) => node.getBoundingClientRect()),
      sidebarFooter.evaluate((node) => node.getBoundingClientRect()),
    ]);
    expect(footerBox.top).toBeGreaterThan(navBox.bottom - 1);

    await sidebarFooter.getByRole("button", { name: "Ciutkan sidebar" }).press("Enter");
    await expect(sidebarFooter.getByRole("button", { name: "Perluas sidebar" })).toBeVisible();
    await expect.poll(sidebarWidth).toBeLessThan(expandedSidebarWidth - 100);
    await expect(desktopSidebar.getByRole("link", { name: "Intake" })).toBeVisible();
    await sidebarFooter.getByRole("button", { name: "Perluas sidebar" }).press("Enter");
    await expect(sidebarFooter.getByRole("button", { name: "Ciutkan sidebar" })).toBeVisible();
    await expect.poll(sidebarWidth).toBeGreaterThan(expandedSidebarWidth - 10);

    await page.goto("/settings");
    await expect(page.locator('a.settings-native-row[href="/settings"]')).toHaveCount(0);
    await expect(page.locator('.settings-native-row[href*="/dashboard"]')).toHaveCount(0);
    await expect(page.locator(".settings-affiliate-overview")).toHaveCount(0);
    await expect(page.locator(".settings-profile-hero--overview")).toBeVisible();
    await expect(page.locator(".settings-profile-hero .status-badge")).toHaveCount(0);

    await page.goto("/products/new", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".intake-active-affiliate-card")).toHaveCount(0);

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
      const drawer = page.getByRole("complementary", { name: "Detail akun affiliate" });
      await expect(page.locator(".image-preview-upload-card__frame")).toHaveCount(2);
      await expect(page.getByText("Upload / replace character image")).toHaveCount(0);
      await expect(page.getByText("Upload / replace environment image")).toHaveCount(0);
      await expect(page.getByText("Hapus referensi")).toHaveCount(0);
      await expect(drawer.locator('textarea[name="product_positioning_notes"]')).toHaveCount(1);
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

test("operator sidebar uses compact rail on tablet widths", async ({ page }) => {
  try {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto("/products/new", { waitUntil: "domcontentloaded" });

    const desktopSidebar = page.getByRole("complementary", { name: "Operator navigation" });
    await expect(desktopSidebar).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile operator navigation" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /sidebar/i })).toHaveCount(0);
    await expect(desktopSidebar.getByRole("link", { name: "Intake" })).toBeVisible();

    const layoutState = await page.evaluate(() => {
      const sidebar = document.querySelector(".sidebar");

      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        sidebarWidth: sidebar?.getBoundingClientRect().width ?? 0,
      };
    });

    expect(layoutState.sidebarWidth).toBeGreaterThan(60);
    expect(layoutState.sidebarWidth).toBeLessThanOrEqual(90);
    expect(layoutState.scrollWidth).toBeLessThanOrEqual(layoutState.clientWidth + 1);
  } catch (error) {
    throw classifySmokeError("tablet operator sidebar", error);
  }
});

test("settings theme preference supports light dark and system modes", async ({ page }) => {
  try {
    await page.setViewportSize({ width: 1280, height: 1600 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Pengaturan", level: 1 })).toBeVisible();

    const lightThemeButton = page.getByRole("button", { name: "Light theme" });
    const systemThemeButton = page.getByRole("button", { name: "System theme" });
    const darkThemeButton = page.getByRole("button", { name: "Dark theme" });
    await expect(lightThemeButton).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("light");
    await expect.poll(() => page.locator("html").getAttribute("data-theme-mode")).toBe("light");

    await darkThemeButton.click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("dark");
    await expect.poll(() => page.locator("html").getAttribute("data-theme-mode")).toBe("dark");
    await expect.poll(() => readThemeCookie(page)).toBe("dark");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("dark");
    await expect.poll(() => page.locator("html").getAttribute("data-theme-mode")).toBe("dark");

    await page.emulateMedia({ colorScheme: "dark" });
    await systemThemeButton.click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme-mode")).toBe("system");
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("dark");
    await expect.poll(() => readThemeCookie(page)).toBe("system");

    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("light");

    await lightThemeButton.click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("light");
    await expect.poll(() => page.locator("html").getAttribute("data-theme-mode")).toBe("light");
    await expect.poll(() => readThemeCookie(page)).toBe("light");
  } catch (error) {
    throw classifySmokeError("settings theme preference", error);
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
      await expect(page.locator(".product-drawer__header .product-status-stack")).toHaveCount(0);
      await expect(drawer.locator(".status-badge")).toHaveCount(0);
      await expect(drawer.getByRole("button", { name: "Analisis ulang aset" })).toHaveCount(1);
      await expect(drawer.locator('textarea[name="product_positioning_notes"]')).toHaveCount(1);

      const assetGrid = page.locator(".affiliate-profile-assets-grid");
      await expect(assetGrid).toBeVisible();
      await expect(assetGrid.locator(".affiliate-profile-asset-card__lock--combined")).toHaveCount(1);
      await expect(drawer.getByRole("checkbox", { name: /Asset lock/i })).toHaveCount(1);

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
      expect(cardBoxes[1].top).toBeGreaterThan(cardBoxes[0].top + 8);
      expect(Math.min(cardBoxes[0].width, cardBoxes[1].width)).toBeGreaterThan(300);

      const previewFrames = assetGrid.locator(".image-preview-upload-card__frame");
      await expect(previewFrames).toHaveCount(2);
      await expect(assetGrid.locator(".image-preview-upload-card__media")).toHaveCount(2);
      const previewSources = await assetGrid.locator(".image-preview-upload-card__media").evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLImageElement).getAttribute("src") ?? ""),
      );
      expect(previewSources.every((src) => src.includes("/api/drive/items/"))).toBe(true);

      const frameHeights = await previewFrames.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
      expect(Math.max(...frameHeights)).toBeLessThan(190);

      await page.keyboard.press("Escape");
    }
  } catch (error) {
    throw classifySmokeError("affiliate profile drawer mobile", error);
  }
});

test("affiliate profile reanalysis submits from the drawer", async ({ page }) => {
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
      await expect(drawer).toHaveAttribute("data-open", "true");

      const characterReanalyseButton = drawer.getByRole("button", { name: "Analisis ulang aset" });
      await expect(characterReanalyseButton).toHaveCount(1);
      const postRequestPromise = page.waitForRequest(
        (request) => request.method() === "POST" && request.url().includes("/settings/affiliate-profiles"),
        { timeout: 10_000 },
      );

      await characterReanalyseButton.click({ noWaitAfter: true });
      await postRequestPromise;
      await expect(drawer.locator(".affiliate-profile-reanalysis-feedback")).toBeVisible();
      await expect(drawer).toBeVisible();
    }
  } catch (error) {
    throw classifySmokeError("affiliate profile reanalysis submit", error);
  }
});
