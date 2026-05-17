import "server-only";

import {
  INTAKE_VISION_PROMPT_VERSION,
  INTAKE_VISION_SCHEMA_VERSION,
  normalizeIntakeVisionOutput,
  type IntakeOcrEvidenceBlock,
  type IntakeVisionParseOutput,
} from "@/lib/intake/vision-contract";
import { type JsonRecord, type MarketplacePlatform, normalizeIntakeText, readIntakeText } from "@/lib/intake/validation";

type IntakeMetadataSession = {
  id: string;
  product_title: string | null;
  shopee_url: string | null;
  tiktok_url: string | null;
  parsed_metadata_json: JsonRecord | null;
  reviewed_metadata_json: JsonRecord | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readJsonRecord(value: unknown) {
  return isRecord(value) ? (value as JsonRecord) : null;
}

function splitLines(value: string) {
  return value
    .split(/\r?\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readTextArray(value: unknown) {
  return readStringArrayLike(value);
}

function readStringArrayItem(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "";
  }

  const record = value as Record<string, unknown>;

  for (const key of ["label", "name", "value", "text", "title"] as const) {
    const candidate = record[key];

    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return "";
}

function readStringArrayLike(value: unknown) {
  if (!Array.isArray(value)) {
    if (typeof value === "string") {
      return splitLines(value);
    }

    const singleValue = readStringArrayItem(value);
    return singleValue ? [singleValue] : [];
  }

  return value
    .map((item) => readStringArrayItem(item))
    .filter((item) => item.length > 0);
}

export function buildReviewedMetadataFromInput(metadata: JsonRecord, fallback?: JsonRecord | null) {
  const source = (fallback ?? {}) as JsonRecord;
  const ocrEvidence = readJsonRecord(metadata.ocr_evidence) ?? readJsonRecord(source.ocr_evidence);
  const extractionQuality = readJsonRecord(metadata.extraction_quality) ?? readJsonRecord(source.extraction_quality);

  return normalizeIntakeVisionOutput({
    schema_version: readJsonText(metadata.schema_version) || readJsonText(source.schema_version) || INTAKE_VISION_SCHEMA_VERSION,
    prompt_version: readJsonText(metadata.prompt_version) || readJsonText(source.prompt_version) || INTAKE_VISION_PROMPT_VERSION,
    nama_produk:
      readJsonText(metadata.nama_produk) ||
      readJsonText(metadata.product_title) ||
      readJsonText(source.nama_produk) ||
      readJsonText(source.product_title),
    keyword_cari_etalase:
      readJsonText(metadata.keyword_cari_etalase) ||
      readJsonText(metadata.category) ||
      readJsonText(source.keyword_cari_etalase) ||
      readJsonText(source.category),
    deskripsi_visual: readJsonText(metadata.deskripsi_visual) || readJsonText(source.deskripsi_visual),
    use_case: readJsonText(metadata.use_case) || readJsonText(source.use_case),
    pain_point: readJsonText(metadata.pain_point) || readJsonText(source.pain_point),
    selling_angle: readJsonText(metadata.selling_angle) || readJsonText(source.selling_angle),
    target_viewer: readJsonText(metadata.target_viewer) || readJsonText(source.target_viewer),
    product_title: readJsonText(metadata.product_title) || readJsonText(source.product_title),
    marketplace: readJsonText(metadata.marketplace) || readJsonText(source.marketplace),
    category: readJsonText(metadata.category) || readJsonText(source.category),
    rating_text: readJsonText(metadata.rating_text) || readJsonText(source.rating_text),
    sold_count_text: readJsonText(metadata.sold_count_text) || readJsonText(source.sold_count_text),
    price_text: readJsonText(metadata.price_text) || readJsonText(source.price_text),
    shop_name: readJsonText(metadata.shop_name) || readJsonText(source.shop_name),
    visible_product_attributes: readTextArray(metadata.visible_product_attributes).length
      ? readTextArray(metadata.visible_product_attributes)
      : readTextArray(source.visible_product_attributes),
    risk_notes: readTextArray(metadata.risk_notes).length ? readTextArray(metadata.risk_notes) : readTextArray(source.risk_notes),
    confidence_notes: readTextArray(metadata.confidence_notes).length
      ? readTextArray(metadata.confidence_notes)
      : readTextArray(source.confidence_notes),
    ...(ocrEvidence ? { ocr_evidence: ocrEvidence } : {}),
    ...(extractionQuality ? { extraction_quality: extractionQuality } : {}),
  });
}

export function toReviewedMetadataJson(metadata: IntakeVisionParseOutput) {
  return {
    ...metadata,
  } as JsonRecord;
}

export function hasSourceMarketplace(value: string) {
  return value === "SHOPEE" || value === "TIKTOK";
}

export function metadataFromSession(session: IntakeMetadataSession) {
  return buildReviewedMetadataFromInput((session.reviewed_metadata_json ?? session.parsed_metadata_json ?? {}) as JsonRecord);
}

export function productMarketplaceFromIntake(session: IntakeMetadataSession, metadata: IntakeVisionParseOutput) {
  if (hasSourceMarketplace(metadata.marketplace)) {
    return metadata.marketplace;
  }

  if (session.shopee_url && session.tiktok_url) {
    return "SHOPEE + TIKTOK";
  }

  if (session.shopee_url) {
    return "SHOPEE";
  }

  if (session.tiktok_url) {
    return "TIKTOK";
  }

  return "SHOPEE + TIKTOK";
}

export function productNicheFromMetadata(metadata: IntakeVisionParseOutput, fallback?: string | null) {
  return normalizeIntakeText(fallback) ?? normalizeIntakeText(metadata.category) ?? normalizeIntakeText(metadata.keyword_cari_etalase);
}

export function buildIntakeProductTitle(metadata: IntakeVisionParseOutput) {
  return readIntakeText(metadata.nama_produk) || readIntakeText(metadata.keyword_cari_etalase) || "Intake Tanpa Nama";
}

export function buildIntakeDraftProductTitle(file: File) {
  const baseName = (typeof file.name === "string" ? file.name.trim() : "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

  return baseName || "Draf Produk";
}

export function manualMetadata(platform: string, session: Pick<IntakeMetadataSession, "id">): JsonRecord {
  return {
    entry_mode: "manual",
    platform,
    intake_session_id: session.id,
  };
}

export function sourceMarketplacesFromMetadata(metadata: IntakeVisionParseOutput): MarketplacePlatform[] {
  if (metadata.marketplace === "Shopee + TikTok") {
    return ["SHOPEE", "TIKTOK"];
  }

  return hasSourceMarketplace(metadata.marketplace) ? [metadata.marketplace] : [];
}

function ocrEvidenceForPlatform(metadata: IntakeVisionParseOutput, platform: MarketplacePlatform): IntakeOcrEvidenceBlock {
  return platform === "SHOPEE" ? metadata.ocr_evidence.shopee_screenshot : metadata.ocr_evidence.tiktok_screenshot;
}

export function marketplaceSourceFieldsForPlatform(
  platform: MarketplacePlatform,
  metadata: IntakeVisionParseOutput,
  fallbackTitle: string,
) {
  const extracted = ocrEvidenceForPlatform(metadata, platform).extracted_fields;

  return {
    title: readIntakeText(extracted.product_title) || metadata.product_title || metadata.nama_produk || fallbackTitle,
    category: readIntakeText(extracted.category) || metadata.category,
    rating_text: readIntakeText(extracted.rating_text) || metadata.rating_text,
    sold_count_text: readIntakeText(extracted.sold_count_text) || metadata.sold_count_text,
    price_text: readIntakeText(extracted.price_text) || metadata.price_text,
    shop_name: readIntakeText(extracted.shop_name) || metadata.shop_name,
  };
}

export function visionMarketplaceMetadata(
  platform: MarketplacePlatform,
  session: Pick<IntakeMetadataSession, "id">,
  metadata: IntakeVisionParseOutput,
) {
  const evidence = platform === "SHOPEE" ? metadata.ocr_evidence.shopee_screenshot : metadata.ocr_evidence.tiktok_screenshot;

  return {
    entry_mode: "gemini_vision",
    platform,
    intake_session_id: session.id,
    schema_version: metadata.schema_version,
    prompt_version: metadata.prompt_version,
    ocr_evidence: evidence,
    extraction_quality: metadata.extraction_quality,
    reviewed_metadata: toReviewedMetadataJson(metadata),
  } satisfies JsonRecord;
}
