// Share platform constants and metadata

export const SHARE_PLATFORMS = ["facebook", "threads", "x", "pinterest"] as const;

export type SharePlatform = (typeof SHARE_PLATFORMS)[number];

export function isSharePlatform(value: unknown): value is SharePlatform {
  return typeof value === "string" && SHARE_PLATFORMS.includes(value as SharePlatform);
}

export const SHARE_PLATFORM_LABELS: Record<SharePlatform, string> = {
  facebook: "Facebook",
  threads: "Threads",
  x: "X",
  pinterest: "Pinterest",
};

export const SHARE_PLATFORM_ICONS: Record<SharePlatform, string> = {
  facebook: "/share-platform-facebook.svg",
  threads: "/share-platform-threads.svg",
  x: "/share-platform-x.svg",
  pinterest: "/share-platform-pinterest.svg",
};

export const SHARE_ANGLES = [
  "benefit_focused",
  "problem_solution",
  "social_proof",
  "urgency_scarcity",
  "educational",
  "storytelling",
] as const;

export type ShareAngle = (typeof SHARE_ANGLES)[number];

export function isShareAngle(value: unknown): value is ShareAngle {
  return typeof value === "string" && SHARE_ANGLES.includes(value as ShareAngle);
}

export const SHARE_ANGLE_LABELS: Record<ShareAngle, string> = {
  benefit_focused: "Fokus Manfaat",
  problem_solution: "Solusi Masalah",
  social_proof: "Bukti Sosial",
  urgency_scarcity: "Urgensi & Kelangkaan",
  educational: "Edukatif",
  storytelling: "Cerita",
};

export const SHARE_VARIANT_COUNT_MIN = 1;
export const SHARE_VARIANT_COUNT_MAX = 4;

export function normalizeShareVariantCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isInteger(parsed)) {
    return SHARE_VARIANT_COUNT_MIN;
  }

  return Math.min(Math.max(parsed, SHARE_VARIANT_COUNT_MIN), SHARE_VARIANT_COUNT_MAX);
}
