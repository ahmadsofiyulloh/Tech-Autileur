import {
  Archive,
  FileText,
  FolderKanban,
  Gauge,
  HardDrive,
  History,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Package,
  Settings,
  Sparkles,
  UserRound,
  Users,
  Video,
  Wand2,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type OperatorNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  children?: OperatorNavChildItem[];
};

export type OperatorNavChildItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type OperatorRouteMeta = {
  href: string;
  label: string;
  icon: LucideIcon;
  subtitle: string;
};

export const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products/new", label: "Intake", icon: Inbox },
  { href: "/products", label: "Produk", icon: Package },
  { href: "/prompts", label: "Prompt", icon: FileText },
  { href: "/drive", label: "Drive", icon: HardDrive },
] satisfies OperatorNavItem[];

export const desktopNavItems: OperatorNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products/new", label: "Intake", icon: Inbox },
  { href: "/products", label: "Produk", icon: Package },
  { href: "/prompts", label: "Prompt", icon: FileText },
  { href: "/drive", label: "Drive", icon: HardDrive },
  {
    href: "/tools/ai-media",
    label: "AI Media Lab",
    icon: Sparkles,
    children: [
      { href: "/tools/ai-media/motion-control", label: "Motion Control", icon: Wand2 },
      { href: "/tools/ai-media/image-to-video", label: "Image to Video", icon: Video },
      { href: "/tools/ai-media/upscaler", label: "Upscaler", icon: ImageIcon },
      { href: "/tools/ai-media/history", label: "History", icon: History },
      { href: "/tools/ai-media/usage", label: "Usage", icon: Gauge },
    ],
  },
];

export const routeTitles = [
  { href: "/settings/affiliate-profiles", label: "Akun Affiliate", subtitle: "Persona dan aset workspace.", icon: Users },
  { href: "/settings/workspace", label: "Workspace", subtitle: "Ruang kerja aktif.", icon: FolderKanban },
  { href: "/settings/gemini", label: "Gemini", subtitle: "Kunci server.", icon: KeyRound },
  { href: "/settings/account", label: "Account", subtitle: "Pairing dan token.", icon: UserRound },
  { href: "/products/new", label: "Intake", subtitle: "Upload dan analisis.", icon: Inbox },
  { href: "/dashboard", label: "Dashboard", subtitle: "Pulse operasional.", icon: LayoutDashboard },
  { href: "/products", label: "Produk", subtitle: "Katalog produk.", icon: Package },
  { href: "/prompts", label: "Paket Prompt", subtitle: "Workbench prompt.", icon: FileText },
  { href: "/controller", label: "Flow Control", subtitle: "Batch execution.", icon: Workflow },
  { href: "/settings", label: "Pengaturan", subtitle: "Konfigurasi sistem.", icon: Settings },
  { href: "/settings/drive", label: "Drive", subtitle: "Koneksi Google Drive.", icon: HardDrive },
  { href: "/drive", label: "Drive", subtitle: "Aset & file.", icon: HardDrive },
  { href: "/outputs", label: "Output", subtitle: "Output tersimpan.", icon: Archive },
  { href: "/tools/ai-media", label: "AI Media Lab", subtitle: "Motion, I2V, Upscale.", icon: Sparkles },
  { href: "/tools/ai-media/motion-control", label: "Motion Control", subtitle: "AI Media Lab.", icon: Wand2 },
  { href: "/tools/ai-media/image-to-video", label: "Image to Video", subtitle: "AI Media Lab.", icon: Video },
  { href: "/tools/ai-media/upscaler", label: "Upscaler", subtitle: "AI Media Lab.", icon: ImageIcon },
  { href: "/tools/ai-media/history", label: "History", subtitle: "AI Media Lab.", icon: History },
  { href: "/tools/ai-media/usage", label: "Usage", subtitle: "AI Media Lab.", icon: Gauge },
  { href: "/settings/magnific", label: "Magnific", subtitle: "Kunci provider.", icon: KeyRound },
] satisfies OperatorRouteMeta[];
