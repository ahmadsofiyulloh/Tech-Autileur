import { expect, test } from "@playwright/test";
import { classifySmokeError } from "./support/blockers";

test("operator shell and settings surfaces stay reachable", async ({ page }) => {
  try {
    await page.goto("/dashboard");
    const desktopSidebar = page.getByRole("complementary", { name: "Operator navigation" });
    await expect(desktopSidebar).toContainText("Dashboard");
    await expect(desktopSidebar).toContainText("Produk");
    await expect(desktopSidebar).toContainText("Prompt");
    await expect(desktopSidebar).toContainText("Flow Control");
    await expect(desktopSidebar).toContainText("Pengaturan");
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

    await page.getByRole("button", { name: "Buat", exact: true }).click();
    await expect(page.locator("pre.json-block")).toContainText('"pairing_code"');
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Unduh JSON" }).click();
    const pairingDownload = await downloadPromise;
    expect(pairingDownload.suggestedFilename()).toBe("chrome-pairing.json");
    await page.getByRole("button", { name: "Lepas Pairing" }).click();
    await expect(page.locator("pre.json-block")).toHaveCount(0);

    await page.getByRole("button", { name: "Buat token" }).click();
    await expect(page.locator("pre.json-block")).toContainText('"raw_token"');
    await expect(page.getByRole("button", { name: "Simpan hash" })).toBeVisible();
    await page.getByRole("button", { name: "Simpan hash" }).click();
    await expect(page.getByText("APP_API_TOKEN", { exact: true })).toBeVisible();
    await expect(page.getByText("ACTIVE")).toBeVisible();
    await page.getByRole("button", { name: "Cabut token" }).click();
    await expect(page.getByText("DISABLED", { exact: true })).toBeVisible();

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
    await expect(page.getByRole("heading", { name: /Gemini/i })).toBeVisible();
    await expect(page.locator(".tab-nav")).toHaveCount(0);

    await page.goto("/gemini");
    await expect(page).toHaveURL(/\/settings\/gemini$/);

    await page.goto("/settings/drive");
    await expect(page.getByRole("heading", { name: "Drive", level: 1 })).toBeVisible();
    await expect(page.locator(".tab-nav")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Buka Drive" })).toBeVisible();
  } catch (error) {
    throw classifySmokeError("shell and settings", error);
  }
});
