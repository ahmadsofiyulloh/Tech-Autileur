import { expect, test } from "@playwright/test";
import { classifySmokeError } from "./support/blockers";

test.use({
  viewport: {
    width: 390,
    height: 844,
  },
});

test("mobile users see the desktop-required controller state", async ({ page }) => {
  try {
    await page.goto("/controller");
    await expect(page.getByText("Flow Control tersedia di desktop.")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile operator navigation" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile operator navigation" })).not.toContainText("Flow Control");
  } catch (error) {
    throw classifySmokeError("APP_BLOCKER / mobile controller", error);
  }
});

