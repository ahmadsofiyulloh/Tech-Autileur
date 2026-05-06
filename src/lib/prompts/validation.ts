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

export const PROMPT_READY_FOR_FLOW_STATUS = "APPROVED" as const;
export const PROMPT_TARGET_MARKETPLACE = "Shopee + TikTok" as const;

export const PROMPT_CLIP_KEYS = ["clip_1", "clip_2"] as const;

export const PROMPT_CLIP_LABELS = {
  clip_1: "Prompt Clip 1",
  clip_2: "Prompt Clip 2",
} as const satisfies Record<(typeof PROMPT_CLIP_KEYS)[number], string>;

export const PROMPT_I2I_SLOT_KEYS = PROMPT_CLIP_KEYS;
export const PROMPT_I2V_SLOT_KEYS = PROMPT_CLIP_KEYS;

export const PROMPT_PACK_OUTPUT_KEYS = [
  "product_analysis",
  "prompt_context",
  "i2i_prompts",
  "i2v_prompts",
  "caption",
  "tags",
  "target_marketplace",
  "negative_prompt_rules",
  "consistency_rules",
  "seed_character",
  "environment",
] as const;

export const PROMPT_PACK_COMPACT_OUTPUT_KEYS = [
  "product_analysis",
  "i2i_prompts",
  "i2v_prompts",
  "caption",
  "tags",
  "negative_prompt_rules",
  "consistency_rules",
] as const;

export type PromptPackStatus = (typeof PROMPT_PACK_STATUSES)[number];
export type PromptClipKey = (typeof PROMPT_CLIP_KEYS)[number];

export function isPromptPackStatus(value: string): value is PromptPackStatus {
  return (PROMPT_PACK_STATUSES as readonly string[]).includes(value);
}

export function isPromptClipKey(value: string): value is PromptClipKey {
  return (PROMPT_CLIP_KEYS as readonly string[]).includes(value);
}

export function normalizePromptCode(value: string) {
  return value.trim();
}

export function normalizeHashtagString(value: string) {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^#+/, ""))
    .filter(Boolean)
    .map((item) => `#${item}`)
    .join(" ");
}
