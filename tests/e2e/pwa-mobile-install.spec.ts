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
    await page.setViewportSize({ width: 360, height: 800 });
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
    await expect(bottomNav).toContainText("Dashboard");
    await expect(bottomNav).toContainText("Produk");
    await expect(bottomNav).toContainText("Prompt");
    await expect(bottomNav).toContainText("Drive");
    await expect(bottomNav).not.toContainText("Flow Control");
    await expect(bottomNav).not.toContainText("Pengaturan");
    await expect(bottomNav.getByRole("link")).toHaveCount(5);
    await expect(bottomNav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Intake" })).toHaveClass(/bottom-nav__link--center/);
    await expect(bottomNav.getByRole("link", { name: "Produk" })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Prompt" })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Drive" })).toBeVisible();

    const bottomNavFitState = await bottomNav.evaluate((navigation) => {
      const links = Array.from(navigation.querySelectorAll<HTMLElement>(".bottom-nav__link"));
      const sideLinks = links.filter((link) => !link.classList.contains("bottom-nav__link--center"));
      const sideRows = new Set(sideLinks.map((link) => Math.round(link.getBoundingClientRect().top)));
      const labels = sideLinks.map((link) => {
        const label = link.querySelector<HTMLSpanElement>("span");
        const labelRect = label?.getBoundingClientRect();
        const labelStyle = label ? window.getComputedStyle(label) : null;

        return {
          height: labelRect?.height ?? 0,
          lineHeight: Number.parseFloat(labelStyle?.lineHeight ?? "0"),
          overflowWrap: labelStyle?.overflowWrap ?? "",
          text: label?.textContent ?? "",
          whiteSpace: labelStyle?.whiteSpace ?? "",
          wordBreak: labelStyle?.wordBreak ?? "",
        };
      });
      const navRect = navigation.getBoundingClientRect();
      const centerLink = navigation.querySelector<HTMLElement>(".bottom-nav__link--center");
      const centerIconWrap = navigation.querySelector<HTMLElement>(".bottom-nav__center-iconWrap");
      const centerLinkRect = centerLink?.getBoundingClientRect();
      const centerIconRect = centerIconWrap?.getBoundingClientRect();

      return {
        centerIconOffset: centerIconRect
          ? Math.abs(centerIconRect.left + centerIconRect.width / 2 - (navRect.left + navRect.width / 2))
          : Number.POSITIVE_INFINITY,
        centerIconVerticalOffset:
          centerIconRect && centerLinkRect
            ? Math.abs(centerIconRect.top + centerIconRect.height / 2 - (centerLinkRect.top + centerLinkRect.height / 2))
            : Number.POSITIVE_INFINITY,
        centerLinkOffset: centerLinkRect
          ? Math.abs(centerLinkRect.left + centerLinkRect.width / 2 - (navRect.left + navRect.width / 2))
          : Number.POSITIVE_INFINITY,
        gridColumnCount: window.getComputedStyle(navigation).gridTemplateColumns.split(" ").filter(Boolean).length,
        labels,
        sideRowCount: sideRows.size,
      };
    });
    expect(bottomNavFitState.gridColumnCount).toBe(5);
    expect(bottomNavFitState.sideRowCount).toBe(1);
    expect(bottomNavFitState.centerLinkOffset).toBeLessThanOrEqual(1);
    expect(bottomNavFitState.centerIconOffset).toBeLessThanOrEqual(1);
    expect(bottomNavFitState.centerIconVerticalOffset).toBeLessThanOrEqual(1);
    for (const label of bottomNavFitState.labels) {
      expect(label.whiteSpace).toBe("nowrap");
      expect(label.overflowWrap).toBe("normal");
      expect(label.wordBreak).toBe("normal");
      expect(label.height).toBeLessThanOrEqual(label.lineHeight + 1);
    }

    const layoutState = await page.evaluate(() => {
      const bottomNavElement = document.querySelector(".bottom-nav");
      const topbarElement = document.querySelector(".operator-topbar");
      const shellMain = document.querySelector(".shell-main");
      const navRect = bottomNavElement?.getBoundingClientRect();
      const mainRect = shellMain?.getBoundingClientRect();
      const bodyStyle = document.body ? window.getComputedStyle(document.body) : null;
      const mainStyle = shellMain ? window.getComputedStyle(shellMain) : null;
      const topbarStyle = topbarElement ? window.getComputedStyle(topbarElement) : null;

      return {
        bodyClientHeight: document.scrollingElement?.clientHeight ?? document.documentElement.clientHeight,
        bodyOverflowY: bodyStyle?.overflowY ?? "",
        bodyScrollHeight: document.scrollingElement?.scrollHeight ?? document.documentElement.scrollHeight,
        clientWidth: document.documentElement.clientWidth,
        mainClientHeight: shellMain instanceof HTMLElement ? shellMain.clientHeight : 0,
        mainOverflowY: mainStyle?.overflowY ?? "",
        mainRectTop: mainRect?.top ?? 0,
        mainScrollHeight: shellMain instanceof HTMLElement ? shellMain.scrollHeight : 0,
        mainOverscrollBehaviorY: mainStyle?.overscrollBehaviorY ?? "",
        navBottom: navRect?.bottom ?? 0,
        navTop: navRect?.top ?? 0,
        paddingBottom: mainStyle?.paddingBottom ?? "",
        topbarPosition: topbarStyle?.position ?? "",
        scrollWidth: document.documentElement.scrollWidth,
        viewportHeight: window.innerHeight,
      };
    });

    expect(layoutState.scrollWidth).toBeLessThanOrEqual(layoutState.clientWidth + 1);
    expect(layoutState.bodyScrollHeight).toBeLessThanOrEqual(layoutState.bodyClientHeight + 1);
    expect(layoutState.bodyOverflowY).toBe("hidden");
    expect(layoutState.mainOverflowY).toBe("auto");
    expect(layoutState.mainOverscrollBehaviorY).toBe("contain");
    expect(layoutState.mainScrollHeight).toBeGreaterThanOrEqual(layoutState.mainClientHeight);
    expect(layoutState.topbarPosition).toBe("relative");
    expect(layoutState.navBottom).toBeLessThanOrEqual(layoutState.viewportHeight + 1);
    expect(layoutState.navTop).toBeGreaterThan(layoutState.viewportHeight - 140);
    expect(layoutState.mainRectTop).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(layoutState.paddingBottom)).toBeGreaterThan(80);
  } catch (error) {
    throw classifySmokeError("mobile PWA shell", error);
  }
});

