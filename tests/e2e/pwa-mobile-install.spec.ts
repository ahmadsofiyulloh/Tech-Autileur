import { expect, test } from "@playwright/test";
import { classifySmokeError } from "./support/blockers";

type ManifestIcon = {
  purpose?: string;
  sizes?: string;
  src?: string;
  type?: string;
};

type ManifestScreenshot = {
  form_factor?: string;
  label?: string;
  sizes?: string;
  src?: string;
  type?: string;
};

type WebAppManifest = {
  background_color?: string;
  categories?: string[];
  display?: string;
  icons?: ManifestIcon[];
  lang?: string;
  scope?: string;
  screenshots?: ManifestScreenshot[];
  short_name?: string;
  start_url?: string;
  theme_color?: string;
};

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

test("manifest exposes Phase 1 install metadata and screenshot assets", async ({ page }) => {
  try {
    const response = await page.request.get("/manifest.webmanifest");
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"] ?? "").toContain("application/manifest+json");

    const manifest = (await response.json()) as WebAppManifest;
    expect(manifest.short_name).toBe("AICOS");
    expect(manifest.lang).toBe("id-ID");
    expect(manifest.start_url).toBe("/products/new");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#f8fbfd");
    expect(manifest.background_color).toBe("#f8fbfd");
    expect(manifest.categories).toEqual(expect.arrayContaining(["business", "productivity"]));
    expect(manifest.icons?.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable")).toBe(true);

    const screenshots = manifest.screenshots ?? [];
    expect(screenshots.some((screenshot) => screenshot.form_factor === "narrow" && screenshot.sizes === "390x844")).toBe(true);
    expect(screenshots.some((screenshot) => screenshot.form_factor === "wide" && screenshot.sizes === "1280x720")).toBe(true);

    for (const screenshot of screenshots) {
      expect(screenshot.src).toBeTruthy();
      const screenshotResponse = await page.request.get(screenshot.src ?? "");
      expect(screenshotResponse.ok()).toBeTruthy();
      expect(screenshotResponse.headers()["content-type"] ?? "").toContain(screenshot.type ?? "image/");
    }
  } catch (error) {
    throw classifySmokeError("PWA manifest install metadata", error);
  }
});

test("mobile intake shell has install-ready head tags and no horizontal overflow", async ({ page }) => {
  try {
    await page.goto("/products/new");
    await expect(page.getByRole("heading", { name: "Intake", level: 1 })).toBeVisible();

    const headState = await page.evaluate(() => ({
      appleCapable: document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-capable"]')?.content ?? null,
      manifestHref: document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.getAttribute("href") ?? null,
      themeColor: document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content ?? null,
      viewport: document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content ?? null,
    }));
    expect(headState.manifestHref).toBe("/manifest.webmanifest");
    expect(headState.themeColor).toBe("#f8fbfd");
    expect(headState.viewport).toContain("viewport-fit=cover");
    expect(headState.appleCapable).toBe("yes");

    const bottomNav = page.getByRole("navigation", { name: "Mobile operator navigation" });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav).toContainText("Intake");
    await expect(bottomNav).toContainText("Produk");
    await expect(bottomNav).toContainText("Prompt");
    await expect(bottomNav).toContainText("Drive");
    await expect(bottomNav).not.toContainText("Flow Control");
    await expect(bottomNav).not.toContainText("Pengaturan");

    const layoutState = await page.evaluate(() => {
      const bottomNavElement = document.querySelector(".bottom-nav");
      const shellMain = document.querySelector(".shell-main");
      const navRect = bottomNavElement?.getBoundingClientRect();
      const mainStyle = shellMain ? window.getComputedStyle(shellMain) : null;

      return {
        clientWidth: document.documentElement.clientWidth,
        navBottom: navRect?.bottom ?? 0,
        navTop: navRect?.top ?? 0,
        paddingBottom: mainStyle?.paddingBottom ?? "",
        scrollWidth: document.documentElement.scrollWidth,
        viewportHeight: window.innerHeight,
      };
    });

    expect(layoutState.scrollWidth).toBeLessThanOrEqual(layoutState.clientWidth + 1);
    expect(layoutState.navBottom).toBeLessThanOrEqual(layoutState.viewportHeight + 1);
    expect(layoutState.navTop).toBeGreaterThan(layoutState.viewportHeight - 140);
    expect(Number.parseFloat(layoutState.paddingBottom)).toBeGreaterThan(80);
  } catch (error) {
    throw classifySmokeError("mobile PWA shell", error);
  }
});

test("install affordance appears only when the browser exposes an install prompt", async ({ page }) => {
  try {
    await page.goto("/products/new");
    await expect(page.getByRole("heading", { name: "Intake", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pasang app" })).toHaveCount(0);

    await page.evaluate(() => {
      const installEvent = new Event("beforeinstallprompt", { cancelable: true });
      Object.defineProperties(installEvent, {
        prompt: {
          value: async () => undefined,
        },
        userChoice: {
          value: Promise.resolve({ outcome: "dismissed", platform: "web" }),
        },
      });
      window.dispatchEvent(installEvent);
    });

    await expect(page.getByRole("region", { name: "Pasang app" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pasang" })).toBeVisible();
  } catch (error) {
    throw classifySmokeError("PWA install affordance", error);
  }
});

test("standalone display mode hides install affordance", async ({ page }) => {
  try {
    await page.addInitScript(() => {
      const browserMatchMedia = window.matchMedia.bind(window);

      window.matchMedia = (query: string) => {
        if (query === "(display-mode: standalone)") {
          return {
            addEventListener: () => undefined,
            addListener: () => undefined,
            dispatchEvent: () => false,
            matches: true,
            media: query,
            onchange: null,
            removeEventListener: () => undefined,
            removeListener: () => undefined,
          } as MediaQueryList;
        }

        return browserMatchMedia(query);
      };

      Object.defineProperty(window.navigator, "standalone", {
        configurable: true,
        get: () => true,
      });
    });

    await page.goto("/products/new");
    await expect(page.getByRole("heading", { name: "Intake", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pasang app" })).toHaveCount(0);
  } catch (error) {
    throw classifySmokeError("PWA standalone affordance", error);
  }
});
