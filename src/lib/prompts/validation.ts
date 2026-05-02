export const PROMPT_PACK_STATUSES = [
  "DRAFT",
  "QUEUED",
  "GENERATING",
  "GENERATED",
  "NEEDS_REVIEW",
  "APPROVED",
  "ARCHIVED",
  "ERROR",
] as const;

export const PROMPT_I2I_SLOT_KEYS = [
  "clip_01_start_frame",
  "clip_01_last_frame",
  "clip_02_start_frame",
  "clip_02_last_frame",
] as const;

export const PROMPT_I2V_SLOT_KEYS = ["clip_01", "clip_02"] as const;

export type PromptPackStatus = (typeof PROMPT_PACK_STATUSES)[number];

export function isPromptPackStatus(value: string): value is PromptPackStatus {
  return (PROMPT_PACK_STATUSES as readonly string[]).includes(value);
}

export function normalizePromptCode(value: string) {
  return value.trim();
}