test("mobile shell exposes a pull-to-refresh fallback when the gesture is active", async ({ page }) => {
  try {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/products/new");
    await expect(page.getByRole("heading", { name: "Intake", level: 1 })).toBeVisible();
    await page.waitForTimeout(150);

    const pullButton = page.getByRole("button", { name: /Tarik untuk muat ulang|Lepas untuk muat ulang|Muat ulang\.\.\./ });
    await expect(pullButton).toHaveCount(0);

    await page.locator(".shell-main").evaluate((element) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error("shell-main is missing.");
      }

      element.scrollTop = 0;
      const rect = element.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + 12;

      const startTouch = new Touch({
        clientX: startX,
        clientY: startY,
        force: 1,
        identifier: 1,
        pageX: startX,
        pageY: startY,
        radiusX: 1,
        radiusY: 1,
        rotationAngle: 0,
        screenX: startX,
        screenY: startY,
        target: element,
      });

      element.dispatchEvent(
        new TouchEvent("touchstart", {
          bubbles: true,
          cancelable: true,
          changedTouches: [startTouch],
          touches: [startTouch],
          targetTouches: [startTouch],
        }),
      );

      const moveY = startY + 96;
      const moveTouch = new Touch({
        clientX: startX,
        clientY: moveY,
        force: 1,
        identifier: 1,
        pageX: startX,
        pageY: moveY,
        radiusX: 1,
        radiusY: 1,
        rotationAngle: 0,
        screenX: startX,
        screenY: moveY,
        target: element,
      });

      element.dispatchEvent(
        new TouchEvent("touchmove", {
          bubbles: true,
          cancelable: true,
          changedTouches: [moveTouch],
          touches: [moveTouch],
          targetTouches: [moveTouch],
        }),
      );
    });

    await expect(page.getByRole("button", { name: "Lepas untuk muat ulang" })).toBeVisible();
    await page.getByRole("button", { name: "Lepas untuk muat ulang" }).click();
    await expect(page.getByRole("button", { name: "Muat ulang..." })).toBeVisible();
  } catch (error) {
    throw classifySmokeError("mobile pull-to-refresh fallback", error);
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
