"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_SECTIONS = [
  { href: "/settings", label: "Overview" },
  { href: "/settings/workspace", label: "Workspace" },
  { href: "/settings/affiliate-profiles", label: "Akun Affiliate" },
  { href: "/settings/gemini", label: "Gemini" },
  { href: "/settings/drive", label: "Drive" },
  { href: "/settings/account", label: "Account" },
] as const;

export function SettingsSectionNav() {
  const pathname = usePathname();

  return (
    <nav className="tab-nav" aria-label="Pengaturan sections">
      {SETTINGS_SECTIONS.map((section) => {
        const isActive =
          section.href === "/settings" ? pathname === section.href : pathname === section.href || pathname.startsWith(`${section.href}/`);

        return (
          <Link className="tab-link" data-active={isActive ? "true" : undefined} href={section.href} key={section.href}>
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
