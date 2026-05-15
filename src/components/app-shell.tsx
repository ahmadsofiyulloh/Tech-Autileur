"use client";

import { PanelLeftClose, PanelLeftOpen, Settings, Workflow } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FeedbackDock } from "@/components/operator/feedback-dock";
import type { OperatorShellContext } from "@/components/operator/operator-shell-context";
import { desktopNavItems, mobileNavItems, routeTitles } from "@/components/operator/nav-config";
import { ShellPullToRefresh } from "@/components/operator/shell-pull-to-refresh";
import { TopbarProvider, useTopbar } from "@/components/operator/topbar-context";

export function AppShell({ children, shellContext }: { children: ReactNode; shellContext: OperatorShellContext }) {
  const pathname = usePathname();
  const isPublicRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");

  if (isPublicRoute) {
    return (
      <div className="public-shell">
        <FeedbackDock />
        <main className="public-main">{children}</main>
      </div>
    );
  }

  return (
    <TopbarProvider>
      <OperatorShellContent shellContext={shellContext}>{children}</OperatorShellContent>
    </TopbarProvider>
  );
}

function OperatorShellContent({ children, shellContext }: { children: ReactNode; shellContext: OperatorShellContext }) {
  const pathname = usePathname();
  const shellMainRef = useRef<HTMLElement | null>(null);
  const [profileAvatarFailed, setProfileAvatarFailed] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const activeRoute =
    routeTitles
      .slice()
      .sort((left, right) => right.href.length - left.href.length)
      .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? null;
  const { override } = useTopbar();
  const activeTitle = override?.title ?? activeRoute?.label ?? "Operator";
  const activeSubtitle = override?.subtitle ?? activeRoute?.subtitle ?? "Content OS.";
  const ActiveIcon = activeRoute?.icon ?? Workflow;
  const currentAffiliateProfile = shellContext.currentAffiliateProfile;
  const showSettingsGear = !pathname.startsWith("/settings") && !override?.hideSettingsLink;
  const showProfileAvatar = Boolean(currentAffiliateProfile?.avatarUrl) && !profileAvatarFailed;
  const mobileCenterNavItem =
    mobileNavItems.find((item) => item.href === "/products/new") ?? mobileNavItems[0] ?? null;
  const mobileSideNavItems = mobileNavItems.filter((item) => item.href !== mobileCenterNavItem?.href);
  const mobileLeftNavItems = mobileSideNavItems.slice(0, 2);
  const mobileRightNavItems = mobileSideNavItems.slice(2);
  const sidebarToggleLabel = isSidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar";
  const SidebarToggleIcon = isSidebarCollapsed ? PanelLeftOpen : PanelLeftClose;

  useEffect(() => {
    setProfileAvatarFailed(false);
  }, [currentAffiliateProfile?.avatarUrl]);

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
    <div className="operator-shell" data-sidebar-collapsed={isSidebarCollapsed ? "true" : undefined}>
      <aside className="sidebar" aria-label="Operator navigation" data-collapsed={isSidebarCollapsed ? "true" : undefined}>
        <div className="sidebar-header">
          <Link className="sidebar-brand" href="/dashboard">
            <span className="sidebar-brand__mark" aria-hidden="true">
              <Workflow size={18} />
            </span>
            <span className="sidebar-brand__copy">
              <strong>Operator</strong>
              <small>Content OS</small>
            </span>
          </Link>
        </div>
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
        <div className="sidebar-footer">
          <button
            aria-label={sidebarToggleLabel}
            aria-pressed={isSidebarCollapsed}
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((current) => !current)}
            title={sidebarToggleLabel}
            type="button"
          >
            <SidebarToggleIcon aria-hidden="true" size={17} />
            <span className="sidebar-toggle__label">{sidebarToggleLabel}</span>
          </button>
        </div>
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
              <Link
                aria-label="Pengaturan"
                className="topbar-profile-link"
                href="/settings"
                title="Pengaturan"
              >
                <span
                  className={`topbar-profile-link__avatar${showProfileAvatar ? "" : " topbar-profile-link__avatar--fallback"}`}
                  aria-hidden="true"
                >
                  {showProfileAvatar ? (
                    <img
                      alt=""
                      src={currentAffiliateProfile?.avatarUrl ?? ""}
                      onError={() => setProfileAvatarFailed(true)}
                    />
                  ) : (
                    <Settings size={18} aria-hidden="true" />
                  )}
                </span>
                <span className="topbar-profile-link__label">Pengaturan</span>
              </Link>
            ) : null}
          </div>
        </header>
        <ShellPullToRefresh scrollContainerRef={shellMainRef} />
        <main className="shell-main" ref={shellMainRef}>
          {children}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Mobile operator navigation">
        {mobileLeftNavItems.map((item) => {
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
        {mobileCenterNavItem ? (
          <Link
            aria-label={mobileCenterNavItem.label}
            aria-current={isActive(mobileCenterNavItem.href) ? "page" : undefined}
            className="bottom-nav__link bottom-nav__link--center"
            data-active={isActive(mobileCenterNavItem.href) ? "true" : undefined}
            href={mobileCenterNavItem.href}
            key={mobileCenterNavItem.href}
          >
            <span className="bottom-nav__center-iconWrap" aria-hidden="true">
              <mobileCenterNavItem.icon className="bottom-nav__icon bottom-nav__center-icon" aria-hidden="true" size={22} />
            </span>
          </Link>
        ) : null}
        {mobileRightNavItems.length === 1 ? <span className="bottom-nav__spacer" aria-hidden="true" /> : null}
        {mobileRightNavItems.map((item) => {
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
      <FeedbackDock />
    </div>
  );
}
