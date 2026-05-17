import "server-only";

import {
  buildIntakeTelemetryPayload,
  classifyIntakeAnalysisPath,
  classifyIntakeEvidenceOrigin,
  normalizeIntakeClientContext,
  type IntakeClientContextInput,
  type IntakeTelemetryPayload,
} from "@/lib/intake/analysis-telemetry";
import {
  INTAKE_VISION_PROMPT_VERSION,
  INTAKE_VISION_SCHEMA_VERSION,
  appendUniqueNote,
  type IntakeOcrEvidenceBlock,
  type IntakeVisionParseOutput,
} from "@/lib/intake/vision-contract";
import type { JsonRecord } from "@/lib/intake/validation";

export const INTAKE_VISION_SYSTEM_INSTRUCTION = [
  "You are an OCR-first product evidence extractor for a private affiliate content workflow.",
  "Never invent marketplace facts. Literal OCR fields must be copied exactly from visible image text.",
  "Separate literal OCR evidence from inferred Indonesian operator metadata.",
  "Use empty strings and quality flags when evidence is missing, blurry, cropped, rotated, or unreadable.",
  "Return only JSON matching the response schema.",
].join("\n");

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildIntakeParsePrompt(input: {
  productImage: { name: string; mimeType: string; size: number };
  shopeeScreenshot: { name: string; mimeType: string; size: number } | null;
  tiktokScreenshot: { name: string; mimeType: string; size: number } | null;
}) {
  const imageOrder = [
    "1. product_image",
    input.shopeeScreenshot ? "2. shopee_screenshot" : null,
    input.tiktokScreenshot ? `${input.shopeeScreenshot ? "3" : "2"}. tiktok_screenshot` : null,
  ].filter((value): value is string => Boolean(value));
  const uploadedEvidence = {
    product_image: input.productImage,
    shopee_screenshot: input.shopeeScreenshot ?? { missing: true },
    tiktok_screenshot: input.tiktokScreenshot ?? { missing: true },
  };
  const marketplaceRule =
    input.shopeeScreenshot && input.tiktokScreenshot
      ? '- Set marketplace to "Shopee + TikTok" when both marketplace screenshots are present, even if one has weaker OCR.'
      : input.shopeeScreenshot
        ? '- Set marketplace to "SHOPEE" because only Shopee screenshot evidence is present.'
        : '- Set marketplace to "TIKTOK" because only TikTok screenshot evidence is present.';

  return [
    "Task: extract OCR evidence and prompt-ready product metadata from the uploaded bytes.",
    `schema_version must be "${INTAKE_VISION_SCHEMA_VERSION}".`,
    `prompt_version must be "${INTAKE_VISION_PROMPT_VERSION}".`,
    "",
    "Image order:",
    ...imageOrder,
    "",
    "Literal OCR rules:",
    "- Copy visible marketplace text exactly for title, category, rating, sold count, price, and shop/account name.",
    "- Do not translate, normalize currency, round ratings, or rewrite sold count abbreviations in literal fields.",
    "- If text is unreadable or absent, use an empty string and add a quality flag.",
    "- visible_text_lines should contain concise exact text lines seen in each image.",
    '- For a missing marketplace screenshot, return an empty OCR evidence block for that platform and add the quality flag "missing_source_image".',
    "",
    "Inference rules:",
    "- Use short operator-friendly Indonesian for nama_produk, keyword_cari_etalase, deskripsi_visual, use_case, pain_point, selling_angle, and target_viewer.",
    marketplaceRule,
    "- Set extraction_quality.review_required to true when any key marketplace field is unreadable, cropped, blurry, or inferred.",
    "- Do not claim visual parsing from links.",
    "- Return JSON only. No markdown, code fences, or commentary.",
    "",
    "Uploaded evidence:",
    JSON.stringify(
      uploadedEvidence,
      null,
      2,
    ),
  ].join("\n");
}

function missingMarketplaceOcrEvidenceBlock(): IntakeOcrEvidenceBlock {
  return {
    visible_text_lines: [],
    extracted_fields: {
      product_title: "",
      category: "",
      rating_text: "",
      sold_count_text: "",
      price_text: "",
      shop_name: "",
    },
    confidence: "low",
    quality_flags: ["missing_source_image"],
  };
}

