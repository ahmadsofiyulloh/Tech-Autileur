import { recoverJsonText } from "@/lib/json/recover-json";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const INTAKE_VISION_PROMPT_VERSION = "intake-vision-v2";
export const INTAKE_VISION_SCHEMA_VERSION = "2026-05-ocr-v2";

const INTAKE_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export type IntakeConfidenceLevel = (typeof INTAKE_CONFIDENCE_LEVELS)[number];

export type IntakeReviewMetadata = {
  nama_produk: string;
  keyword_cari_etalase: string;
  deskripsi_visual: string;
  use_case: string;
  pain_point: string;
  selling_angle: string;
  target_viewer: string;
};

export type IntakeOcrExtractedFields = {
  product_title: string;
  category: string;
  rating_text: string;
  sold_count_text: string;
  price_text: string;
  shop_name: string;
};

export type IntakeOcrEvidenceBlock = {
  visible_text_lines: string[];
  extracted_fields: IntakeOcrExtractedFields;
  confidence: IntakeConfidenceLevel;
  quality_flags: string[];
};

export type IntakeOcrEvidence = {
  product_image: IntakeOcrEvidenceBlock;
  shopee_screenshot: IntakeOcrEvidenceBlock;
  tiktok_screenshot: IntakeOcrEvidenceBlock;
};

export type IntakeExtractionQuality = {
  overall_confidence: IntakeConfidenceLevel;
  review_required: boolean;
  blocking_flags: string[];
  notes: string[];
};

export type IntakeVisionParseOutput = IntakeReviewMetadata & {
  schema_version: string;
  prompt_version: string;
  product_title: string;
  marketplace: string;
  category: string;
  rating_text: string;
  sold_count_text: string;
  price_text: string;
  shop_name: string;
  visible_product_attributes: string[];
  risk_notes: string[];
  confidence_notes: string[];
  ocr_evidence: IntakeOcrEvidence;
  extraction_quality: IntakeExtractionQuality;
};

const INTAKE_REVIEW_KEYS = [
  "nama_produk",
  "keyword_cari_etalase",
  "deskripsi_visual",
  "use_case",
  "pain_point",
  "selling_angle",
  "target_viewer",
] as const;

const INTAKE_VERSION_KEYS = ["schema_version", "prompt_version"] as const;

const INTAKE_COMPAT_KEYS = [
  "product_title",
  "marketplace",
  "category",
  "rating_text",
  "sold_count_text",
  "price_text",
  "shop_name",
  "visible_product_attributes",
  "risk_notes",
  "confidence_notes",
] as const;

const INTAKE_DIAGNOSTIC_KEYS = ["ocr_evidence", "extraction_quality"] as const;

const EMPTY_EXTRACTED_FIELDS: IntakeOcrExtractedFields = {
  product_title: "",
  category: "",
  rating_text: "",
  sold_count_text: "",
  price_text: "",
  shop_name: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return value;
}

function readString(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  return value.trim();
}

