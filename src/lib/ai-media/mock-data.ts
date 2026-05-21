import type { LucideIcon } from "lucide-react";
import { BarChart3, Clapperboard, Clock, Film, ImageUp, Settings } from "lucide-react";

// --- Tool Cards (static config for overview grid) ---

export type AiMediaToolCard = {
  id: string;
  title: string;
  label: string;
  href: string;
  visualSrc: string;
  icon: LucideIcon;
  status: string;
  statusTone: "success" | "info" | "warning" | "neutral" | "danger";
};

export const mockToolCards: AiMediaToolCard[] = [
  { id: "motion-control", title: "Motion Control", label: "Reference motion.", href: "/tools/ai-media/motion-control", visualSrc: "/ai-media/tool-cards/motion-control.webp", icon: Clapperboard, status: "Ready", statusTone: "success" },
  { id: "image-to-video", title: "Image to Video", label: "Gambar ke video.", href: "/tools/ai-media/image-to-video", visualSrc: "/ai-media/tool-cards/image-to-video.webp", icon: Film, status: "Ready", statusTone: "success" },
  { id: "upscaler", title: "Upscaler", label: "Tingkatkan resolusi.", href: "/tools/ai-media/upscaler", visualSrc: "/ai-media/tool-cards/upscaler.webp", icon: ImageUp, status: "Ready", statusTone: "success" },
  { id: "history", title: "History", label: "Riwayat proses.", href: "/tools/ai-media/history", visualSrc: "/ai-media/tool-cards/history.webp", icon: Clock, status: "3 task", statusTone: "info" },
  { id: "usage", title: "Usage", label: "Pemakaian hari ini.", href: "/tools/ai-media/usage", visualSrc: "/ai-media/tool-cards/usage.webp", icon: BarChart3, status: "Normal", statusTone: "neutral" },
  { id: "settings", title: "Settings", label: "Kunci provider.", href: "/settings/magnific", visualSrc: "/ai-media/tool-cards/settings.webp", icon: Settings, status: "2 aktif", statusTone: "success" },
];

// --- Log Entry Type (shared by log panel/terminal) ---

export type AiMediaLogEntry = {
  id: string;
  time: string;
  message: string;
  level: "info" | "warn" | "error" | "success";
};
