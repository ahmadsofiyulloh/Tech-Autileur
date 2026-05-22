export const VO_LENGTH_PRESETS = [
  {
    key: "short",
    label: "Pendek",
    description: "Hook singkat (maks 60 karakter)",
    maxChars: 60,
  },
  {
    key: "medium",
    label: "Sedang",
    description: "Hook standar (maks 120 karakter)",
    maxChars: 120,
  },
  {
    key: "long",
    label: "Panjang",
    description: "Hook detail (maks 200 karakter)",
    maxChars: 200,
  },
] as const;

export type VoLengthPresetKey = (typeof VO_LENGTH_PRESETS)[number]["key"];

export const DEFAULT_VO_LENGTH_PRESET: VoLengthPresetKey = "medium";

export const DEFAULT_VO_MAX_CHARS = 120 as const;

export function isVoLengthPresetKey(value: unknown): value is VoLengthPresetKey {
  return (
    typeof value === "string" &&
    VO_LENGTH_PRESETS.some((preset) => preset.key === value)
  );
}

export function resolveVoLengthPreset(value: unknown): VoLengthPresetKey {
  return isVoLengthPresetKey(value) ? value : DEFAULT_VO_LENGTH_PRESET;
}

export function resolveVoMaxChars(preset?: VoLengthPresetKey | string | null): number {
  if (!preset) return DEFAULT_VO_MAX_CHARS;
  return (
    VO_LENGTH_PRESETS.find((entry) => entry.key === preset)?.maxChars ??
    DEFAULT_VO_MAX_CHARS
  );
}
