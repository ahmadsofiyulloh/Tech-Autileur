import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

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
  viewportFit: "cover",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} ${GeistMono.variable}`} suppressHydrationWarning>
        <Script
          id="hydration-extension-attribute-cleaner"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: hydrationAttributeCleanerScript }}
        />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
