"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/intake", label: "Intake" },
  { href: "/products", label: "Products" },
  { href: "/prompts", label: "Prompts" },
  { href: "/outputs", label: "Outputs" },
  { href: "/settings", label: "Settings" },
];

const desktopNavItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/intake", label: "Intake" },
  { href: "/products", label: "Products" },
  { href: "/prompts", label: "Prompts" },
  { href: "/outputs", label: "Outputs" },
  { href: "/flow", label: "Flow" },
  { href: "/settings", label: "Settings" },
];

const routeTitles = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/intake", label: "Intake" },
  { href: "/products", label: "Products" },
  { href: "/prompts", label: "Prompts" },
  { href: "/outputs", label: "Outputs" },
  { href: "/flow", label: "Flow" },
  { href: "/settings", label: "Settings" },
  { href: "/gemini", label: "Gemini settings" },
  { href: "/drive", label: "Drive settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");
  const activeTitle =
    routeTitles.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "Operator";

  function isActive(href: string) {
    if (href === "/settings" && (pathname.startsWith("/gemini") || pathname.startsWith("/drive"))) {
      return true;
    }

    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  if (isPublicRoute) {
    return (
      <div className="public-shell">
        <main className="public-main">{children}</main>
      </div>
    );
  }

  return (
    <div className="operator-shell">
      <aside className="sidebar" aria-label="Operator navigation">
        <Link className="sidebar-brand" href="/dashboard">
          <span className="sidebar-brand__mark">AI</span>
          <span>
            <strong>Operator</strong>
            <small>Content OS</small>
          </span>
        </Link>
        <nav className="sidebar-nav">
          {desktopNavItems.map((item) => (
            <Link
              aria-current={isActive(item.href) ? "page" : undefined}
              className="nav-link sidebar-link"
              data-active={isActive(item.href) ? "true" : undefined}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="operator-workspace">
        <header className="operator-topbar">
          <div>
            <p className="eyebrow">Private operator tool</p>
            <h1>{activeTitle}</h1>
          </div>
          <Link className="button compact" href="/settings">
            Settings
          </Link>
        </header>
        <main className="shell-main">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Mobile operator navigation">
        {mobileNavItems.map((item) => (
          <Link
            aria-current={isActive(item.href) ? "page" : undefined}
            className="bottom-nav__link"
            data-active={isActive(item.href) ? "true" : undefined}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