function appendUniqueValues(values: string[], additions: string[]) {
  return [...new Set([...values, ...additions].map((value) => value.trim()).filter(Boolean))];
}

export function applyMarketplaceEvidenceAvailability(
  metadata: IntakeVisionParseOutput,
  availability: { shopee: boolean; tiktok: boolean },
): IntakeVisionParseOutput {
  const missingFlags = [
    availability.shopee ? null : "missing_shopee_screenshot",
    availability.tiktok ? null : "missing_tiktok_screenshot",
  ].filter((value): value is string => Boolean(value));
  const marketplace =
    availability.shopee && availability.tiktok ? metadata.marketplace || "Shopee + TikTok" : availability.shopee ? "SHOPEE" : "TIKTOK";
  let confidenceNotes = metadata.confidence_notes;

  if (!availability.shopee) {
    confidenceNotes = appendUniqueNote(confidenceNotes, "Screenshot Shopee tidak tersedia saat analisis.");
  }

  if (!availability.tiktok) {
    confidenceNotes = appendUniqueNote(confidenceNotes, "Screenshot TikTok tidak tersedia saat analisis.");
  }

  return {
    ...metadata,
    marketplace,
    confidence_notes: confidenceNotes,
    ocr_evidence: {
      ...metadata.ocr_evidence,
      shopee_screenshot: availability.shopee ? metadata.ocr_evidence.shopee_screenshot : missingMarketplaceOcrEvidenceBlock(),
      tiktok_screenshot: availability.tiktok ? metadata.ocr_evidence.tiktok_screenshot : missingMarketplaceOcrEvidenceBlock(),
    },
    extraction_quality: {
      ...metadata.extraction_quality,
      review_required: metadata.extraction_quality.review_required || missingFlags.length > 0,
      blocking_flags: appendUniqueValues(metadata.extraction_quality.blocking_flags, missingFlags),
      notes: appendUniqueValues(
        metadata.extraction_quality.notes,
        missingFlags.length ? ["Analisis memakai satu screenshot marketplace."] : [],
      ),
    },
  };
}

export function summarizeIntakeVisionResponseText(value: string | null | undefined, maxLength = 320) {
  const trimmed = readText(value);

  if (!trimmed) {
    return "";
  }

  const singleLine = trimmed.replace(/\s+/g, " ");

  if (singleLine.length <= maxLength) {
    return singleLine;
  }

  return `${singleLine.slice(0, maxLength).trimEnd()}...`;
}

export function buildIntakeVisionTaskDiagnostics(input: {
  repairAttempted: boolean;
  responseText: string;
  repairResponseText?: string | null;
  modelName?: string | null;
}) {
  return {
    pipeline: "intake_vision",
    analysis_mode: "LIVE_IMAGE_BYTES",
    repair_attempted: input.repairAttempted,
    model_name: input.modelName ?? null,
    response_text: input.responseText,
    response_text_excerpt: summarizeIntakeVisionResponseText(input.responseText),
    repair_response_text: input.repairResponseText ?? null,
    repair_response_text_excerpt: summarizeIntakeVisionResponseText(input.repairResponseText ?? null),
  } satisfies JsonRecord;
}

export function buildIntakeVisionFailureMessage(
  errorMessage: string,
  diagnostics?: {
    responseText?: string | null;
    repairAttempted?: boolean;
    repairResponseText?: string | null;
  },
) {
  const parts = [errorMessage.trim()];

  const primaryExcerpt = summarizeIntakeVisionResponseText(diagnostics?.responseText ?? null);
  if (primaryExcerpt) {
    parts.push(`Primary excerpt: ${primaryExcerpt}`);
  }

  const repairExcerpt = summarizeIntakeVisionResponseText(diagnostics?.repairResponseText ?? null);
  if (diagnostics?.repairAttempted && repairExcerpt) {
    parts.push(`Repair excerpt: ${repairExcerpt}`);
  }

  return parts.join(" | ");
}

