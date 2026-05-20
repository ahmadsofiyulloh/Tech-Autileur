import type { LucideIcon } from "lucide-react";
import { BarChart3, Clapperboard, Clock, Film, ImageUp, Settings } from "lucide-react";

// --- Shared Option Type ---

export type AiMediaSelectOption = {
  id: string;
  label: string;
  description?: string;
};

// --- Provider Status ---

export type AiMediaProviderStatus = {
  provider: string;
  state: "active" | "missing" | "error";
  activeKeyCount: number;
  fallbackReady: boolean;
  requestsToday: number;
  activeTaskCount: number;
};

export const mockProviderStatus: AiMediaProviderStatus = {
  provider: "Magnific",
  state: "active",
  activeKeyCount: 2,
  fallbackReady: true,
  requestsToday: 14,
  activeTaskCount: 1,
};

// --- Tool Cards ---

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

// --- Log Entries ---

export type AiMediaLogEntry = {
  id: string;
  time: string;
  message: string;
  level: "info" | "warn" | "error" | "success";
};

export const mockLogEntries: AiMediaLogEntry[] = [
  { id: "log-1", time: "12:01:03", message: "Submit request", level: "info" },
  { id: "log-2", time: "12:01:08", message: "Error 429: rate limit", level: "error" },
  { id: "log-3", time: "12:01:09", message: "Fallback key: Backup Magnific", level: "warn" },
  { id: "log-4", time: "12:01:15", message: "Task created: abc123", level: "success" },
];

// --- Tool Options (consolidated) ---

export const mockToolOptions = {
  keys: [
    { id: "key-main", label: "Main Magnific", description: "Active" },
    { id: "key-backup", label: "Backup Magnific", description: "Fallback" },
  ] satisfies AiMediaSelectOption[],
  models: [
    { id: "magnific-v1", label: "Magnific v1", description: "Default" },
    { id: "magnific-v2", label: "Magnific v2", description: "Higher quality" },
  ] satisfies AiMediaSelectOption[],
  durations: [
    { id: "3s", label: "3 detik" },
    { id: "5s", label: "5 detik" },
    { id: "10s", label: "10 detik" },
  ] satisfies AiMediaSelectOption[],
  aspectRatios: [
    { id: "16:9", label: "16:9" },
    { id: "9:16", label: "9:16" },
    { id: "1:1", label: "1:1" },
  ] satisfies AiMediaSelectOption[],
  upscaleScales: [
    { id: "2x", label: "2x" },
    { id: "4x", label: "4x" },
  ] satisfies AiMediaSelectOption[],
  upscaleModes: [
    { id: "balanced", label: "Balanced" },
    { id: "sharp", label: "Sharp" },
  ] satisfies AiMediaSelectOption[],
};

// --- Usage Summary ---

export type AiMediaUsageSummary = {
  requestToday: number;
  success: number;
  failed: number;
  running: number;
  waitingForKey: number;
  activeKeys: number;
  rateLimitedKeys: number;
  fallbackReady: boolean;
  lastUsedLabel: string;
};

export const mockUsageSummary: AiMediaUsageSummary = {
  requestToday: 14,
  success: 10,
  failed: 2,
  running: 1,
  waitingForKey: 1,
  activeKeys: 2,
  rateLimitedKeys: 1,
  fallbackReady: true,
  lastUsedLabel: "Hari ini, 12:31",
};

// --- Key Statuses ---

export type AiMediaKeyStatus = {
  id: string;
  label: string;
  status: "ACTIVE" | "RATE_LIMITED" | "WAITING_FOR_KEY";
  requestToday: number;
  fallbackEligible: boolean;
  lastUsedLabel: string;
};

export const mockKeyStatuses: AiMediaKeyStatus[] = [
  { id: "key-main", label: "Main Magnific", status: "RATE_LIMITED", requestToday: 11, fallbackEligible: false, lastUsedLabel: "12:31" },
  { id: "key-backup", label: "Backup Magnific", status: "ACTIVE", requestToday: 3, fallbackEligible: true, lastUsedLabel: "12:28" },
];

// --- Recent Errors ---

export type AiMediaRecentError = {
  id: string;
  timeLabel: string;
  toolType: string;
  keyLabel: string;
  status: "FAILED" | "RATE_LIMITED";
  message: string;
  retryable: boolean;
};

export const mockRecentErrors: AiMediaRecentError[] = [
  { id: "err-1", timeLabel: "12:11", toolType: "Image to Video", keyLabel: "Main Magnific", status: "RATE_LIMITED", message: "Limit habis.", retryable: true },
  { id: "err-2", timeLabel: "11:58", toolType: "Motion Control", keyLabel: "Main Magnific", status: "FAILED", message: "Generate gagal.", retryable: false },
];

// --- History Tasks ---

export type AiMediaHistoryTaskStatus = "RUNNING" | "SUCCESS" | "FAILED";

export type AiMediaHistoryTask = {
  id: string;
  toolType: string;
  provider: string;
  model: string;
  status: AiMediaHistoryTaskStatus;
  createdTime: string;
  providerTaskId: string;
  selectedKey: string;
  errorSummary: string;
  logs: AiMediaLogEntry[];
};

export const mockHistoryTasks: AiMediaHistoryTask[] = [
  {
    id: "task-1",
    toolType: "Image to Video",
    provider: "Magnific",
    model: "Magnific v2",
    status: "RUNNING",
    createdTime: "Hari ini, 12:31",
    providerTaskId: "i2v-131",
    selectedKey: "Main Magnific",
    errorSummary: "Tidak ada error.",
    logs: [
      { id: "t1-1", time: "12:31:02", message: "Submit request", level: "info" },
      { id: "t1-2", time: "12:31:04", message: "Task created", level: "success" },
    ],
  },
  {
    id: "task-2",
    toolType: "Upscaler",
    provider: "Magnific",
    model: "Magnific v1",
    status: "SUCCESS",
    createdTime: "Hari ini, 12:21",
    providerTaskId: "up-041",
    selectedKey: "Backup Magnific",
    errorSummary: "Tidak ada error.",
    logs: [
      { id: "t2-1", time: "12:21:03", message: "Submit request", level: "info" },
      { id: "t2-2", time: "12:21:14", message: "Task completed", level: "success" },
    ],
  },
  {
    id: "task-3",
    toolType: "Motion Control",
    provider: "Magnific",
    model: "Magnific v1",
    status: "FAILED",
    createdTime: "Hari ini, 11:58",
    providerTaskId: "mc-019",
    selectedKey: "Main Magnific",
    errorSummary: "Generate gagal.",
    logs: [
      { id: "t3-1", time: "11:58:01", message: "Submit request", level: "info" },
      { id: "t3-2", time: "11:58:05", message: "Error 400: invalid input", level: "error" },
    ],
  },
];
