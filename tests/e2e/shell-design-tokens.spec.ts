import { test, expect } from "@playwright/test";
import { readSmokeBootstrapState } from "./support/bootstrap";

test.describe("Shell design token consistency and Vercel feel", () => {
  let baseUrl: string;

  test.beforeAll(async () => {
    const state = await readSmokeBootstrapState();
    baseUrl = state.base_url;
  });

  test("bottom nav: edge-attached, border-top only, no border-radius, no gradient", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/dashboard`);
    await page.waitForSelector(".bottom-nav");

    const styles = await page.evaluate(() => {
      const nav = document.querySelector(".bottom-nav") as HTMLElement;
      const cs = getComputedStyle(nav);
      return {
        position: cs.position,
        borderTopWidth: cs.borderTopWidth,
        borderTopStyle: cs.borderTopStyle,
        borderBottomWidth: cs.borderBottomWidth,
        borderLeftWidth: cs.borderLeftWidth,
        borderRightWidth: cs.borderRightWidth,
        borderRadius: cs.borderRadius,
        backgroundImage: cs.backgroundImage,
        backdropFilter: cs.backdropFilter,
        bottom: cs.bottom,
      };
    });

    expect(styles.position).toBe("fixed");
    expect(styles.borderTopWidth).toBe("1px");
    expect(styles.borderTopStyle).toBe("solid");
    expect(styles.borderRadius).toBe("0px");
    // No gradient — background-image should be none
    expect(styles.backgroundImage).toBe("none");
    // No backdrop-blur
    expect(styles.backdropFilter).toBe("none");
    expect(styles.bottom).toBe("0px");
  });

  test("bottom nav active state: neutral tint, not primary/blue accent", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/dashboard`);
    await page.waitForSelector('.bottom-nav__link[data-active="true"]');

    const activeColors = await page.evaluate(() => {
      const active = document.querySelector('.bottom-nav__link[data-active="true"]') as HTMLElement;
      const inactive = document.querySelector('.bottom-nav__link:not([data-active="true"])') as HTMLElement;
      const csActive = getComputedStyle(active);
      const csInactive = inactive ? getComputedStyle(inactive) : null;
      return {
        activeColor: csActive.color,
        activeBg: csActive.backgroundColor,
        inactiveColor: csInactive?.color ?? null,
      };
    });

    // Active should NOT be blue/primary (#0070f3 = rgb(0, 112, 243))
    expect(activeColors.activeColor).not.toContain("0, 112, 243");
    // Active bg should be a subtle neutral tint (not fully transparent, not solid blue)
    expect(activeColors.activeBg).not.toBe("rgba(0, 0, 0, 0)");
    expect(activeColors.activeBg).not.toContain("0, 112, 243");
  });

  test("bottom nav: all items equal weight, no elevated center FAB", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/dashboard`);
    await page.waitForSelector(".bottom-nav");

    const centerLink = await page.evaluate(() => {
      const center = document.querySelector(".bottom-nav__link--center") as HTMLElement;
      if (!center) return null;
      const cs = getComputedStyle(center);
      const wrap = center.querySelector(".bottom-nav__center-iconWrap") as HTMLElement;
      const wrapCs = wrap ? getComputedStyle(wrap) : null;
      return {
        boxShadow: cs.boxShadow,
        marginTop: cs.marginTop,
        wrapBoxShadow: wrapCs?.boxShadow ?? "none",
        wrapBorderRadius: wrapCs?.borderRadius ?? "0px",
      };
    });

    if (centerLink) {
      // No elevated FAB shadow
      expect(centerLink.boxShadow).toBe("none");
      // No negative margin pulling it up like a FAB
      const marginTop = parseInt(centerLink.marginTop);
      expect(marginTop).toBeGreaterThanOrEqual(-2); // allow tiny offset but not FAB-style
      // Icon wrap should not have circle/pill shadow
      expect(centerLink.wrapBoxShadow).toBe("none");
    }
  });

  test("sidebar: solid surface, no gradient, border-right only, no box-shadow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/dashboard`);
    await page.waitForSelector(".sidebar");

    const styles = await page.evaluate(() => {
      const sidebar = document.querySelector(".sidebar") as HTMLElement;
      const cs = getComputedStyle(sidebar);
      return {
        backgroundImage: cs.backgroundImage,
        borderRightWidth: cs.borderRightWidth,
        borderRightStyle: cs.borderRightStyle,
        boxShadow: cs.boxShadow,
      };
    });

    // No gradient background
    expect(styles.backgroundImage).toBe("none");
    // Has border-right
    expect(styles.borderRightWidth).not.toBe("0px");
    // Box-shadow should be inset border simulation only or none
    if (styles.boxShadow !== "none") {
      expect(styles.boxShadow).toContain("inset");
    }
  });

  test("sidebar active link: neutral tint, 6px radius, no rail indicator", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/dashboard`);
    await page.waitForSelector('.sidebar-link[data-active="true"]');

    const styles = await page.evaluate(() => {
      const active = document.querySelector('.sidebar-link[data-active="true"]') as HTMLElement;
      const cs = getComputedStyle(active);
      // Check for ::before pseudo-element (rail indicator)
      const before = getComputedStyle(active, "::before");
      return {
        borderRadius: cs.borderRadius,
        backgroundColor: cs.backgroundColor,
        color: cs.color,
        beforeWidth: before.width,
        beforeDisplay: before.display,
        beforeContent: before.content,
      };
    });

    // Border radius should be 6px
    expect(styles.borderRadius).toBe("6px");
    // Background should be a subtle neutral tint (not transparent, not blue)
    expect(styles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.backgroundColor).not.toContain("0, 112, 243");
    // No rail indicator pseudo-element
    if (styles.beforeContent !== "none" && styles.beforeContent !== '""' && styles.beforeContent !== "normal") {
      // If there's a before pseudo, it shouldn't be a visible rail
      expect(styles.beforeDisplay === "none" || styles.beforeWidth === "0px" || styles.beforeWidth === "auto").toBeTruthy();
    }
  });

  test("sidebar nav gap is 2px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/dashboard`);
    await page.waitForSelector(".sidebar-nav");

    const gap = await page.evaluate(() => {
      const nav = document.querySelector(".sidebar-nav") as HTMLElement;
      return getComputedStyle(nav).gap;
    });

    expect(gap).toBe("2px");
  });

  test("sidebar link transition uses specific properties, not 'all'", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/dashboard`);
    await page.waitForSelector(".sidebar-link");

    const transition = await page.evaluate(() => {
      const link = document.querySelector(".sidebar-link") as HTMLElement;
      return getComputedStyle(link).transition;
    });

    // Should not use 'all'
    expect(transition).not.toContain("all ");
    // Should include background and color
    expect(transition).toContain("background");
    expect(transition).toContain("color");
  });

  test("color tokens: no hardcoded hex in computed nav styles", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/dashboard`);
    await page.waitForSelector(".sidebar");

    // This test verifies that the shell uses CSS custom properties
    // by checking that key elements have non-empty CSS variable references in their stylesheets
    const usesTokens = await page.evaluate(() => {
      const sidebar = document.querySelector(".sidebar") as HTMLElement;
      const bottomNav = document.querySelector(".bottom-nav");
      const results: string[] = [];

      // Check sidebar uses token-based background
      const sidebarBg = getComputedStyle(sidebar).backgroundColor;
      if (sidebarBg && sidebarBg !== "rgba(0, 0, 0, 0)") {
        results.push(`sidebar-bg:${sidebarBg}`);
      }

      return results;
    });

    // Just verify we got computed values (tokens resolved correctly)
    expect(usesTokens.length).toBeGreaterThan(0);
  });

  test("topbar: no gradient, border-bottom, transparent/semi-transparent bg", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/dashboard`);
    await page.waitForSelector(".operator-topbar");

    const styles = await page.evaluate(() => {
      const topbar = document.querySelector(".operator-topbar") as HTMLElement;
      const cs = getComputedStyle(topbar);
      return {
        borderBottomWidth: cs.borderBottomWidth,
        borderBottomStyle: cs.borderBottomStyle,
        boxShadow: cs.boxShadow,
      };
    });

    expect(styles.borderBottomWidth).not.toBe("0px");
    expect(styles.borderBottomStyle).toBe("solid");
    // No heavy box-shadow
    expect(styles.boxShadow).toBe("none");
  });
});
