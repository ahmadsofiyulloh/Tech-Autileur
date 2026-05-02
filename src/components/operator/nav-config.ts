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
  { href: "/products", label: "Products", icon: Package },
  { href: "/controller", label: "Controller", icon: Workflow },
  { href: "/settings", label: "Settings", icon: Settings },
] satisfies OperatorNavItem[];

export const desktopNavItems = [
  ...mobileNavItems,
] satisfies OperatorNavItem[];

export const routeTitles = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/controller", label: "Controller", icon: Workflow },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/gemini", label: "Gemini", icon: KeyRound },
  { href: "/drive", label: "Drive", icon: HardDrive },
  { href: "/intake", label: "Products", icon: Package },
  { href: "/flow", label: "Controller", icon: Workflow },
  { href: "/prompts", label: "Prompts", icon: FileText },
  { href: "/outputs", label: "Outputs", icon: FileText },
] satisfies OperatorNavItem[];
