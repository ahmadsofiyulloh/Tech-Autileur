"use client";

import { Settings, Workflow } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { desktopNavItems, mobileNavItems, routeTitles } from "@/components/operator/nav-config";
import { RouteToaster } from "@/components/operator/route-toaster";
import { TopbarProvider, useTopbar } from "@/components/operator/topbar-context";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");

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
    <TopbarProvider>
      <OperatorShellContent>{children}</OperatorShellContent>
    </TopbarProvider>
  );
}

function OperatorShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeRoute =
    routeTitles
      .slice()
      .sort((left, right) => right.href.length - left.href.length)
      .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? null;
  const { override } = useTopbar();
  const activeTitle = override?.title ?? activeRoute?.label ?? "Operator";
  const activeSubtitle = override?.subtitle ?? activeRoute?.subtitle ?? "Content OS.";
  const ActiveIcon = activeRoute?.icon ?? Workflow;
  const showSettingsGear = !pathname.startsWith("/settings");

  function isActive(href: string) {
    if (href === "/products/new" && pathname.startsWith("/intake")) {
      return true;
    }

    if (href === "/products" && (pathname.startsWith("/intake") || pathname.startsWith("/products/new"))) {
      return false;
    }

    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="operator-shell">
      <aside className="sidebar" aria-label="Operator navigation">
        <Link className="sidebar-brand" href="/products/new">
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
          <div className="topbar-title">
            <span className="icon-frame topbar-title__icon" aria-hidden="true">
              <ActiveIcon size={18} />
            </span>
            <div className="topbar-title__copy">
              <h1>{activeTitle}</h1>
              {activeSubtitle ? <p>{activeSubtitle}</p> : null}
            </div>
          </div>
          <div className="topbar-tools">
            {showSettingsGear ? (
              <Link className="topbar-action topbar-settings-link" href="/settings" aria-label="Pengaturan">
                <Settings size={18} aria-hidden="true" />
                <span>Pengaturan</span>
              </Link>
            ) : null}
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