function splitLines(value: string) {
  return value
    .split(/\r?\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readStringArrayItem(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!isRecord(value)) {
    return "";
  }

  for (const key of ["label", "name", "value", "text", "title"] as const) {
    const candidate = value[key];

    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return "";
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => readStringArrayItem(item))
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return splitLines(value);
  }

  const singleValue = readStringArrayItem(value);
  return singleValue ? [singleValue] : [];
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readConfidence(value: unknown, fallback: IntakeConfidenceLevel = "low"): IntakeConfidenceLevel {
  const normalized = readOptionalString(value).toLowerCase();
  return (INTAKE_CONFIDENCE_LEVELS as readonly string[]).includes(normalized)
    ? (normalized as IntakeConfidenceLevel)
    : fallback;
}

function normalizeMarketplace(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const upper = trimmed.toUpperCase();

  if (upper.includes("SHOPEE") && upper.includes("TIKTOK")) {
    return "Shopee + TikTok";
  }

  if (upper.includes("TIKTOK")) {
    return "TIKTOK";
  }

  if (upper.includes("SHOPEE")) {
    return "SHOPEE";
  }

  return "";
}

function ensureExactKeys(record: Record<string, unknown>, label: string) {
  const allowed = new Set<string>([
    ...INTAKE_REVIEW_KEYS,
    ...INTAKE_VERSION_KEYS,
    ...INTAKE_COMPAT_KEYS,
    ...INTAKE_DIAGNOSTIC_KEYS,
  ]);
  const extraKeys = Object.keys(record).filter((key) => !allowed.has(key));

  if (extraKeys.length) {
    throw new Error(`${label} contains unexpected keys: ${extraKeys.join(", ")}.`);
  }
}

function readExtractedFields(value: unknown, fallback: Partial<IntakeOcrExtractedFields> = {}): IntakeOcrExtractedFields {
  const record = isRecord(value) ? value : {};

  return {
    product_title: readOptionalString(record.product_title) || fallback.product_title || "",
    category: readOptionalString(record.category) || fallback.category || "",
    rating_text: readOptionalString(record.rating_text) || fallback.rating_text || "",
    sold_count_text: readOptionalString(record.sold_count_text) || fallback.sold_count_text || "",
    price_text: readOptionalString(record.price_text) || fallback.price_text || "",
    shop_name: readOptionalString(record.shop_name) || fallback.shop_name || "",
  };
}

function buildEvidenceLines(fields: Partial<IntakeOcrExtractedFields>) {
  return [
    fields.product_title,
    fields.category,
    fields.rating_text,
    fields.sold_count_text,
    fields.price_text,
    fields.shop_name,
  ].filter((item): item is string => Boolean(item));
}

function readEvidenceBlock(value: unknown, fallback: Partial<IntakeOcrEvidenceBlock> = {}): IntakeOcrEvidenceBlock {
  const record = isRecord(value) ? value : {};
  const extractedFields = readExtractedFields(record.extracted_fields, fallback.extracted_fields);
  const visibleTextLines = readStringArray(record.visible_text_lines);
  const qualityFlags = readStringArray(record.quality_flags);

  return {
    visible_text_lines: visibleTextLines.length ? visibleTextLines : fallback.visible_text_lines ?? buildEvidenceLines(extractedFields),
    extracted_fields: extractedFields,
    confidence: readConfidence(record.confidence, fallback.confidence ?? "low"),
    quality_flags: qualityFlags.length ? qualityFlags : fallback.quality_flags ?? [],
  };
}

function buildLegacyOcrEvidence(output: {
  product_title: string;
  category: string;
  rating_text: string;
  sold_count_text: string;
  price_text: string;
  shop_name: string;
  visible_product_attributes: string[];
}): IntakeOcrEvidence {
  const marketplaceFields = {
    product_title: output.product_title,
    category: output.category,
    rating_text: output.rating_text,
    sold_count_text: output.sold_count_text,
    price_text: output.price_text,
    shop_name: output.shop_name,
  };

  return {
    product_image: readEvidenceBlock(null, {
      visible_text_lines: output.visible_product_attributes,
      extracted_fields: {
        ...EMPTY_EXTRACTED_FIELDS,
        product_title: output.product_title,
        category: output.category,
      },
      confidence: "low",
      quality_flags: ["legacy_ocr_contract"],
    }),
    shopee_screenshot: readEvidenceBlock(null, {
      extracted_fields: marketplaceFields,
      confidence: "low",
      quality_flags: ["legacy_ocr_contract"],
    }),
    tiktok_screenshot: readEvidenceBlock(null, {
      extracted_fields: marketplaceFields,
      confidence: "low",
      quality_flags: ["legacy_ocr_contract"],
    }),
  };
}

function readOcrEvidence(value: unknown, fallback: IntakeOcrEvidence): IntakeOcrEvidence {
  const record = isRecord(value) ? value : {};

  return {
    product_image: readEvidenceBlock(record.product_image, fallback.product_image),
    shopee_screenshot: readEvidenceBlock(record.shopee_screenshot, fallback.shopee_screenshot),
    tiktok_screenshot: readEvidenceBlock(record.tiktok_screenshot, fallback.tiktok_screenshot),
  };
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readExtractionQuality(value: unknown, fallback: IntakeExtractionQuality): IntakeExtractionQuality {
  const record = isRecord(value) ? value : {};
  const blockingFlags = readStringArray(record.blocking_flags);
  const notes = readStringArray(record.notes);

  return {
    overall_confidence: readConfidence(record.overall_confidence, fallback.overall_confidence),
    review_required: readBoolean(record.review_required, fallback.review_required),
    blocking_flags: blockingFlags.length ? blockingFlags : fallback.blocking_flags,
    notes: notes.length ? notes : fallback.notes,
  };
}

function hasUsefulOcrEvidence(output: IntakeVisionParseOutput) {
  return [
    output.ocr_evidence.product_image,
    output.ocr_evidence.shopee_screenshot,
    output.ocr_evidence.tiktok_screenshot,
  ].some((evidence) => evidence.visible_text_lines.length || Object.values(evidence.extracted_fields).some(Boolean));
}

function hasUsefulContent(output: IntakeVisionParseOutput) {
  return Boolean(
    output.nama_produk ||
      output.keyword_cari_etalase ||
      output.deskripsi_visual ||
      output.use_case ||
      output.pain_point ||
      output.selling_angle ||
      output.target_viewer ||
      output.product_title ||
      output.marketplace ||
      output.category ||
      output.rating_text ||
      output.sold_count_text ||
      output.price_text ||
      output.shop_name ||
      output.visible_product_attributes.length ||
      output.risk_notes.length ||
      hasUsefulOcrEvidence(output),
  );
}

export function appendUniqueNote(notes: string[], note: string) {
  const trimmed = note.trim();

  if (!trimmed) {
    return notes;
  }

  return notes.includes(trimmed) ? notes : [...notes, trimmed];
}

export function normalizeIntakeVisionOutput(value: unknown): IntakeVisionParseOutput {
  const record = requireRecord(value, "Intake vision output");
  ensureExactKeys(record, "Intake vision output");

  const review: IntakeReviewMetadata = {
    nama_produk: readString(record.nama_produk, "nama_produk"),
    keyword_cari_etalase: readString(record.keyword_cari_etalase, "keyword_cari_etalase"),
    deskripsi_visual: readString(record.deskripsi_visual, "deskripsi_visual"),
    use_case: readString(record.use_case, "use_case"),
    pain_point: readString(record.pain_point, "pain_point"),
    selling_angle: readString(record.selling_angle, "selling_angle"),
    target_viewer: readString(record.target_viewer, "target_viewer"),
  };

  const productTitle = readOptionalString(record.product_title) || review.nama_produk || review.keyword_cari_etalase;
  const marketplace = normalizeMarketplace(readOptionalString(record.marketplace));
  const category = readOptionalString(record.category) || review.keyword_cari_etalase;
  const ratingText = readOptionalString(record.rating_text);
  const soldCountText = readOptionalString(record.sold_count_text);
  const priceText = readOptionalString(record.price_text);
  const shopName = readOptionalString(record.shop_name);
  const visibleProductAttributes = readStringArray(record.visible_product_attributes);
  const riskNotes = readStringArray(record.risk_notes);
  const confidenceNotes = readStringArray(record.confidence_notes);
  const legacyEvidence = buildLegacyOcrEvidence({
    product_title: productTitle,
    category,
    rating_text: ratingText,
    sold_count_text: soldCountText,
    price_text: priceText,
    shop_name: shopName,
    visible_product_attributes: visibleProductAttributes,
  });
  const ocrEvidence = readOcrEvidence(record.ocr_evidence, legacyEvidence);
  const extractionQuality = readExtractionQuality(record.extraction_quality, {
    overall_confidence: record.ocr_evidence ? "medium" : "low",
    review_required: true,
    blocking_flags: record.ocr_evidence ? [] : ["legacy_ocr_contract"],
    notes: record.ocr_evidence ? [] : ["Legacy OCR payload has no diagnostic evidence."],
  });

  const output: IntakeVisionParseOutput = {
    ...review,
    schema_version: readOptionalString(record.schema_version) || INTAKE_VISION_SCHEMA_VERSION,
    prompt_version: readOptionalString(record.prompt_version) || INTAKE_VISION_PROMPT_VERSION,
    product_title: productTitle,
    marketplace,
    category,
    rating_text: ratingText,
    sold_count_text: soldCountText,
    price_text: priceText,
    shop_name: shopName,
    visible_product_attributes: visibleProductAttributes,
    risk_notes: riskNotes,
    confidence_notes: confidenceNotes,
    ocr_evidence: ocrEvidence,
    extraction_quality: extractionQuality,
  };

  if (!hasUsefulContent(output)) {
    throw new Error("Gemini output did not contain usable intake metadata.");
  }

  return output;
}

export function parseIntakeVisionOutput(rawText: string) {
  const jsonText = recoverJsonText(rawText);
  const parsed: unknown = JSON.parse(jsonText);
  return normalizeIntakeVisionOutput(parsed);
}

export type { JsonValue };
