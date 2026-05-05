type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type IntakeReviewMetadata = {
  nama_produk: string;
  keyword_cari_etalase: string;
  deskripsi_visual: string;
  use_case: string;
  pain_point: string;
  selling_angle: string;
  target_viewer: string;
};

export type IntakeVisionParseOutput = IntakeReviewMetadata & {
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
  const allowed = new Set<string>([...INTAKE_REVIEW_KEYS, ...INTAKE_COMPAT_KEYS]);
  const extraKeys = Object.keys(record).filter((key) => !allowed.has(key));

  if (extraKeys.length) {
    throw new Error(`${label} contains unexpected keys: ${extraKeys.join(", ")}.`);
  }
}

function buildVisibleFallback(review: IntakeReviewMetadata) {
  return [
    review.deskripsi_visual,
    review.use_case,
    review.pain_point,
    review.selling_angle,
    review.target_viewer,
  ].filter((item) => item.length > 0);
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
      output.risk_notes.length,
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

  const output: IntakeVisionParseOutput = {
    ...review,
    product_title: productTitle,
    marketplace,
    category,
    rating_text: ratingText,
    sold_count_text: soldCountText,
    price_text: priceText,
    shop_name: shopName,
    visible_product_attributes: visibleProductAttributes.length ? visibleProductAttributes : buildVisibleFallback(review),
    risk_notes: riskNotes,
    confidence_notes: confidenceNotes.length
      ? confidenceNotes
      : ["Analisis Gemini live dari bytes upload."],
  };

  if (!hasUsefulContent(output)) {
    throw new Error("Gemini output did not contain usable intake metadata.");
  }

  return output;
}

function extractJsonText(rawText: string) {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error("Gemini output was empty.");
  }

  if (trimmed.startsWith("```")) {
    const firstNewLine = trimmed.indexOf("\n");
    const lastFence = trimmed.lastIndexOf("```");

    if (firstNewLine >= 0 && lastFence > firstNewLine) {
      const inner = trimmed.slice(firstNewLine + 1, lastFence).trim();

      if (inner) {
        return inner;
      }
    }
  }

  return trimmed;
}

function recoverJsonText(rawText: string) {
  const initial = extractJsonText(rawText);

  try {
    JSON.parse(initial);
    return initial;
  } catch {
    const firstBrace = initial.indexOf("{");
    const lastBrace = initial.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = initial.slice(firstBrace, lastBrace + 1).trim();

      if (sliced) {
        JSON.parse(sliced);
        return sliced;
      }
    }
  }

  throw new Error("Gemini output did not contain valid JSON.");
}

export function parseIntakeVisionOutput(rawText: string) {
  const jsonText = recoverJsonText(rawText);
  const parsed: unknown = JSON.parse(jsonText);
  return normalizeIntakeVisionOutput(parsed);
}

export type { JsonValue };
