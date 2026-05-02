"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/login", label: "Login" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/gemini", label: "Gemini" },
  { href: "/drive", label: "Drive" },
  { href: "/products", label: "Products" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="app-shell">
      <header className="shell-header">
        <div className="brand-block">
          <div>
            <p className="eyebrow">Affiliate AI Content OS</p>
            <h1 className="brand-title">Operator dashboard</h1>
          </div>
          <span className="status-pill">Single-owner control plane</span>
        </div>
        <nav aria-label="Primary" className="nav-row">
          {navItems.map((item) => (
            <Link
              aria-current={isActive(item.href) ? "page" : undefined}
              className="nav-link"
              data-active={isActive(item.href) ? "true" : undefined}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="shell-main">{children}</main>
      <footer className="shell-footer">
        <span>Single-owner MVP control center</span>
        <span>Auth, Gemini, Drive, and product metadata foundations</span>
      </footer>
    </div>
  );
}
