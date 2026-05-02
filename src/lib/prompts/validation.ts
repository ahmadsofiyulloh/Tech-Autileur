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
export const PROMPT_PACK_OUTPUT_KEYS = [
  "product_analysis",
  "prompt_context",
  "i2i_prompts",
  "i2v_prompts",
  "caption_rules",
  "hashtag_rules",
  "negative_prompt_rules",
  "consistency_rules",
  "seed_character",
  "environment",
] as const;

export type PromptPackStatus = (typeof PROMPT_PACK_STATUSES)[number];

export function isPromptPackStatus(value: string): value is PromptPackStatus {
  return (PROMPT_PACK_STATUSES as readonly string[]).includes(value);
}

export function normalizePromptCode(value: string) {
  return value.trim();
}
