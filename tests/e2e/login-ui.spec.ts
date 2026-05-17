import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("login page uses desktop split auth layout", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/login?error=Email%20and%20password%20are%20required.");

  await expect(page.getByRole("heading", { name: "Masuk Operator", level: 1 })).toBeVisible();
  await expect(page.getByText("Lanjutkan produksi konten AI.")).toBeVisible();
  await expect(page.locator(".auth-visual-panel")).toBeVisible();
  await expect(page.locator(".auth-brand-lockup")).toContainText("Affiliate AI");
  await expect(page.locator(".auth-illustration")).toBeVisible();
  await expect(page.locator(".auth-error")).toContainText("Email and password are required.");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Buat akun" })).toBeHidden();
  await expect(page.getByText("Belum punya akun?")).toBeHidden();
  await expect(page.getByText("Lupa Kata Sandi?")).toBeVisible();

  const visualBox = await page.locator(".auth-visual-panel").boundingBox();
  const cardBox = await page.locator(".auth-card").boundingBox();
  if (!visualBox || !cardBox) {
    throw new Error("Expected desktop login visual and card layout boxes.");
  }

  expect(Math.abs(visualBox.width - 688)).toBeLessThanOrEqual(4);
  expect(cardBox.width).toBeGreaterThanOrEqual(380);
  expect(cardBox.width).toBeLessThanOrEqual(388);
  expect(Math.abs(cardBox.x + cardBox.width / 2 - 1024.5)).toBeLessThanOrEqual(12);

  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
});

test("login page stays compact on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");

  await expect(page.locator(".auth-visual-panel")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Masuk Operator", level: 1 })).toBeVisible();
  await expect(page.getByText("Lanjutkan produksi konten AI.")).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

  const headingBox = await page.getByRole("heading", { name: "Masuk Operator", level: 1 }).boundingBox();
  const lockBox = await page.locator(".auth-mobile-lock").boundingBox();
  const submitBox = await page.getByRole("button", { name: "Masuk" }).boundingBox();
  if (!headingBox || !lockBox || !submitBox) {
    throw new Error("Expected mobile login heading, lock, and submit button layout boxes.");
  }

  expect(Math.abs(lockBox.x + lockBox.width / 2 - 390 / 2)).toBeLessThanOrEqual(2);
  expect(Math.abs(headingBox.x + headingBox.width / 2 - 390 / 2)).toBeLessThanOrEqual(2);
  expect(submitBox.width).toBeGreaterThan(320);
  await expect(page.locator(".auth-field__label").first()).toHaveText("Email");
  await page.getByLabel("Email", { exact: true }).fill("operator@example.com");

  await page.getByLabel("Password", { exact: true }).fill("secret123");
  const passwordLabel = page.locator(".auth-field__label").filter({ hasText: "Password" });
  const passwordLabelBox = await passwordLabel.boundingBox();
  const passwordInputBox = await page.getByLabel("Password", { exact: true }).boundingBox();
  if (!passwordLabelBox || !passwordInputBox) {
    throw new Error("Expected password label and input layout boxes.");
  }
  expect(passwordLabelBox.y).toBeLessThan(passwordInputBox.y);
  await page.getByRole("button", { name: "Tampilkan password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Sembunyikan password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");

  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
});
