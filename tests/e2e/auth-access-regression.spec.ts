import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("unauthenticated operator access redirects to login", async ({ page }) => {
  await page.goto("/products/new");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Masuk Operator", level: 1 })).toBeVisible();
});

test("login page does not expose public signup controls", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Buat akun" })).toHaveCount(0);
  await expect(page.locator('button[name="intent"][value="signup"]')).toHaveCount(0);
  await expect(page.getByText("Belum punya akun?")).toHaveCount(0);
});

test("internal operator API POST routes require authenticated access", async ({ page }) => {
  const protectedPostRoutes = [
    "/api/products/bulk-preview",
    "/api/products/bulk-import",
    "/api/products/bulk-import/jobs",
    "/api/products/bulk-import/jobs/00000000-0000-4000-8000-000000000001/run",
    "/api/products/bulk-import/jobs/00000000-0000-4000-8000-000000000001/cancel",
    "/api/prompts/00000000-0000-4000-8000-000000000001/generate",
    "/api/prompts/queue/run-next",
  ];

  for (const route of protectedPostRoutes) {
    const response = await page.request.post(route);

    expect(response.status(), route).toBe(401);
    await expect(response.headers()["content-type"], route).toContain("application/json");
    await expect(response.json(), route).resolves.toEqual({
      ok: false,
      error: {
        message: "Authentication required.",
        code: "UNAUTHORIZED",
      },
    });
  }
});
