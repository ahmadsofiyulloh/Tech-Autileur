import {
  FileText,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  Package,
  Settings,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type OperatorNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Produk", icon: Package },
  { href: "/prompts", label: "Prompt", icon: FileText },
  { href: "/settings", label: "Pengaturan", icon: Settings },
] satisfies OperatorNavItem[];

export const desktopNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Produk", icon: Package },
  { href: "/prompts", label: "Prompt", icon: FileText },
  { href: "/controller", label: "Flow Control", icon: Workflow },
  { href: "/settings", label: "Pengaturan", icon: Settings },
] satisfies OperatorNavItem[];

export const routeTitles = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Produk", icon: Package },
  { href: "/prompts", label: "Prompt", icon: FileText },
  { href: "/controller", label: "Flow Control", icon: Workflow },
  { href: "/settings", label: "Pengaturan", icon: Settings },
  { href: "/gemini", label: "Gemini", icon: KeyRound },
  { href: "/drive", label: "Google Drive", icon: HardDrive },
  { href: "/intake", label: "Produk", icon: Package },
  { href: "/flow", label: "Flow Control", icon: Workflow },
  { href: "/outputs", label: "Output", icon: FileText },
] satisfies OperatorNavItem[];
