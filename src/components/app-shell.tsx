"use client";

import { Settings, Workflow } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { setCurrentWorkspaceFromShell } from "@/app/settings/actions";
import { desktopNavItems, mobileNavItems, routeTitles } from "@/components/operator/nav-config";
import { RouteToaster } from "@/components/operator/route-toaster";

type AppShellWorkspaceState = {
  schemaReady: boolean;
  errorMessage: string | null;
  workspaces: Array<{
    id: string;
    workspace_code: string;
    workspace_name: string;
    is_default: boolean;
  }>;
  currentWorkspaceId: string | null;
};

const emptyWorkspaceState: AppShellWorkspaceState = {
  schemaReady: true,
  errorMessage: null,
  workspaces: [],
  currentWorkspaceId: null,
};

export function AppShell({
  children,
  workspaceState = emptyWorkspaceState,
}: {
  children: ReactNode;
  workspaceState?: AppShellWorkspaceState;
}) {
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
            <form className="workspace-selector" action={setCurrentWorkspaceFromShell}>
              <input type="hidden" name="return_to" value={pathname} />
              <label htmlFor="workspace-selector">
                <span>Workspace/profile</span>
              </label>
              <select
                aria-label="Current workspace/profile"
                defaultValue={workspaceState.currentWorkspaceId ?? ""}
                disabled={!workspaceState.schemaReady || workspaceState.workspaces.length === 0}
                id="workspace-selector"
                name="current_workspace_id"
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
                title={workspaceState.errorMessage ?? "Current workspace/profile"}
              >
                <option value="">No workspace</option>
                {workspaceState.workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.workspace_name}
                    {workspace.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </form>
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
