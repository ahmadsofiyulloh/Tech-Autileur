import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="shell-header">
        <div className="brand-block">
          <div>
            <p className="eyebrow">Affiliate AI Content OS</p>
            <h1 className="brand-title">Sprint 0 foundation</h1>
          </div>
          <span className="status-pill">Next.js PWA shell</span>
        </div>
        <nav aria-label="Primary" className="nav-row">
          {navItems.map((item) => (
            <Link className="nav-link" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="shell-main">{children}</main>
      <footer className="shell-footer">
        <span>Single-owner MVP control center</span>
        <span>Foundation only, no product workflows yet</span>
      </footer>
    </div>
  );
}
