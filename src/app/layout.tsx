import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { getWorkspaceShellState } from "@/lib/server/workspaces";
import "./globals.css";

export const metadata: Metadata = {
  title: "Affiliate AI Content OS",
  description: "Mobile-first control center for AI affiliate content production.",
  manifest: "/manifest.webmanifest",
  icons: [{ rel: "icon", url: "/icon.svg", type: "image/svg+xml" }],
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const workspaceState = await getWorkspaceShellState();

  return (
    <html lang="en">
      <body>
        <AppShell workspaceState={workspaceState}>{children}</AppShell>
      </body>
    </html>
  );
}