export function buildParsedMetadataTaskSnapshot(
  metadata: IntakeVisionParseOutput,
  selectedModelName?: string | null,
  telemetry?: IntakeTelemetryPayload | null,
  diagnostics?: JsonRecord,
) {
  return {
    pipeline: "intake_vision",
    schema_version: metadata.schema_version,
    prompt_version: metadata.prompt_version,
    analysis_mode: "LIVE_IMAGE_BYTES",
    image_bytes_available: true,
    selected_model_name: selectedModelName ?? null,
    nama_produk: metadata.nama_produk,
    keyword_cari_etalase: metadata.keyword_cari_etalase,
    deskripsi_visual: metadata.deskripsi_visual,
    use_case: metadata.use_case,
    pain_point: metadata.pain_point,
    selling_angle: metadata.selling_angle,
    target_viewer: metadata.target_viewer,
    product_title: metadata.product_title,
    marketplace: metadata.marketplace,
    category: metadata.category,
    rating_text: metadata.rating_text,
    sold_count_text: metadata.sold_count_text,
    price_text: metadata.price_text,
    shop_name: metadata.shop_name,
    visible_product_attributes: metadata.visible_product_attributes,
    risk_notes: metadata.risk_notes,
    confidence_notes: metadata.confidence_notes,
    ocr_evidence: metadata.ocr_evidence,
    extraction_quality: metadata.extraction_quality,
    ...(telemetry ? { telemetry } : {}),
    ...(diagnostics ? { diagnostics } : {}),
  } satisfies JsonRecord;
}

export function buildIntakeTaskInput(input: {
  productImage: { name: string; mimeType: string; size: number };
  shopeeScreenshot: { name: string; mimeType: string; size: number };
  tiktokScreenshot: { name: string; mimeType: string; size: number };
  clientContext?: IntakeClientContextInput | null;
  analysisPath: "saved_capture" | "live_upload";
  freshEvidenceCount: number;
  savedEvidenceCount: number;
  clientUploadBytes: number;
  totalUploadBytes: number;
  maxFileBytes: number;
  requestStartedAt: string;
}) {
  return {
    pipeline: "intake_vision",
    analysis_mode: "LIVE_IMAGE_BYTES",
    image_bytes_available: true,
    schema_version: INTAKE_VISION_SCHEMA_VERSION,
    prompt_version: INTAKE_VISION_PROMPT_VERSION,
    analysis_path: classifyIntakeAnalysisPath(input.analysisPath),
    evidence_origin: classifyIntakeEvidenceOrigin({
      freshEvidenceCount: input.freshEvidenceCount,
      savedEvidenceCount: input.savedEvidenceCount,
    }),
    client_context: input.clientContext ? normalizeIntakeClientContext(input.clientContext) : normalizeIntakeClientContext(null),
    telemetry: buildIntakeTelemetryPayload({
      clientContext: input.clientContext ?? null,
      analysisPath: input.analysisPath,
      freshEvidenceCount: input.freshEvidenceCount,
      savedEvidenceCount: input.savedEvidenceCount,
      clientUploadBytes: input.clientUploadBytes,
      totalUploadBytes: input.totalUploadBytes,
      maxFileBytes: input.maxFileBytes,
      requestStartedAt: input.requestStartedAt,
      repairAttempted: false,
      repairSuccess: false,
      failureKind: null,
    }),
    product_image: input.productImage,
    shopee_screenshot: input.shopeeScreenshot,
    tiktok_screenshot: input.tiktokScreenshot,
  } satisfies JsonRecord;
}

export function buildUploadedImageSummary(file: File) {
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

export function buildMissingImageSummary(name: string) {
  return {
    name,
    mimeType: "application/octet-stream",
    size: 0,
  };
}

export function assertHasMarketplaceScreenshot(input: { shopeeScreenshot?: unknown; tiktokScreenshot?: unknown }) {
  if (!input.shopeeScreenshot && !input.tiktokScreenshot) {
    throw new Error("Tambahkan minimal satu screenshot Shopee atau TikTok.");
  }
}
