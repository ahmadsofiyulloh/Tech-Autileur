export const VIDEO_MODEL_OPTIONS = [
  { key: "veo-3.1", label: "Veo 3.1", description: "Google Veo 3.1 I2V" },
  { key: "veo-2.0", label: "Veo 2.0", description: "Google Veo 2.0 (legacy)" },
] as const;

export type VideoModelKey = (typeof VIDEO_MODEL_OPTIONS)[number]["key"];

export const DEFAULT_VIDEO_MODEL: VideoModelKey = "veo-3.1";

export function isVideoModelKey(value: unknown): value is VideoModelKey {
  return (
    typeof value === "string" &&
    VIDEO_MODEL_OPTIONS.some((option) => option.key === value)
  );
}

export function resolveVideoModel(value: unknown): VideoModelKey {
  return isVideoModelKey(value) ? value : DEFAULT_VIDEO_MODEL;
}
