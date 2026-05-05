import { expect, test } from "@playwright/test";
import { classifySmokeError } from "./support/blockers";

test.use({
  viewport: {
    width: 390,
    height: 844,
  },
});

test("mobile controller access redirects to the Phase 1 intake surface", async ({ page }) => {
  try {
    await page.goto("/controller");
    await expect(page).toHaveURL(/\/products\/new$/);
    await expect(page.getByRole("heading", { name: "Intake", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile operator navigation" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile operator navigation" })).not.toContainText("Flow Control");
  } catch (error) {
    throw classifySmokeError("APP_BLOCKER / mobile controller", error);
  }
});
