"use client";

import { ChevronDown, LockKeyhole, PanelLeftClose, PanelLeftOpen, Workflow } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BulkImportJobRunner } from "@/components/operator/bulk-import-job-runner";
import { FeedbackDock } from "@/components/operator/feedback-dock";
import type { OperatorShellContext } from "@/components/operator/operator-shell-context";
import { desktopNavItems, mobileNavItems, routeTitles } from "@/components/operator/nav-config";
import { ShellPullToRefresh } from "@/components/operator/shell-pull-to-refresh";
import { TopbarProvider, useTopbar } from "@/components/operator/topbar-context";
import { TopbarGlobalControls } from "@/components/operator/topbar-global-controls";
import type { ThemePreference } from "@/lib/theme-preference";

export function AppShell({
  children,
  shellContext,
  themePreference,
}: {
  children: ReactNode;
  shellContext: OperatorShellContext;
  themePreference: ThemePreference;
}) {
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
      <OperatorShellContent shellContext={shellContext} themePreference={themePreference}>
        {children}
      </OperatorShellContent>
    </TopbarProvider>
  );
}

function OperatorShellContent({
  children,
  shellContext,
  themePreference,
}: {
  children: ReactNode;
  shellContext: OperatorShellContext;
  themePreference: ThemePreference;
}) {
  const pathname = usePathname();
  const shellMainRef = useRef<HTMLElement | null>(null);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem("operator-sidebar-expanded");
      const parsed: Record<string, boolean> = stored ? JSON.parse(stored) : {};
      // Auto-expand group if child is active on initial load
      for (const item of desktopNavItems) {
        if (item.children?.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`))) {
          parsed[item.href] = true;
        }
      }
      setExpandedGroups(parsed);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistExpanded = useCallback((next: Record<string, boolean>) => {
    setExpandedGroups(next);
    try { localStorage.setItem("operator-sidebar-expanded", JSON.stringify(next)); } catch {}
  }, []);
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
  const sidebarToggleLabel = isSidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar";
  const SidebarToggleIcon = isSidebarCollapsed ? PanelLeftOpen : PanelLeftClose;

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
    <div className="operator-shell operator-shell--dense" data-sidebar-collapsed={isSidebarCollapsed ? "true" : undefined}>
      <aside className="sidebar sidebar--dense" aria-label="Operator navigation" data-collapsed={isSidebarCollapsed ? "true" : undefined}>
        <div className="sidebar-header">
          <Link className="sidebar-brand sidebar-brand--dense" href="/dashboard">
            <span className="sidebar-brand__mark" aria-hidden="true">
              <LockKeyhole size={16} />
            </span>
            <span className="sidebar-brand__copy">
              Affiliate <strong>AI</strong>
            </span>
          </Link>
        </div>
        <nav className="sidebar-nav sidebar-nav--dense">
          {desktopNavItems.map((item) => {
            const Icon = item.icon;
            const parentActive = isActive(item.href);
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = hasChildren ? (expandedGroups[item.href] ?? parentActive) : false;

            return (
              <div className="sidebar-nav__group" key={item.href} data-has-children={hasChildren ? "true" : undefined}>
                <div className="sidebar-nav__group-row">
                  <Link
                    aria-current={parentActive ? "page" : undefined}
                    className="nav-link sidebar-link sidebar-link--dense"
                    data-active={parentActive ? "true" : undefined}
                    href={item.href}
                  >
                    <Icon className="nav-link__icon" aria-hidden="true" size={17} />
                    <span className="nav-link__label-group">
                      <span className="nav-link__label">{item.label}</span>
                      {item.badge ? <span className="nav-link__badge">{item.badge}</span> : null}
                    </span>
                  </Link>
                  {hasChildren ? (
                    <button
                      type="button"
                      className="sidebar-nav__group-toggle"
                      data-expanded={isExpanded ? "true" : "false"}
                      aria-label={isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                      onClick={() => persistExpanded({ ...expandedGroups, [item.href]: !isExpanded })}
                    >
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                {hasChildren ? (
                  <div className="sidebar-nav__children" data-collapsed={isExpanded ? "false" : "true"} aria-label={`${item.label} sub-navigation`}>
                    {item.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = isActive(child.href);

                      return (
                        <Link
                          aria-current={childActive ? "page" : undefined}
                          className="nav-link sidebar-link sidebar-link--dense sidebar-link--child"
                          data-active={childActive ? "true" : undefined}
                          href={child.href}
                          key={child.href}
                        >
                          <ChildIcon className="nav-link__icon" aria-hidden="true" size={15} />
                          <span className="nav-link__label-group">
                            <span className="nav-link__label">{child.label}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button
            aria-label={sidebarToggleLabel}
            aria-pressed={isSidebarCollapsed}
            className="sidebar-toggle sidebar-toggle--dense"
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
        <header className="operator-topbar operator-topbar--dense">
          <div className="topbar-title topbar-title--dense">
            <span className="icon-frame topbar-title__icon" aria-hidden="true">
              <ActiveIcon size={18} />
            </span>
            <div className="topbar-title__copy">
              <h1>{activeTitle}</h1>
              {activeSubtitle ? <p>{activeSubtitle}</p> : null}
            </div>
          </div>
          <div className="topbar-tools topbar-tools--dense">
            <TopbarGlobalControls
              currentAffiliateProfile={currentAffiliateProfile}
              hideSettingsAction={override?.hideSettingsLink ?? false}
              themePreference={themePreference}
            />
          </div>
        </header>
        <ShellPullToRefresh scrollContainerRef={shellMainRef} />
        <main className="shell-main" ref={shellMainRef}>
          {children}
        </main>
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
      <FeedbackDock />
      <BulkImportJobRunner />
    </div>
  );
}
