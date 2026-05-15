import { expect, test as setup } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { classifySmokeError } from "./support/blockers";
import { readSmokeBootstrapState, smokeAuthStatePath } from "./support/bootstrap";

setup("prepare smoke auth state", async ({ page }) => {
  const state = await readSmokeBootstrapState();

  try {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(state.user.email);
    await page.getByLabel("Password", { exact: true }).fill(state.user.password);
    await page.getByRole("button", { name: "Masuk" }).click();

    await page.waitForURL(/\/products\/new/);
    await expect(page.getByRole("heading", { name: "Intake", level: 1 })).toBeVisible();

    await mkdir(path.dirname(smokeAuthStatePath), { recursive: true });
    await page.context().storageState({ path: smokeAuthStatePath });
  } catch (error) {
    throw classifySmokeError("login setup", error);
  }
});
