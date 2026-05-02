"use client";

import { Settings, Workflow } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { desktopNavItems, mobileNavItems, routeTitles } from "@/components/operator/nav-config";
import { RouteToaster } from "@/components/operator/route-toaster";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");
  const activeTitle =
    routeTitles.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "Operator";

  function isActive(href: string) {
    if (href === "/settings" && (pathname.startsWith("/gemini") || pathname.startsWith("/drive"))) {
      return true;
    }

    if (href === "/products" && pathname.startsWith("/intake")) {
      return true;
    }

    if (href === "/controller" && pathname.startsWith("/flow")) {
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
        <Suspense fallback={null}>
          <RouteToaster />
        </Suspense>
        <main className="public-main">{children}</main>
      </div>
    );
  }

  return (
    <div className="operator-shell">
      <aside className="sidebar" aria-label="Operator navigation">
        <Link className="sidebar-brand" href="/dashboard">
          <span className="sidebar-brand__mark" aria-hidden="true">
            <Workflow size={18} />
          </span>
          <span>
            <strong>Operator</strong>
            <small>Content OS</small>
          </span>
        </Link>
        <nav className="sidebar-nav">
          {desktopNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                aria-current={isActive(item.href) ? "page" : undefined}
                className="nav-link sidebar-link"
                data-active={isActive(item.href) ? "true" : undefined}
                href={item.href}
                key={item.href}
              >
                <Icon className="nav-link__icon" aria-hidden="true" size={17} />
                <span className="nav-link__label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="operator-workspace">
        <header className="operator-topbar">
          <div>
            <p className="eyebrow">Private tool</p>
            <h1>{activeTitle}</h1>
          </div>
          <div className="topbar-tools">
            <label className="workspace-selector" htmlFor="workspace-selector">
              <span>Workspace/profile</span>
              <select id="workspace-selector" defaultValue="default" aria-label="Current workspace/profile placeholder">
                <option value="default">Default workspace/profile</option>
              </select>
            </label>
            <Link className="topbar-action" href="/settings" aria-label="Open settings">
              <Settings aria-hidden="true" size={18} />
              <span>Settings</span>
            </Link>
          </div>
        </header>
        <main className="shell-main">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Mobile operator navigation">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              aria-current={isActive(item.href) ? "page" : undefined}
              className="bottom-nav__link"
              data-active={isActive(item.href) ? "true" : undefined}
              href={item.href}
              key={item.href}
            >
              <Icon className="bottom-nav__icon" aria-hidden="true" size={19} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <Suspense fallback={null}>
        <RouteToaster />
      </Suspense>
    </div>
  );
}
