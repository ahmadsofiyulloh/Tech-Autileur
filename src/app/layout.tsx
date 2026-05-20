import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers.js";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { getOperatorShellContext } from "@/lib/server/operator-shell";
import {
  DEFAULT_RESOLVED_THEME,
  THEME_COOKIE_NAME,
  type ResolvedTheme,
  readThemePreference,
  resolveThemePreference,
} from "@/lib/theme-preference";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Affiliate AI Content OS",
  title: "Affiliate AI Content OS",
  description: "Mobile-first control center for AI affiliate content production.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AICOS",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/app-icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#070809" },
  ],
  maximumScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  userScalable: false,
};

const hydrationAttributeCleanerScript = String.raw`
(() => {
  const blockedAttributeNames = new Set(["bis_skin_checked", "bis_register"]);
  const processedAttributePattern = /^__processed_[\w-]+__$/;

  function isBlockedAttribute(name) {
    return blockedAttributeNames.has(name) || processedAttributePattern.test(name);
  }

  function cleanElement(element) {
    if (!element || !element.attributes) {
      return;
    }

    for (const attribute of Array.from(element.attributes)) {
      if (isBlockedAttribute(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  function cleanTree(root) {
    if (!root) {
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
      cleanElement(root);
    }

    if (typeof root.querySelectorAll !== "function") {
      return;
    }

    for (const element of root.querySelectorAll("*")) {
      cleanElement(element);
    }
  }

  cleanTree(document.documentElement);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.target instanceof Element) {
        if (isBlockedAttribute(mutation.attributeName || "")) {
          cleanElement(mutation.target);
        }
        continue;
      }

      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          cleanTree(node);
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  window.setTimeout(() => observer.disconnect(), 15000);
})();
`;

const themePreferenceScript = String.raw`
(() => {
  const themePreferenceValues = new Set(["light", "dark", "system"]);
  const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function readPreference() {
    const fromDataset = document.documentElement.dataset.themeMode;
    if (themePreferenceValues.has(fromDataset)) {
      return fromDataset;
    }

    return "light";
  }

  function resolvePreference(preference) {
    if (preference === "system") {
      return systemQuery.matches ? "dark" : "light";
    }

    return preference === "dark" ? "dark" : "light";
  }

  function updateThemeColor() {
    const themeColor = window.getComputedStyle(document.documentElement).getPropertyValue("--color-shell-canvas").trim();
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');

    if (themeColor && themeColorMeta) {
      themeColorMeta.setAttribute("content", themeColor);
    }
  }

  function applyPreference() {
    const preference = readPreference();
    document.documentElement.dataset.themeMode = preference;
    document.documentElement.dataset.theme = resolvePreference(preference);
    requestAnimationFrame(updateThemeColor);
  }

  applyPreference();
  systemQuery.addEventListener("change", applyPreference);
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const [cookieStore, shellContext] = await Promise.all([cookies(), getOperatorShellContext()]);
  const themePreference = readThemePreference(cookieStore.get(THEME_COOKIE_NAME)?.value);
  const initialResolvedTheme: ResolvedTheme = resolveThemePreference(themePreference, DEFAULT_RESOLVED_THEME);

  return (
    <html
      lang="id"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      data-theme={initialResolvedTheme}
      data-theme-mode={themePreference}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Script
          id="theme-preference"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themePreferenceScript }}
        />
        <Script
          id="hydration-extension-attribute-cleaner"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: hydrationAttributeCleanerScript }}
        />
        <AppShell shellContext={shellContext} themePreference={themePreference}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
