import {
  Archive,
  FileText,
  HardDrive,
  Inbox,
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
  { href: "/intake", label: "Intake", icon: Inbox },
  { href: "/products", label: "Products", icon: Package },
  { href: "/prompts", label: "Prompts", icon: FileText },
  { href: "/outputs", label: "Outputs", icon: Archive },
] satisfies OperatorNavItem[];

export const desktopNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ...mobileNavItems,
  { href: "/flow", label: "Flow", icon: Workflow },
  { href: "/settings", label: "Settings", icon: Settings },
] satisfies OperatorNavItem[];

export const routeTitles = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/intake", label: "Intake", icon: Inbox },
  { href: "/products", label: "Products", icon: Package },
  { href: "/prompts", label: "Prompts", icon: FileText },
  { href: "/outputs", label: "Outputs", icon: Archive },
  { href: "/flow", label: "Flow", icon: Workflow },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/gemini", label: "Gemini", icon: KeyRound },
  { href: "/drive", label: "Drive", icon: HardDrive },
] satisfies OperatorNavItem[];
