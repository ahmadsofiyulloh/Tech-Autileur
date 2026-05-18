export const PROMPT_METADATA_REQUIRED_FIELDS = [
  "nama_produk",
  "keyword_cari_etalase",
  "deskripsi_visual",
  "use_case",
  "pain_point",
  "selling_angle",
  "target_viewer",
] as const;

export type PromptMetadataRequiredField = (typeof PROMPT_METADATA_REQUIRED_FIELDS)[number];

export const PROMPT_METADATA_REQUIRED_FIELD_LABELS = {
  nama_produk: "Nama Produk",
  keyword_cari_etalase: "Keyword Cari Etalase",
  deskripsi_visual: "Deskripsi Visual",
  use_case: "Use Case",
  pain_point: "Pain Point",
  selling_angle: "Selling Angle",
  target_viewer: "Target Viewer",
} as const satisfies Record<PromptMetadataRequiredField, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readPromptMetadataText(value: unknown, key: PromptMetadataRequiredField) {
  if (!isRecord(value)) {
    return "";
  }

  const fieldValue = value[key];
  return typeof fieldValue === "string" ? fieldValue.trim() : "";
}

export function getMissingPromptMetadataFields(value: unknown) {
  return PROMPT_METADATA_REQUIRED_FIELDS.filter((field) => !readPromptMetadataText(value, field));
}

export function getMissingPromptMetadataFieldLabels(value: unknown) {
  return getMissingPromptMetadataFields(value).map((field) => PROMPT_METADATA_REQUIRED_FIELD_LABELS[field]);
}

export function isPromptMetadataComplete(value: unknown) {
  return getMissingPromptMetadataFields(value).length === 0;
}

export function buildPromptMetadataIncompleteMessage(value: unknown) {
  const missingLabels = getMissingPromptMetadataFieldLabels(value);

  if (!missingLabels.length) {
    return "";
  }

  return `Prompt Essentials belum lengkap: ${missingLabels.join(", ")}.`;
}

export function assertPromptMetadataComplete(value: unknown) {
  const message = buildPromptMetadataIncompleteMessage(value);

  if (message) {
    throw new Error(message);
  }
}
