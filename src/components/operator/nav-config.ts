import {
  Archive,
  FileText,
  FolderKanban,
  HardDrive,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Package,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type OperatorNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type OperatorRouteMeta = OperatorNavItem & {
  subtitle: string;
};

export const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products/new", label: "Intake", icon: Inbox },
  { href: "/products", label: "Produk", icon: Package },
  { href: "/prompts", label: "Prompt", icon: FileText },
  { href: "/drive", label: "Drive", icon: HardDrive },
] satisfies OperatorNavItem[];

export const desktopNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products/new", label: "Intake", icon: Inbox },
  { href: "/products", label: "Produk", icon: Package },
  { href: "/prompts", label: "Prompt", icon: FileText },
  { href: "/drive", label: "Drive", icon: HardDrive },
] satisfies OperatorNavItem[];

export const routeTitles = [
  { href: "/settings/affiliate-profiles", label: "Akun Affiliate", subtitle: "Persona dan aset workspace.", icon: Users },
  { href: "/settings/workspace", label: "Workspace", subtitle: "Ruang kerja aktif.", icon: FolderKanban },
  { href: "/settings/gemini", label: "Gemini", subtitle: "Kunci server.", icon: KeyRound },
  { href: "/settings/account", label: "Account", subtitle: "Pairing dan token.", icon: UserRound },
  { href: "/products/new", label: "Intake", subtitle: "Upload dan analisis.", icon: Inbox },
  { href: "/dashboard", label: "Dashboard", subtitle: "Metrik operasional.", icon: LayoutDashboard },
  { href: "/products", label: "Produk", subtitle: "List per workspace.", icon: Package },
  { href: "/prompts", label: "Paket Prompt", subtitle: "Editor prompt.", icon: FileText },
  { href: "/settings", label: "Pengaturan", subtitle: "Hub konfigurasi.", icon: Settings },
  { href: "/drive", label: "Drive", subtitle: "Folder aset.", icon: HardDrive },
  { href: "/intake", label: "Intake", subtitle: "Upload dan analisis.", icon: Inbox },
  { href: "/outputs", label: "Output", subtitle: "Output tersimpan.", icon: Archive },
] satisfies OperatorRouteMeta[];
