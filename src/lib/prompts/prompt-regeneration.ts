export const REGENERATION_SCOPES = [
  {
    key: "full_pack",
    label: "Full Pack",
    description: "Buat ulang seluruh paket prompt.",
    generationInstruction:
      "Regenerate the full prompt pack while preserving product facts, grounding, affiliate profile, and content variant. Return a complete valid prompt pack.",
  },
  {
    key: "stronger_hook",
    label: "Hook Lebih Kuat",
    description: "Perkuat hook 0-2 detik.",
    generationInstruction:
      "Improve the first 0-2 second attention hook and VO while keeping all product facts grounded and avoiding hype claims. Return a complete valid prompt pack.",
  },
  {
    key: "voiceover_only",
    label: "VO Saja",
    description: "Fokus VO dan audio cues.",
    generationInstruction:
      "Focus on voiceover text and audio cues, keep the visual concept stable, and still return a complete valid prompt pack.",
  },
  {
    key: "i2v_motion_only",
    label: "Motion I2V",
    description: "Fokus motion, kamera, timeline.",
    generationInstruction:
      "Focus on motion, camera, and timeline quality while keeping copy mostly stable and preserving first-frame-only I2V output. Return a complete valid prompt pack.",
  },
  {
    key: "caption_tags_only",
    label: "Caption+Tags",
    description: "Fokus copy Shopee.",
    generationInstruction:
      "Focus on Shopee caption and tags, keep visual and VO mostly stable, and keep combined caption plus tags within 150 characters. Return a complete valid prompt pack.",
  },
  {
    key: "grounding_fix",
    label: "Fix Grounding",
    description: "Bersihkan klaim tidak valid.",
    generationInstruction:
      "Remove unsupported claims and rebuild copy only from grounded metadata, marketplace source data, product title, and visual facts. Return a complete valid prompt pack.",
  },
] as const;

export type RegenerationScopeKey = (typeof REGENERATION_SCOPES)[number]["key"];

const REGENERATION_SCOPE_MAP = new Map(REGENERATION_SCOPES.map((scope) => [scope.key, scope]));

export function isRegenerationScopeKey(value: string): value is RegenerationScopeKey {
  return REGENERATION_SCOPE_MAP.has(value as RegenerationScopeKey);
}

export function getRegenerationScope(value: string | null | undefined) {
  return isRegenerationScopeKey(value ?? "")
    ? REGENERATION_SCOPE_MAP.get(value as RegenerationScopeKey)!
    : REGENERATION_SCOPE_MAP.get("full_pack")!;
}
