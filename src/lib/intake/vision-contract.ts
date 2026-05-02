type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type IntakeVisionParseOutput = {
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

const INTAKE_VISION_KEYS = [
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

function requireString(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  return value.trim();
}

function requireStringArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value
    .map((item, index) => requireString(item, `${label}[${index}]`))
    .filter((item) => item.length > 0);
}

function normalizeMarketplace(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const upper = trimmed.toUpperCase();

  if (upper.includes("SHOPEE")) {
    return "SHOPEE";
  }

  if (upper.includes("TIKTOK")) {
    return "TIKTOK";
  }

  return "";
}

function ensureExactKeys(record: Record<string, unknown>, label: string) {
  const allowed = new Set<string>(INTAKE_VISION_KEYS);
  const extraKeys = Object.keys(record).filter((key) => !allowed.has(key));

  if (extraKeys.length) {
    throw new Error(`${label} contains unexpected keys: ${extraKeys.join(", ")}.`);
  }
}

function hasUsefulContent(output: IntakeVisionParseOutput) {
  return Boolean(
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

  const output: IntakeVisionParseOutput = {
    product_title: requireString(record.product_title, "product_title"),
    marketplace: normalizeMarketplace(requireString(record.marketplace, "marketplace")),
    category: requireString(record.category, "category"),
    rating_text: requireString(record.rating_text, "rating_text"),
    sold_count_text: requireString(record.sold_count_text, "sold_count_text"),
    price_text: requireString(record.price_text, "price_text"),
    shop_name: requireString(record.shop_name, "shop_name"),
    visible_product_attributes: requireStringArray(
      record.visible_product_attributes,
      "visible_product_attributes",
    ),
    risk_notes: requireStringArray(record.risk_notes, "risk_notes"),
    confidence_notes: requireStringArray(record.confidence_notes, "confidence_notes"),
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
