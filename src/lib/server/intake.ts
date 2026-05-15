import "server-only";

import { revalidatePath } from "next/cache";
import {
  createAITask,
  markTaskFailed,
  markTaskRunning,
  markTaskSuccess,
  markTaskWaitingForKey,
} from "@/lib/server/ai-task-queue";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GeminiClientError } from "@/lib/server/gemini-client";
import { getGeminiSecretRotationErrorMessage, readGeminiSecretForKey } from "@/lib/server/gemini-secret";
import { generateTrackedGeminiJsonText } from "@/lib/server/gemini-usage-events";
import {
  buildIntakeTelemetryPayload,
  classifyIntakeAnalysisPath,
  classifyIntakeEvidenceOrigin,
  classifyIntakeFailureKind,
  normalizeIntakeClientContext,
  type IntakeClientContextInput,
  type IntakeTelemetryPayload,
} from "@/lib/intake/analysis-telemetry";
import {
  INTAKE_VISION_PROMPT_VERSION,
  INTAKE_VISION_SCHEMA_VERSION,
  appendUniqueNote,
  normalizeIntakeVisionOutput,
  type IntakeOcrEvidenceBlock,
  type IntakeVisionParseOutput,
} from "@/lib/intake/vision-contract";
import { parseIntakeVisionOutputWithRepair } from "@/lib/intake/vision-repair";
import { assertUploadedImage, prepareGeminiCompatibleUploadImage } from "@/lib/intake/upload-validation";
import {
  INTAKE_STATUSES,
  type IntakeStatus,
  type JsonRecord,
  type MarketplacePlatform,
  hasMinimumIntakeInput,
  isIntakeStatus,
  normalizeIntakeText,
  readIntakeText,
} from "@/lib/intake/validation";
import { type GeminiModelName } from "@/lib/gemini/validation";
import { GEMINI_INTAKE_VISION_RESPONSE_SCHEMA } from "@/lib/gemini/json-schemas";
import {
  getGeminiQuotaGroupKey,
  listQuotaAwareGeminiKeys,
  markGeminiKeyError,
  markGeminiKeySuccess,
  markGeminiQuotaGroupError,
  markGeminiQuotaGroupCooldown,
  type GeminiRoutableKey,
} from "@/lib/server/gemini-key-routing";
import { getGeminiFailureDisposition } from "@/lib/server/gemini-failure-policy";
import {
  createDriveItem,
  getDriveItemByDriveItemId,
  getDriveItemByDrivePath,
  getDriveItemById,
  updateDriveItem,
} from "@/lib/server/drive-items";
import {
  attachProductSourceImage,
  buildProductCode,
  createProduct,
  getProductById,
  listProductImages,
  updateProduct,
} from "@/lib/server/products";
import { buildProductAnchorCode, createProductAnchor, listProductAnchors, type ProductAnchorRecord } from "@/lib/server/product-anchors";
import {
  type MarketplaceSourceInput,
  type MarketplaceSourceRecord,
  createMarketplaceSource,
  listProductMarketplaceSources,
} from "@/lib/server/product-marketplace-sources";
import { ensureGoogleDriveFolder, getGoogleDriveFileContentBytes, uploadFileToGoogleDrive } from "@/lib/server/google-drive";
import { getCurrentWorkspace, getOrProvisionWorkspaceDriveRoot } from "@/lib/server/workspaces";
import { normalizeNullableWorkspaceUuid } from "@/lib/workspaces/validation";

type ProductRecord = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  product_code: string;
  product_name: string;
  niche: string | null;
  marketplace: string | null;
  marketplace_product_link: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ProductImageRecord = {
  id: string;
  user_id: string;
  product_id: string;
  drive_item_ref_id: string;
  source_type: string;
  is_primary: boolean;
  analysis_json: JsonRecord | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type DriveItemRecord = {
  id: string;
  user_id: string;
  item_type: string;
  drive_item_id: string | null;
  parent_id: string | null;
  parent_drive_item_id: string | null;
  name: string;
  drive_url: string;
  drive_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  purpose: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type AiTaskRecord = {
  id: string;
  user_id: string;
  gemini_api_key_id: string | null;
  task_type: string;
  status: string;
  input_json: JsonRecord;
  output_json: JsonRecord | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type GeminiSelectedKey = GeminiRoutableKey;

type IntakeWorkspace = {
  product: ProductRecord | null;
  productImages: ProductImageRecord[];
  marketplaceSources: MarketplaceSourceRecord[];
  driveItems: Map<string, DriveItemRecord>;
  productPhotoDriveItem: DriveItemRecord | null;
  screenshotDriveItem: DriveItemRecord | null;
  selectedSourceImage: ProductImageRecord | null;
  selectedSourceImageDriveItem: DriveItemRecord | null;
};

export type IntakeSessionRecord = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  product_id: string | null;
  intake_code: string;
  product_title: string | null;
  shopee_url: string | null;
  tiktok_url: string | null;
  product_photo_drive_item_ref_id: string | null;
  screenshot_drive_item_ref_id: string | null;
  raw_notes: string | null;
  parsed_metadata_json: JsonRecord | null;
  reviewed_metadata_json: JsonRecord | null;
  status: IntakeStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type IntakeSessionInput = {
  workspace_id?: string | null;
  product_id?: string | null;
  intake_code?: string | null;
  product_title?: string | null;
  shopee_url?: string | null;
  tiktok_url?: string | null;
  product_photo_drive_item_ref_id?: string | null;
  screenshot_drive_item_ref_id?: string | null;
  raw_notes?: string | null;
  parsed_metadata_json?: JsonRecord | null;
  reviewed_metadata_json?: JsonRecord | null;
  status?: string;
  error_message?: string | null;
};

type ManualSourceInput = Omit<MarketplaceSourceInput, "product_id" | "platform">;
type IntakeAnalysisUploadInput = {
  productImage: File;
  shopeeScreenshot?: File | null;
  tiktokScreenshot?: File | null;
};

const INTAKE_VISION_SYSTEM_INSTRUCTION = [
  "You are an OCR-first product evidence extractor for a private affiliate content workflow.",
  "Never invent marketplace facts. Literal OCR fields must be copied exactly from visible image text.",
  "Separate literal OCR evidence from inferred Indonesian operator metadata.",
  "Use empty strings and quality flags when evidence is missing, blurry, cropped, rotated, or unreadable.",
  "Return only JSON matching the response schema.",
].join("\n");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
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

function buildReviewedMetadataFromInput(metadata: JsonRecord, fallback?: JsonRecord | null) {
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

function toReviewedMetadataJson(metadata: IntakeVisionParseOutput) {
  return {
    ...metadata,
  } as JsonRecord;
}

function hasSourceMarketplace(value: string) {
  return value === "SHOPEE" || value === "TIKTOK";
}

function safeErrorMessage(error: unknown) {
  if (error instanceof GeminiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to process intake.";
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, user };
}

async function resolveWorkspaceIdForInsert(workspaceId: string | null | undefined) {
  if (workspaceId !== undefined) {
    return normalizeNullableWorkspaceUuid(workspaceId);
  }

  const currentWorkspace = await getCurrentWorkspace();
  return currentWorkspace?.id ?? null;
}

function assertIntakeStatus(value: string): asserts value is IntakeStatus {
  if (!isIntakeStatus(value)) {
    throw new Error(`Invalid intake status. Expected one of: ${INTAKE_STATUSES.join(", ")}.`);
  }
}

function buildIntakeCode(input: IntakeSessionInput) {
  const source = readIntakeText(input.product_title) || readIntakeText(input.shopee_url) || readIntakeText(input.tiktok_url) || "INTAKE";
  const base = source.replace(/[^A-Za-z0-9]+/g, "").toUpperCase().slice(0, 8) || "INTAKE";
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);

  return `${base}-${stamp}`;
}

function buildProductCodeForIntake(productName: string, session: IntakeSessionRecord) {
  const suffix = readIntakeText(session.intake_code)
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase()
    .slice(-8);

  return suffix ? `${buildProductCode(productName)}-${suffix}` : buildProductCode(productName);
}

function productStatusFromIntake(requestedStatus?: string | null) {
  const status = readIntakeText(requestedStatus);

  if (status) {
    return status;
  }

  return "DRAFT";
}

function nextProductStatusForIntake(currentStatus: string, intakeStatus: string) {
  if (currentStatus === "DRAFT" || currentStatus === "IMAGE_ATTACHED" || currentStatus === "IMAGE_ANALYZED") {
    return intakeStatus;
  }

  return currentStatus;
}

function metadataFromSession(session: IntakeSessionRecord) {
  return buildReviewedMetadataFromInput((session.reviewed_metadata_json ?? session.parsed_metadata_json ?? {}) as JsonRecord);
}

function productMarketplaceFromIntake(session: IntakeSessionRecord, metadata: IntakeVisionParseOutput) {
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

function productNicheFromMetadata(metadata: IntakeVisionParseOutput, fallback?: string | null) {
  return normalizeIntakeText(fallback) ?? normalizeIntakeText(metadata.category) ?? normalizeIntakeText(metadata.keyword_cari_etalase);
}

async function loadIntakeSessionById(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  id: string,
) {
  const { data, error } = await supabase
    .from("product_intake_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Intake not found.");
  }

  return data as IntakeSessionRecord;
}

export async function getIntakeSessionById(id: string) {
  const { supabase, user } = await requireUser();
  return await loadIntakeSessionById(supabase, user.id, id);
}

export async function getLatestIntakeSessionForProduct(productId: string, workspaceId?: string | null) {
  const sessions = await listIntakeSessions({
    productId,
    workspaceId: workspaceId ?? undefined,
    limit: 1,
  });

  return sessions[0] ?? null;
}

function intakePayload(input: IntakeSessionInput) {
  return {
    ...(input.workspace_id !== undefined ? { workspace_id: normalizeNullableWorkspaceUuid(input.workspace_id) } : {}),
    ...(input.product_id !== undefined ? { product_id: normalizeIntakeText(input.product_id) } : {}),
    ...(input.intake_code !== undefined ? { intake_code: readIntakeText(input.intake_code) } : {}),
    ...(input.product_title !== undefined ? { product_title: normalizeIntakeText(input.product_title) } : {}),
    ...(input.shopee_url !== undefined ? { shopee_url: normalizeIntakeText(input.shopee_url) } : {}),
    ...(input.tiktok_url !== undefined ? { tiktok_url: normalizeIntakeText(input.tiktok_url) } : {}),
    ...(input.product_photo_drive_item_ref_id !== undefined
      ? { product_photo_drive_item_ref_id: normalizeIntakeText(input.product_photo_drive_item_ref_id) }
      : {}),
    ...(input.screenshot_drive_item_ref_id !== undefined
      ? { screenshot_drive_item_ref_id: normalizeIntakeText(input.screenshot_drive_item_ref_id) }
      : {}),
    ...(input.raw_notes !== undefined ? { raw_notes: normalizeIntakeText(input.raw_notes) } : {}),
    ...(input.parsed_metadata_json !== undefined ? { parsed_metadata_json: input.parsed_metadata_json } : {}),
    ...(input.reviewed_metadata_json !== undefined ? { reviewed_metadata_json: input.reviewed_metadata_json } : {}),
    ...(input.error_message !== undefined ? { error_message: normalizeIntakeText(input.error_message) } : {}),
  };
}

async function loadDriveItemsByIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  ids: string[],
) {
  const uniqueIds = [...new Set(ids.map((id) => readText(id)).filter(Boolean))];

  if (!uniqueIds.length) {
    return new Map<string, DriveItemRecord>();
  }

  const { data, error } = await supabase
    .from("drive_items")
    .select("*")
    .eq("user_id", userId)
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((item) => [item.id, item as DriveItemRecord]));
}

async function loadIntakeWorkspace(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  session: IntakeSessionRecord,
): Promise<IntakeWorkspace> {
  const [product, productImages, marketplaceSources] = await Promise.all([
    session.product_id ? getProductById(session.product_id) : Promise.resolve<ProductRecord | null>(null),
    session.product_id ? listProductImages({ productId: session.product_id, limit: 200 }) : Promise.resolve([]),
    session.product_id ? listProductMarketplaceSources({ productId: session.product_id, limit: 200 }) : Promise.resolve([]),
  ]);

  const productImageRecords = productImages as ProductImageRecord[];
  const marketplaceSourceRecords = marketplaceSources as MarketplaceSourceRecord[];

  const driveItems = await loadDriveItemsByIds(
    supabase,
    userId,
    [
      session.product_photo_drive_item_ref_id,
      session.screenshot_drive_item_ref_id,
      ...productImageRecords.map((image) => image.drive_item_ref_id),
      ...marketplaceSourceRecords
        .map((source) => source.screenshot_drive_item_ref_id)
        .filter((value): value is string => Boolean(value)),
    ].filter(Boolean) as string[],
  );

  const selectedSourceImage = productImageRecords.find((image) => image.is_primary) ?? productImageRecords[0] ?? null;
  const selectedSourceImageDriveItem = selectedSourceImage
    ? driveItems.get(selectedSourceImage.drive_item_ref_id) ?? null
    : null;

  return {
    product: product as ProductRecord | null,
    productImages: productImageRecords,
    marketplaceSources: marketplaceSourceRecords,
    driveItems,
    productPhotoDriveItem: session.product_photo_drive_item_ref_id ? driveItems.get(session.product_photo_drive_item_ref_id) ?? null : null,
    screenshotDriveItem: session.screenshot_drive_item_ref_id ? driveItems.get(session.screenshot_drive_item_ref_id) ?? null : null,
    selectedSourceImage,
    selectedSourceImageDriveItem,
  };
}

function buildDriveItemSnapshot(item: DriveItemRecord | null) {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    drive_path: item.drive_path,
    drive_url: item.drive_url,
    mime_type: item.mime_type,
    purpose: item.purpose,
    status: item.status,
    notes: item.notes,
  };
}

function buildProductImageSnapshot(image: ProductImageRecord | null, driveItem: DriveItemRecord | null) {
  if (!image) {
    return null;
  }

  return {
    id: image.id,
    drive_item_ref_id: image.drive_item_ref_id,
    source_type: image.source_type,
    is_primary: image.is_primary,
    status: image.status,
    notes: image.notes,
    analysis_json: image.analysis_json,
    drive_item: buildDriveItemSnapshot(driveItem),
  };
}

function buildMarketplaceSourceSnapshot(source: MarketplaceSourceRecord) {
  return {
    id: source.id,
    platform: source.platform,
    product_url: source.product_url,
    affiliate_url: source.affiliate_url,
    title: source.title,
    category: source.category,
    rating_text: source.rating_text,
    sold_count_text: source.sold_count_text,
    price_text: source.price_text,
    shop_name: source.shop_name,
    screenshot_drive_item_ref_id: source.screenshot_drive_item_ref_id,
    status: source.status,
    notes: source.notes,
    parsed_metadata_json: source.parsed_metadata_json,
  };
}

function buildIntakeParsePrompt(input: {
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

function applyMarketplaceEvidenceAvailability(
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

function summarizeIntakeVisionResponseText(value: string | null | undefined, maxLength = 320) {
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

function buildIntakeVisionTaskDiagnostics(input: {
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

function buildIntakeVisionFailureMessage(
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

function buildParsedMetadataTaskSnapshot(
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

function buildIntakeTaskInput(input: {
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

function buildIntakeProductTitle(metadata: IntakeVisionParseOutput) {
  return readIntakeText(metadata.nama_produk) || readIntakeText(metadata.keyword_cari_etalase) || "Intake Tanpa Nama";
}

function buildIntakeDraftProductTitle(file: File) {
  const baseName = readText(file.name).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

  return baseName || "Draf Produk";
}

async function resolveIntakeDriveRootFolder() {
  return await getOrProvisionWorkspaceDriveRoot();
}

async function uploadIntakeDriveImage(input: {
  file: File;
  notes: string;
  folderKind: "product" | "evidence_screenshot";
  intakeCode: string;
  purpose: "SOURCE_IMAGE" | "OTHER";
  folders?: Awaited<ReturnType<typeof ensureIntakeDriveFolders>>;
}) {
  const folders = input.folders ?? (await ensureIntakeDriveFolders(input.intakeCode));
  const targetFolder = input.folderKind === "product" ? folders.productFolder : folders.evidenceScreenshotFolder;
  const parentFolderId = targetFolder.drive_item_id;

  if (!parentFolderId) {
    throw new Error("Folder Drive otomatis belum tersinkron.");
  }

  const uploaded = await uploadFileToGoogleDrive({
    file: input.file,
    name: sanitizeDriveLeafName(input.file.name) || input.folderKind,
    description: input.notes,
    parentFolderId,
  });
  const drivePath = joinIntakeDrivePath(targetFolder.drive_path, input.file.name);

  const driveItem = await createDriveItem({
    item_type: "FILE",
    drive_item_id: uploaded.driveItemId,
    name: uploaded.name,
    drive_url: uploaded.driveUrl,
    drive_path: drivePath,
    mime_type: uploaded.mimeType,
    size_bytes: uploaded.sizeBytes,
    checksum: uploaded.checksum,
    drive_modified_at: uploaded.driveModifiedAt,
    purpose: input.purpose,
    status: "ACTIVE",
    notes: input.notes,
    parent_id: targetFolder.id,
    parent_drive_item_id: targetFolder.drive_item_id,
  });

  return {
    workspace: folders.workspace,
    driveItem,
  };
}

async function uploadIntakeProductImageToDrive(input: { productImage: File; intakeCode?: string | null }) {
  const intakeCode = input.intakeCode ?? `INTAKE-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
  const result = await uploadIntakeDriveImage({
    file: input.productImage,
    notes: "Foto Produk Utama",
    folderKind: "product",
    intakeCode,
    purpose: "SOURCE_IMAGE",
  });

  return {
    intakeCode,
    workspace: result.workspace,
    productImageDriveItem: result.driveItem,
  };
}

async function uploadIntakeScreenshotToDrive(input: {
  file: File;
  intakeCode: string;
  notes: string;
  folders?: Awaited<ReturnType<typeof ensureIntakeDriveFolders>>;
}) {
  const result = await uploadIntakeDriveImage({
    file: input.file,
    notes: input.notes,
    folderKind: "evidence_screenshot",
    intakeCode: input.intakeCode,
    purpose: "OTHER",
    folders: input.folders,
  });

  return {
    workspace: result.workspace,
    screenshotDriveItem: result.driveItem,
  };
}

async function buildIntakeAnalysisImagePartFromDriveItem(driveItemRefId: string, label: string) {
  const driveItem = await getDriveItemById(driveItemRefId);

  if (!driveItem || !driveItem.drive_item_id) {
    throw new Error(`${label} is required.`);
  }

  if (!driveItem.mime_type) {
    throw new Error(`${label} mime type is missing.`);
  }

  const bytes = await getGoogleDriveFileContentBytes(driveItem.drive_item_id);

  if (!bytes.length) {
    throw new Error(`${label} is empty.`);
  }

  const preparedImage = await prepareGeminiCompatibleUploadImage(new File([bytes], driveItem.name, { type: driveItem.mime_type }), label);

  if (!preparedImage) {
    throw new Error(`${label} is not supported for Gemini.`);
  }

  return {
    inline_data: {
      mime_type: preparedImage.mimeType,
      data: preparedImage.buffer.toString("base64"),
    },
  };
}

async function buildIntakeAnalysisImagePart(file: File, label: string) {
  const preparedImage = await prepareGeminiCompatibleUploadImage(file, label);

  if (!preparedImage) {
    throw new Error(`${label} is required.`);
  }

  return {
    inline_data: {
      mime_type: preparedImage.mimeType,
      data: preparedImage.buffer.toString("base64"),
    },
  };
}

function buildIntakeAnchorJson(session: IntakeSessionRecord, workspace: IntakeWorkspace, metadata: IntakeVisionParseOutput) {
  return {
    mode: "intake_review",
    intake_session: {
      id: session.id,
      intake_code: session.intake_code,
      status: session.status,
      product_title: session.product_title,
      shopee_url: session.shopee_url,
      tiktok_url: session.tiktok_url,
      raw_notes: session.raw_notes,
      parsed_metadata_json: session.parsed_metadata_json,
      reviewed_metadata_json: session.reviewed_metadata_json,
    },
    product: workspace.product
      ? {
          id: workspace.product.id,
          product_code: workspace.product.product_code,
          product_name: workspace.product.product_name,
          niche: workspace.product.niche,
          marketplace: workspace.product.marketplace,
          marketplace_product_link: workspace.product.marketplace_product_link,
          notes: workspace.product.notes,
        }
      : null,
    selected_metadata: metadata,
    marketplace_sources: workspace.marketplaceSources.map(buildMarketplaceSourceSnapshot),
    source_image: buildProductImageSnapshot(workspace.selectedSourceImage, workspace.selectedSourceImageDriveItem),
    notes: {
      intake: session.raw_notes,
      product: workspace.product?.notes ?? null,
    },
  } satisfies JsonRecord;
}

async function syncMarketplaceSourceMetadata(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  session: IntakeSessionRecord,
  metadata: IntakeVisionParseOutput,
) {
  const platforms = sourceMarketplacesFromMetadata(metadata);

  if (!session.product_id || !platforms.length) {
    return;
  }

  const { data: sources, error } = await supabase
    .from("product_marketplace_sources")
    .select("id, platform, title")
    .eq("user_id", userId)
    .eq("product_id", session.product_id)
    .in("platform", platforms);

  if (error) {
    throw new Error(error.message);
  }

  if (!sources?.length) {
    return;
  }

  await Promise.all(
    sources.map(async (source) => {
      const platform = source.platform as MarketplacePlatform;
      const fields = marketplaceSourceFieldsForPlatform(platform, metadata, readText(source.title) || session.product_title || "");
      const { error: updateError } = await supabase
        .from("product_marketplace_sources")
        .update({
          ...fields,
          parsed_metadata_json: visionMarketplaceMetadata(platform, session, metadata),
        })
        .eq("id", source.id)
        .eq("user_id", userId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }),
  );
}

async function selectGeminiKeyForIntake(
  userId: string,
  excludedQuotaGroups: ReadonlySet<string> = new Set(),
  excludedKeyIds: ReadonlySet<string> = new Set(),
) {
  const serviceClient = createSupabaseServiceRoleClient();
  const geminiKeys = await listQuotaAwareGeminiKeys({
    userId,
    purpose: "VISION_ANALYSIS",
    excludedQuotaGroups,
    excludedKeyIds,
    serviceClient,
  });
  let sawSecretDecryptionFailure = false;

  for (const geminiKey of geminiKeys) {
    const secretResult = await readGeminiSecretForKey(serviceClient, userId, geminiKey.id);
    sawSecretDecryptionFailure ||= secretResult.decryptFailed;

    if (!secretResult.secret) {
      continue;
    }

    return {
      key: geminiKey,
      secret: secretResult.secret,
      role: geminiKey.role,
    };
  }

  if (sawSecretDecryptionFailure) {
    throw new Error(getGeminiSecretRotationErrorMessage());
  }

  return null;
}

type GeminiKeySelection = {
  key: GeminiSelectedKey;
  secret: string;
  role: string;
};

async function listGeminiRepairKeySelections(
  userId: string,
  fallbackSelection: GeminiKeySelection,
  excludedQuotaGroups: ReadonlySet<string> = new Set(),
  excludedKeyIds: ReadonlySet<string> = new Set(),
) {
  const serviceClient = createSupabaseServiceRoleClient();
  const geminiKeys = await listQuotaAwareGeminiKeys({
    userId,
    purpose: "PROMPT_REPAIR",
    excludedQuotaGroups,
    excludedKeyIds,
    serviceClient,
  });
  const selections: GeminiKeySelection[] = [];
  const seenKeyIds = new Set<string>();
  let sawSecretDecryptionFailure = false;

  for (const geminiKey of geminiKeys) {
    const secretResult = await readGeminiSecretForKey(serviceClient, userId, geminiKey.id);
    sawSecretDecryptionFailure ||= secretResult.decryptFailed;

    if (!secretResult.secret || seenKeyIds.has(geminiKey.id)) {
      continue;
    }

    selections.push({
      key: geminiKey,
      secret: secretResult.secret,
      role: geminiKey.role,
    });
    seenKeyIds.add(geminiKey.id);
  }

  if (!seenKeyIds.has(fallbackSelection.key.id) && !excludedKeyIds.has(fallbackSelection.key.id)) {
    selections.push(fallbackSelection);
  }

  if (!selections.length && sawSecretDecryptionFailure) {
    throw new Error(getGeminiSecretRotationErrorMessage());
  }

  return selections;
}

async function repairIntakeVisionOutput(input: {
  rawText: string;
  prompt: string;
  userId: string;
  taskId: string;
  fallbackSelection: GeminiKeySelection;
  excludedQuotaGroups: Set<string>;
  excludedKeyIds: Set<string>;
}) {
  const repairSelections = await listGeminiRepairKeySelections(
    input.userId,
    input.fallbackSelection,
    input.excludedQuotaGroups,
    input.excludedKeyIds,
  );
  let lastError: unknown = null;

  for (const selection of repairSelections) {
    try {
      const response = await generateTrackedGeminiJsonText({
        aiTaskId: input.taskId,
        geminiApiKey: selection.key,
        taskType: "PROMPT_REPAIR",
        userId: input.userId,
        request: {
          modelName: selection.key.model_name as GeminiModelName,
          apiKey: selection.secret,
          prompt: input.prompt,
          systemInstruction: INTAKE_VISION_SYSTEM_INSTRUCTION,
          temperature: 0,
          maxOutputTokens: 4096,
          timeoutMs: 120_000,
          responseJsonSchema: GEMINI_INTAKE_VISION_RESPONSE_SCHEMA,
        },
      });

      return {
        responseText: response.text,
        selectedKeySelection: selection,
      };
    } catch (error) {
      lastError = error;

      const disposition = getGeminiFailureDisposition(error);

      if (disposition.markKeyError) {
        input.excludedKeyIds.add(selection.key.id);
        await markGeminiKeyError({
          serviceClient: createSupabaseServiceRoleClient(),
          userId: input.userId,
          keyId: selection.key.id,
        }).catch(() => undefined);
        continue;
      }

      if (disposition.markGroupError) {
        input.excludedQuotaGroups.add(getGeminiQuotaGroupKey(selection.key));
        await markGeminiQuotaGroupError({
          serviceClient: createSupabaseServiceRoleClient(),
          userId: input.userId,
          key: selection.key,
        }).catch(() => undefined);
        continue;
      }

      if (disposition.markGroupCooldown) {
        input.excludedQuotaGroups.add(getGeminiQuotaGroupKey(selection.key));
        await markGeminiQuotaGroupCooldown({
          serviceClient: createSupabaseServiceRoleClient(),
          userId: input.userId,
          key: selection.key,
          nextStatus: disposition.nextStatus ?? "RATE_LIMITED",
          cooldownUntil: disposition.cooldownUntil,
        }).catch(() => undefined);
        continue;
      }

      if (disposition.excludeQuotaGroup) {
        input.excludedQuotaGroups.add(getGeminiQuotaGroupKey(selection.key));
        continue;
      }

      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to repair Gemini output.");
}

async function updateIntakeSessionRecord(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  id: string,
  input: Partial<
    Pick<IntakeSessionInput, "product_title" | "status" | "error_message" | "parsed_metadata_json" | "reviewed_metadata_json">
  >,
) {
  const { data, error } = await supabase
    .from("product_intake_sessions")
    .update({
      ...(input.product_title !== undefined ? { product_title: normalizeIntakeText(input.product_title) } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.error_message !== undefined ? { error_message: normalizeIntakeText(input.error_message) } : {}),
      ...(input.parsed_metadata_json !== undefined ? { parsed_metadata_json: input.parsed_metadata_json } : {}),
      ...(input.reviewed_metadata_json !== undefined ? { reviewed_metadata_json: input.reviewed_metadata_json } : {}),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as IntakeSessionRecord;
}

function buildUploadedImageSummary(file: File) {
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

function buildMissingImageSummary(name: string) {
  return {
    name,
    mimeType: "application/octet-stream",
    size: 0,
  };
}

function assertHasMarketplaceScreenshot(input: { shopeeScreenshot?: unknown; tiktokScreenshot?: unknown }) {
  if (!input.shopeeScreenshot && !input.tiktokScreenshot) {
    throw new Error("Tambahkan minimal satu screenshot Shopee atau TikTok.");
  }
}

function sanitizeDriveLeafName(value: string) {
  const trimmed = readText(value);

  if (!trimmed) {
    return "upload.bin";
  }

  return trimmed.replace(/[\\/:*?"<>|]+/g, "-");
}

function joinIntakeDrivePath(...segments: Array<string | null | undefined>) {
  return `/${segments
    .map((segment) => readText(segment))
    .filter(Boolean)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")}`;
}

async function ensureIntakeDriveFolderRecord(input: {
  name: string;
  drivePath: string;
  parentFolderId: string;
  parentRecord: DriveItemRecord;
  notes: string;
}) {
  const driveFolder = await ensureGoogleDriveFolder({
    name: input.name,
    parentFolderId: input.parentFolderId,
  });
  const existing = (await getDriveItemByDriveItemId(driveFolder.id)) ?? (await getDriveItemByDrivePath(input.drivePath));

  if (existing) {
    return (await updateDriveItem(existing.id, {
      item_type: "FOLDER",
      drive_item_id: driveFolder.id,
      name: driveFolder.name,
      drive_url: driveFolder.webViewLink,
      drive_path: input.drivePath,
      purpose: "OTHER",
      status: "ACTIVE",
      notes: input.notes,
      parent_id: input.parentRecord.id,
      parent_drive_item_id: input.parentRecord.drive_item_id,
    })) as DriveItemRecord;
  }

  return (await createDriveItem({
    item_type: "FOLDER",
    drive_item_id: driveFolder.id,
    name: driveFolder.name,
    drive_url: driveFolder.webViewLink,
    drive_path: input.drivePath,
    purpose: "OTHER",
    status: "ACTIVE",
    notes: input.notes,
    parent_id: input.parentRecord.id,
    parent_drive_item_id: input.parentRecord.drive_item_id,
  })) as DriveItemRecord;
}

export async function ensureIntakeDriveFolders(intakeCode: string) {
  const { workspace, rootFolder } = await resolveIntakeDriveRootFolder();
  const rootFolderId = rootFolder.drive_item_id;

  if (!rootFolderId) {
    throw new Error("Folder Drive otomatis belum tersinkron.");
  }

  const intakeContainer = await ensureIntakeDriveFolderRecord({
    name: "INTAKE",
    drivePath: joinIntakeDrivePath(rootFolder.drive_path, "INTAKE"),
    parentFolderId: rootFolderId,
    parentRecord: rootFolder,
    notes: "Workspace intake folder.",
  });

  if (!intakeContainer.drive_item_id) {
    throw new Error("Folder intake belum tersinkron.");
  }

  const intakeFolderName = sanitizeDriveLeafName(intakeCode);
  const intakeFolder = await ensureIntakeDriveFolderRecord({
    name: intakeFolderName,
    drivePath: joinIntakeDrivePath(intakeContainer.drive_path, intakeFolderName),
    parentFolderId: intakeContainer.drive_item_id,
    parentRecord: intakeContainer,
    notes: `Intake folder ${intakeFolderName}.`,
  });

  if (!intakeFolder.drive_item_id) {
    throw new Error("Folder root intake belum tersinkron.");
  }

  const productFolder = await ensureIntakeDriveFolderRecord({
    name: "product",
    drivePath: joinIntakeDrivePath(intakeFolder.drive_path, "product"),
    parentFolderId: intakeFolder.drive_item_id,
    parentRecord: intakeFolder,
    notes: `Product assets for ${intakeFolderName}.`,
  });

  const evidenceScreenshotFolder = await ensureIntakeDriveFolderRecord({
    name: "evidence_screenshot",
    drivePath: joinIntakeDrivePath(intakeFolder.drive_path, "evidence_screenshot"),
    parentFolderId: intakeFolder.drive_item_id,
    parentRecord: intakeFolder,
    notes: `Screenshot evidence for ${intakeFolderName}.`,
  });

  return {
    workspace,
    intakeCode: intakeFolderName,
    productFolder,
    evidenceScreenshotFolder,
  };
}

async function uploadIntakeEvidenceToDrive(input: {
  productImage: File;
  shopeeScreenshot?: File | null;
  tiktokScreenshot?: File | null;
}) {
  const intakeCode = `INTAKE-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
  const folders = await ensureIntakeDriveFolders(intakeCode);
  const productImageDriveItem = (await uploadIntakeDriveImage({
    file: input.productImage,
    folders,
    folderKind: "product",
    intakeCode,
    notes: "Foto Produk Utama",
    purpose: "SOURCE_IMAGE",
  })).driveItem;
  const shopeeScreenshotDriveItem = input.shopeeScreenshot
    ? (await uploadIntakeScreenshotToDrive({
        file: input.shopeeScreenshot,
        folders,
        intakeCode,
        notes: "Screenshot Shopee",
      })).screenshotDriveItem
    : null;
  const tiktokScreenshotDriveItem = input.tiktokScreenshot
    ? (await uploadIntakeScreenshotToDrive({
        file: input.tiktokScreenshot,
        folders,
        intakeCode,
        notes: "Screenshot TikTok",
      })).screenshotDriveItem
    : null;

  return {
    workspace: folders.workspace,
    intakeCode,
    productImageDriveItem,
    shopeeScreenshotDriveItem,
    tiktokScreenshotDriveItem,
  };
}

async function createDurableIntakeCapture(
  input: IntakeAnalysisUploadInput,
  uploadedEvidence: Awaited<ReturnType<typeof uploadIntakeEvidenceToDrive>>,
) {
  const draftProductName = buildIntakeDraftProductTitle(input.productImage);

  if (!uploadedEvidence.productImageDriveItem) {
    throw new Error("Foto Produk Utama gagal disimpan ke Drive.");
  }

  const product = await createProduct({
    workspace_id: uploadedEvidence.workspace.id,
    product_name: draftProductName,
    status: "DRAFT",
  });

  await attachProductSourceImage({
    productId: product.id,
    driveItemRefId: uploadedEvidence.productImageDriveItem.id,
    isPrimary: true,
    status: "ATTACHED",
    notes: "Auto-attached from intake photo.",
  });

  const session = await createIntakeSession({
    workspace_id: uploadedEvidence.workspace.id,
    product_id: product.id,
    product_title: draftProductName,
    product_photo_drive_item_ref_id: uploadedEvidence.productImageDriveItem.id,
    screenshot_drive_item_ref_id: uploadedEvidence.shopeeScreenshotDriveItem?.id ?? null,
    status: "DRAFT",
  });

  return {
    product,
    session,
  };
}

export async function saveIntakeProductCapture(input: {
  productImage: File;
  shopeeScreenshot?: File | null;
  tiktokScreenshot?: File | null;
  intakeSessionId?: string | null;
}) {
  assertUploadedImage(input.productImage, "Foto Produk Utama");

  if (input.shopeeScreenshot) {
    assertUploadedImage(input.shopeeScreenshot, "Screenshot Shopee");
  }

  if (input.tiktokScreenshot) {
    assertUploadedImage(input.tiktokScreenshot, "Screenshot TikTok");
  }

  const draftProductName = buildIntakeDraftProductTitle(input.productImage);
  const existingSession = input.intakeSessionId ? await getIntakeSessionById(input.intakeSessionId) : null;
  const uploaded = await uploadIntakeProductImageToDrive({
    productImage: input.productImage,
    intakeCode: existingSession?.intake_code ?? null,
  });
  const existingProduct = existingSession?.product_id ? await getProductById(existingSession.product_id) : null;
  const product = existingProduct
    ? await updateProduct(existingProduct.id, {
        workspace_id: existingProduct.workspace_id ?? uploaded.workspace.id,
        product_name: draftProductName,
        status: "DRAFT",
      })
    : await createProduct({
        workspace_id: uploaded.workspace.id,
        product_name: draftProductName,
        status: "DRAFT",
      });

  const [shopeeScreenshotDriveItem, tiktokScreenshotDriveItem] = await Promise.all([
    input.shopeeScreenshot
      ? uploadIntakeScreenshotToDrive({
          file: input.shopeeScreenshot,
          intakeCode: uploaded.intakeCode,
          notes: "Screenshot Shopee",
        }).then((result) => result.screenshotDriveItem)
      : Promise.resolve(null),
    input.tiktokScreenshot
      ? uploadIntakeScreenshotToDrive({
          file: input.tiktokScreenshot,
          intakeCode: uploaded.intakeCode,
          notes: "Screenshot TikTok",
        }).then((result) => result.screenshotDriveItem)
      : Promise.resolve(null),
  ]);

  await attachProductSourceImage({
    productId: product.id,
    driveItemRefId: uploaded.productImageDriveItem.id,
    isPrimary: true,
    status: "ATTACHED",
    notes: "Auto-attached from intake photo.",
  });

  const session = existingSession
      ? await updateIntakeSession(existingSession.id, {
          workspace_id: existingSession.workspace_id ?? uploaded.workspace.id,
          product_id: product.id,
          product_title: draftProductName,
          product_photo_drive_item_ref_id: uploaded.productImageDriveItem.id,
          ...(shopeeScreenshotDriveItem ? { screenshot_drive_item_ref_id: shopeeScreenshotDriveItem.id } : {}),
          status: "DRAFT",
          error_message: null,
        })
    : await createIntakeSession({
        workspace_id: uploaded.workspace.id,
        intake_code: uploaded.intakeCode,
        product_id: product.id,
        product_title: draftProductName,
        product_photo_drive_item_ref_id: uploaded.productImageDriveItem.id,
        screenshot_drive_item_ref_id: shopeeScreenshotDriveItem?.id ?? null,
        status: "DRAFT",
      });

  await Promise.all([
    shopeeScreenshotDriveItem
      ? createMarketplaceSource({
          product_id: product.id,
          workspace_id: product.workspace_id ?? session.workspace_id,
          platform: "SHOPEE",
          title: draftProductName,
          screenshot_drive_item_ref_id: shopeeScreenshotDriveItem.id,
          status: "DRAFT",
          notes: "Saved from intake draft.",
        })
      : Promise.resolve(null),
    tiktokScreenshotDriveItem
      ? createMarketplaceSource({
          product_id: product.id,
          workspace_id: product.workspace_id ?? session.workspace_id,
          platform: "TIKTOK",
          title: draftProductName,
          screenshot_drive_item_ref_id: tiktokScreenshotDriveItem.id,
          status: "DRAFT",
          notes: "Saved from intake draft.",
        })
      : Promise.resolve(null),
  ]);

  return {
    product,
    session,
  };
}

export async function analyzeIntakeMetadataFromSavedCapture(input: {
  intakeSessionId: string;
  shopeeScreenshot?: File | null;
  tiktokScreenshot?: File | null;
  clientContext?: IntakeClientContextInput | null;
}) {
  const { supabase, user } = await requireUser();
  const session = await getIntakeSessionById(input.intakeSessionId);
  const product = session.product_id ? await getProductById(session.product_id) : null;

  if (!product) {
    throw new Error("Simpan produk dulu.");
  }

  if (!session.product_photo_drive_item_ref_id) {
    throw new Error("Foto produk utama belum tersimpan.");
  }

  if (input.shopeeScreenshot) {
    assertUploadedImage(input.shopeeScreenshot, "Screenshot Shopee");
  }

  if (input.tiktokScreenshot) {
    assertUploadedImage(input.tiktokScreenshot, "Screenshot TikTok");
  }

  const productDriveItem = await getDriveItemById(session.product_photo_drive_item_ref_id);
  if (!productDriveItem?.drive_item_id) {
    throw new Error("Foto produk utama belum tersimpan di Drive.");
  }

  let totalBytes =
    (productDriveItem.size_bytes ?? 0) +
    (input.shopeeScreenshot?.size ?? 0) +
    (input.tiktokScreenshot?.size ?? 0);

  let maxFileBytes = Math.max(productDriveItem.size_bytes ?? 0, input.shopeeScreenshot?.size ?? 0, input.tiktokScreenshot?.size ?? 0);
  const analysisStartedAt = new Date();
  const requestStartedAt = analysisStartedAt.toISOString();
  let freshEvidenceCount = 0;
  let savedEvidenceCount = 0;
  const intakeCode = session.intake_code;
  let analysisSession: IntakeSessionRecord | null = session;
  let task: AiTaskRecord | null = null;
  let taskWaitingForKey = false;
  let responseText: string | null = null;
  let repairAttempted = false;
  let repairResponseText: string | null = null;
  let selectedKeySelectionForSuccess: GeminiKeySelection | null = null;

  try {
    const existingSources = await listProductMarketplaceSources({ productId: product.id, limit: 20 });
    const existingShopeeSource = existingSources.find((source) => source.platform === "SHOPEE") ?? null;
    const existingTiktokSource = existingSources.find((source) => source.platform === "TIKTOK") ?? null;
    const existingShopeeDriveItemRefId = existingShopeeSource?.screenshot_drive_item_ref_id ?? session.screenshot_drive_item_ref_id ?? null;
    const existingTiktokDriveItemRefId = existingTiktokSource?.screenshot_drive_item_ref_id ?? null;
    const existingShopeeDriveItem = existingShopeeDriveItemRefId ? await getDriveItemById(existingShopeeDriveItemRefId) : null;
    const existingTiktokDriveItem = existingTiktokDriveItemRefId ? await getDriveItemById(existingTiktokDriveItemRefId) : null;
    const hasShopeeEvidence = Boolean(input.shopeeScreenshot || existingShopeeDriveItem?.drive_item_id);
    const hasTiktokEvidence = Boolean(input.tiktokScreenshot || existingTiktokDriveItem?.drive_item_id);

    assertHasMarketplaceScreenshot({
      shopeeScreenshot: hasShopeeEvidence,
      tiktokScreenshot: hasTiktokEvidence,
    });

    totalBytes =
      (productDriveItem.size_bytes ?? 0) +
      (input.shopeeScreenshot?.size ?? existingShopeeDriveItem?.size_bytes ?? 0) +
      (input.tiktokScreenshot?.size ?? existingTiktokDriveItem?.size_bytes ?? 0);
    maxFileBytes = Math.max(
      productDriveItem.size_bytes ?? 0,
      input.shopeeScreenshot?.size ?? existingShopeeDriveItem?.size_bytes ?? 0,
      input.tiktokScreenshot?.size ?? existingTiktokDriveItem?.size_bytes ?? 0,
    );

    const productImageSummary = {
      name: productDriveItem.name,
      mimeType: productDriveItem.mime_type ?? "image/jpeg",
      size: productDriveItem.size_bytes ?? 0,
    };
    const shopeeScreenshotSummary = input.shopeeScreenshot
      ? buildUploadedImageSummary(input.shopeeScreenshot)
      : existingShopeeDriveItem
        ? {
            name: existingShopeeDriveItem.name,
            mimeType: existingShopeeDriveItem.mime_type ?? "application/octet-stream",
            size: existingShopeeDriveItem.size_bytes ?? 0,
          }
        : buildMissingImageSummary("Screenshot Shopee");
    const tiktokScreenshotSummary = input.tiktokScreenshot
      ? buildUploadedImageSummary(input.tiktokScreenshot)
      : existingTiktokDriveItem
        ? {
            name: existingTiktokDriveItem.name,
            mimeType: existingTiktokDriveItem.mime_type ?? "application/octet-stream",
            size: existingTiktokDriveItem.size_bytes ?? 0,
          }
        : buildMissingImageSummary("Screenshot TikTok");
    freshEvidenceCount = (input.shopeeScreenshot ? 1 : 0) + (input.tiktokScreenshot ? 1 : 0);
    savedEvidenceCount = 1 + (input.shopeeScreenshot ? 0 : existingShopeeDriveItem ? 1 : 0) + (input.tiktokScreenshot ? 0 : existingTiktokDriveItem ? 1 : 0);

    const createdTask = (await createAITask({
      taskType: "VISION_ANALYSIS",
      inputJson: buildIntakeTaskInput({
        productImage: productImageSummary,
        shopeeScreenshot: shopeeScreenshotSummary,
        tiktokScreenshot: tiktokScreenshotSummary,
        clientContext: input.clientContext ?? null,
        analysisPath: "saved_capture",
        freshEvidenceCount,
        savedEvidenceCount,
        clientUploadBytes: (input.shopeeScreenshot?.size ?? 0) + (input.tiktokScreenshot?.size ?? 0),
        totalUploadBytes: totalBytes,
        maxFileBytes,
        requestStartedAt,
      }),
      maxRetries: 0,
    })) as AiTaskRecord;

    task = createdTask;
    await markTaskRunning(createdTask.id);

    analysisSession = await updateIntakeSessionRecord(supabase, user.id, session.id, {
      status: "SUBMITTED",
      error_message: null,
    });

    if (totalBytes > 19 * 1024 * 1024) {
      throw new Error("Total upload terlalu besar untuk analisis Gemini live.");
    }

    const shopeeScreenshotDriveItem = input.shopeeScreenshot
      ? (await uploadIntakeScreenshotToDrive({
          file: input.shopeeScreenshot,
          intakeCode,
          notes: "Screenshot Shopee",
        })).screenshotDriveItem
      : existingShopeeDriveItem;
    const tiktokScreenshotDriveItem = input.tiktokScreenshot
      ? (await uploadIntakeScreenshotToDrive({
          file: input.tiktokScreenshot,
          intakeCode,
          notes: "Screenshot TikTok",
        })).screenshotDriveItem
      : existingTiktokDriveItem;

    assertHasMarketplaceScreenshot({
      shopeeScreenshot: shopeeScreenshotDriveItem?.drive_item_id,
      tiktokScreenshot: tiktokScreenshotDriveItem?.drive_item_id,
    });

    await Promise.all([
      shopeeScreenshotDriveItem
        ? createMarketplaceSource({
            product_id: product.id,
            workspace_id: product.workspace_id ?? session.workspace_id,
            platform: "SHOPEE",
            title: session.product_title || product.product_name,
            screenshot_drive_item_ref_id: shopeeScreenshotDriveItem.id,
            status: "DRAFT",
            notes: "Awaiting Gemini analysis.",
          })
        : Promise.resolve(null),
      tiktokScreenshotDriveItem
        ? createMarketplaceSource({
            product_id: product.id,
            workspace_id: product.workspace_id ?? session.workspace_id,
            platform: "TIKTOK",
            title: session.product_title || product.product_name,
            screenshot_drive_item_ref_id: tiktokScreenshotDriveItem.id,
            status: "DRAFT",
            notes: "Awaiting Gemini analysis.",
          })
        : Promise.resolve(null),
    ]);

    const productImageBytes = await getGoogleDriveFileContentBytes(productDriveItem.drive_item_id);
    const productImageFile = new File([productImageBytes], productDriveItem.name, {
      type: productDriveItem.mime_type ?? "image/jpeg",
    });
    const productImagePart = await buildIntakeAnalysisImagePartFromDriveItem(session.product_photo_drive_item_ref_id, "Foto Produk Utama");
    const shopeeScreenshotPart = shopeeScreenshotDriveItem
      ? input.shopeeScreenshot
        ? await buildIntakeAnalysisImagePart(input.shopeeScreenshot, "Screenshot Shopee")
        : await buildIntakeAnalysisImagePartFromDriveItem(shopeeScreenshotDriveItem.id, "Screenshot Shopee")
      : null;
    const tiktokScreenshotPart = tiktokScreenshotDriveItem
      ? input.tiktokScreenshot
        ? await buildIntakeAnalysisImagePart(input.tiktokScreenshot, "Screenshot TikTok")
        : await buildIntakeAnalysisImagePartFromDriveItem(tiktokScreenshotDriveItem.id, "Screenshot TikTok")
      : null;

    const excludedQuotaGroups = new Set<string>();
    const excludedKeyIds = new Set<string>();

    while (!responseText) {
      const selectedKey = await selectGeminiKeyForIntake(user.id, excludedQuotaGroups, excludedKeyIds);

      if (!selectedKey) {
        const message = "No Gemini key is ready for live intake analysis.";
        taskWaitingForKey = true;
        await markTaskWaitingForKey(createdTask.id, message);
        throw new Error(message);
      }

      const { error: taskKeyUpdateError } = await supabase
        .from("ai_tasks")
        .update({
          gemini_api_key_id: selectedKey.key.id,
        })
        .eq("id", createdTask.id)
        .eq("user_id", user.id);

      if (taskKeyUpdateError) {
        throw new Error(taskKeyUpdateError.message);
      }

      try {
        const response = await generateTrackedGeminiJsonText({
          aiTaskId: createdTask.id,
          geminiApiKey: selectedKey.key,
          taskType: "VISION_ANALYSIS",
          userId: user.id,
          request: {
            modelName: selectedKey.key.model_name as GeminiModelName,
            apiKey: selectedKey.secret,
            parts: [
              productImagePart,
              ...(shopeeScreenshotPart ? [shopeeScreenshotPart] : []),
              ...(tiktokScreenshotPart ? [tiktokScreenshotPart] : []),
              {
                text: buildIntakeParsePrompt({
                  productImage: buildUploadedImageSummary(productImageFile),
                  shopeeScreenshot: shopeeScreenshotDriveItem ? shopeeScreenshotSummary : null,
                  tiktokScreenshot: tiktokScreenshotDriveItem ? tiktokScreenshotSummary : null,
                }),
              },
            ],
            systemInstruction: INTAKE_VISION_SYSTEM_INSTRUCTION,
            temperature: 0.1,
            maxOutputTokens: 4096,
            timeoutMs: 120_000,
            responseJsonSchema: GEMINI_INTAKE_VISION_RESPONSE_SCHEMA,
          },
        });

        selectedKeySelectionForSuccess = selectedKey;
        responseText = response.text;
      } catch (error) {
        if (error instanceof GeminiClientError) {
          const disposition = getGeminiFailureDisposition(error);

          if (disposition.markKeyError) {
            excludedKeyIds.add(selectedKey.key.id);
            await markGeminiKeyError({
              serviceClient: createSupabaseServiceRoleClient(),
              userId: user.id,
              keyId: selectedKey.key.id,
            }).catch(() => undefined);
            continue;
          }

          if (disposition.markGroupError) {
            excludedQuotaGroups.add(getGeminiQuotaGroupKey(selectedKey.key));
            await markGeminiQuotaGroupError({
              serviceClient: createSupabaseServiceRoleClient(),
              userId: user.id,
              key: selectedKey.key,
            }).catch(() => undefined);
            continue;
          }

          if (disposition.markGroupCooldown) {
            excludedQuotaGroups.add(getGeminiQuotaGroupKey(selectedKey.key));
            await markGeminiQuotaGroupCooldown({
              serviceClient: createSupabaseServiceRoleClient(),
              userId: user.id,
              key: selectedKey.key,
              nextStatus: disposition.nextStatus ?? "RATE_LIMITED",
              cooldownUntil: disposition.cooldownUntil,
            }).catch(() => undefined);
            continue;
          }

          if (disposition.excludeQuotaGroup) {
            excludedQuotaGroups.add(getGeminiQuotaGroupKey(selectedKey.key));
            continue;
          }
        }

        throw error;
      }
    }

    const parsed = await parseIntakeVisionOutputWithRepair({
      rawText: responseText,
      repair: async ({ rawText, prompt }) => {
        repairAttempted = true;
        if (!selectedKeySelectionForSuccess) {
          throw new Error("Missing successful Gemini key selection for intake repair.");
        }

        const repairResult = await repairIntakeVisionOutput({
          rawText,
          prompt,
          userId: user.id,
          taskId: createdTask.id,
          fallbackSelection: selectedKeySelectionForSuccess,
          excludedQuotaGroups,
          excludedKeyIds,
        });

        selectedKeySelectionForSuccess = repairResult.selectedKeySelection;
        repairResponseText = repairResult.responseText;

        return repairResult.responseText;
      },
    });

    const parsedWithEvidenceAvailability = applyMarketplaceEvidenceAvailability(parsed, {
      shopee: Boolean(shopeeScreenshotDriveItem),
      tiktok: Boolean(tiktokScreenshotDriveItem),
    });
    const parsedWithNote: IntakeVisionParseOutput = {
      ...parsedWithEvidenceAvailability,
      confidence_notes: appendUniqueNote(
        parsedWithEvidenceAvailability.confidence_notes,
        "Analisis Gemini live dari screenshot intake yang tersimpan.",
      ),
    };
    const parsedJson = toReviewedMetadataJson(parsedWithNote);

    const nextProductName = buildIntakeProductTitle(parsedWithNote);
    const updatedProduct = await updateProduct(product.id, {
      workspace_id: product.workspace_id ?? session.workspace_id ?? undefined,
      product_name: nextProductName,
      niche: productNicheFromMetadata(parsedWithNote, product.niche),
      marketplace: productMarketplaceFromIntake(session, parsedWithNote),
    });

    await updateIntakeSessionRecord(supabase, user.id, session.id, {
      product_title: nextProductName,
      parsed_metadata_json: parsedJson,
      status: "NEEDS_REVIEW",
      error_message: null,
    });

    const finalSession = await getIntakeSessionById(session.id);
    analysisSession = finalSession;

    await createMarketplaceSourcesFromVisionEvidence({
      product: updatedProduct,
      session: finalSession,
      metadata: parsedWithNote,
      shopeeScreenshotDriveItemRefId: shopeeScreenshotDriveItem?.id ?? null,
      tiktokScreenshotDriveItemRefId: tiktokScreenshotDriveItem?.id ?? null,
    });

    const requestFinishedAt = new Date().toISOString();
    const requestDurationMs = Math.max(0, Date.now() - analysisStartedAt.getTime());
    const successTelemetry = buildIntakeTelemetryPayload({
      clientContext: input.clientContext ?? null,
      analysisPath: "saved_capture",
      freshEvidenceCount,
      savedEvidenceCount,
      clientUploadBytes: (input.shopeeScreenshot?.size ?? 0) + (input.tiktokScreenshot?.size ?? 0),
      totalUploadBytes: totalBytes,
      maxFileBytes,
      requestStartedAt,
      requestFinishedAt,
      requestDurationMs,
      repairAttempted,
      repairSuccess: repairAttempted && Boolean(repairResponseText),
      failureKind: null,
      responseTextExcerpt: summarizeIntakeVisionResponseText(responseText),
      repairResponseTextExcerpt: summarizeIntakeVisionResponseText(repairResponseText),
      modelName: selectedKeySelectionForSuccess?.key.model_name ?? null,
    });
    const completedTask = await markTaskSuccess(
      createdTask.id,
      buildParsedMetadataTaskSnapshot(
        parsedWithNote,
        selectedKeySelectionForSuccess?.key.model_name,
        successTelemetry,
        responseText
          ? buildIntakeVisionTaskDiagnostics({
              repairAttempted,
              responseText,
              repairResponseText,
              modelName: selectedKeySelectionForSuccess?.key.model_name ?? null,
            })
          : undefined,
      ),
    );

    if (selectedKeySelectionForSuccess) {
      await markGeminiKeySuccess({
        serviceClient: createSupabaseServiceRoleClient(),
        userId: user.id,
        key: selectedKeySelectionForSuccess.key,
      }).catch(() => undefined);
    }

    revalidatePath("/intake");
    revalidatePath("/products");
    revalidatePath(`/products/${updatedProduct.id}`);

    return {
      task: completedTask,
      product: updatedProduct,
      session: finalSession,
      parsed: parsedJson,
      message: "Analisis metadata selesai. Produk masuk list.",
    };
  } catch (error) {
    const message = safeErrorMessage(error);
    const upstreamStatus = error instanceof GeminiClientError ? error.status : null;
    const upstreamRetryAfterSeconds = error instanceof GeminiClientError ? error.retryAfterSeconds : null;
    const failureKind = classifyIntakeFailureKind({
      errorMessage: message,
      upstreamStatus,
      telemetryFailureKind: null,
      responseText,
      repairAttempted,
      repairResponseText,
    });
    const requestFinishedAt = new Date().toISOString();
    const requestDurationMs = Math.max(0, Date.now() - analysisStartedAt.getTime());
    const failureTelemetry = buildIntakeTelemetryPayload({
      clientContext: input.clientContext ?? null,
      analysisPath: "saved_capture",
      freshEvidenceCount,
      savedEvidenceCount,
      clientUploadBytes: (input.shopeeScreenshot?.size ?? 0) + (input.tiktokScreenshot?.size ?? 0),
      totalUploadBytes: totalBytes,
      maxFileBytes,
      requestStartedAt,
      requestFinishedAt,
      requestDurationMs,
      repairAttempted,
      repairSuccess: false,
      failureKind,
      upstreamStatus,
      upstreamRetryAfterSeconds,
      responseTextExcerpt: summarizeIntakeVisionResponseText(responseText),
      repairResponseTextExcerpt: summarizeIntakeVisionResponseText(repairResponseText),
      modelName: selectedKeySelectionForSuccess?.key.model_name ?? null,
    });
    const failureDiagnostics = responseText
      ? buildIntakeVisionTaskDiagnostics({
          repairAttempted,
          responseText,
          repairResponseText,
          modelName: selectedKeySelectionForSuccess?.key.model_name ?? null,
        })
      : null;
    const failureMessage = buildIntakeVisionFailureMessage(message, {
      responseText,
      repairAttempted,
      repairResponseText,
    });

    if (task && !taskWaitingForKey) {
      try {
        await markTaskFailed(task.id, failureMessage, {
          retryable: false,
          outputJson: {
            pipeline: "intake_vision",
            analysis_mode: "LIVE_IMAGE_BYTES",
            telemetry: failureTelemetry,
            ...(failureDiagnostics ? { diagnostics: failureDiagnostics } : {}),
          } satisfies JsonRecord,
        });
      } catch {
        // Keep the intake recoverable even if task failure update fails.
      }
    }

    if (analysisSession) {
      try {
        await updateIntakeSessionRecord(supabase, user.id, analysisSession.id, {
          status: "ERROR",
          error_message: failureMessage,
        });
      } catch {
        // Preserve the original failure if the intake row update also fails.
      }
    }

    revalidatePath("/intake");
    throw new Error(failureMessage);
  }
}

export async function createIntakeSession(input: IntakeSessionInput) {
  const { supabase, user } = await requireUser();
  const status = input.status ?? "SUBMITTED";
  assertIntakeStatus(status);

  if (!hasMinimumIntakeInput(input)) {
    throw new Error("Add a title, link, Drive ref, or notes.");
  }

  const workspaceId = await resolveWorkspaceIdForInsert(input.workspace_id);

  const { data, error } = await supabase
    .from("product_intake_sessions")
    .insert({
      user_id: user.id,
      workspace_id: workspaceId,
      product_id: normalizeIntakeText(input.product_id),
      intake_code: readIntakeText(input.intake_code) || buildIntakeCode(input),
      product_title: normalizeIntakeText(input.product_title),
      shopee_url: normalizeIntakeText(input.shopee_url),
      tiktok_url: normalizeIntakeText(input.tiktok_url),
      product_photo_drive_item_ref_id: normalizeIntakeText(input.product_photo_drive_item_ref_id),
      screenshot_drive_item_ref_id: normalizeIntakeText(input.screenshot_drive_item_ref_id),
      raw_notes: normalizeIntakeText(input.raw_notes),
      parsed_metadata_json: input.parsed_metadata_json ?? null,
      reviewed_metadata_json: input.reviewed_metadata_json ?? null,
      status,
      error_message: normalizeIntakeText(input.error_message),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/intake");
  return data as IntakeSessionRecord;
}

export async function listIntakeSessions(input?: {
  status?: IntakeStatus | string;
  productId?: string;
  workspaceId?: string | null;
  limit?: number;
}) {
  const { supabase, user } = await requireUser();

  if (input?.status) {
    assertIntakeStatus(input.status);
  }

  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = supabase
    .from("product_intake_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.status) {
    query = query.eq("status", input.status);
  }

  if (input?.productId) {
    query = query.eq("product_id", input.productId);
  }

  if (input?.workspaceId) {
    query = query.eq("workspace_id", input.workspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as IntakeSessionRecord[];
}

export async function updateIntakeSession(id: string, input: IntakeSessionInput) {
  const { supabase, user } = await requireUser();

  if (input.status) {
    assertIntakeStatus(input.status);
  }

  const { data, error } = await supabase
    .from("product_intake_sessions")
    .update({
      ...(input.workspace_id !== undefined ? { workspace_id: normalizeNullableWorkspaceUuid(input.workspace_id) } : {}),
      ...(input.product_id !== undefined ? { product_id: normalizeIntakeText(input.product_id) } : {}),
      ...(input.product_title !== undefined ? { product_title: normalizeIntakeText(input.product_title) } : {}),
      ...(input.shopee_url !== undefined ? { shopee_url: normalizeIntakeText(input.shopee_url) } : {}),
      ...(input.tiktok_url !== undefined ? { tiktok_url: normalizeIntakeText(input.tiktok_url) } : {}),
      ...(input.product_photo_drive_item_ref_id !== undefined
        ? { product_photo_drive_item_ref_id: normalizeIntakeText(input.product_photo_drive_item_ref_id) }
        : {}),
      ...(input.screenshot_drive_item_ref_id !== undefined
        ? { screenshot_drive_item_ref_id: normalizeIntakeText(input.screenshot_drive_item_ref_id) }
        : {}),
      ...(input.raw_notes !== undefined ? { raw_notes: normalizeIntakeText(input.raw_notes) } : {}),
      ...(input.parsed_metadata_json !== undefined ? { parsed_metadata_json: input.parsed_metadata_json } : {}),
      ...(input.reviewed_metadata_json !== undefined ? { reviewed_metadata_json: input.reviewed_metadata_json } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.error_message !== undefined ? { error_message: normalizeIntakeText(input.error_message) } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/intake");
  return data as IntakeSessionRecord;
}

export async function reviewIntakeMetadata(id: string, metadata: JsonRecord) {
  const { supabase, user } = await requireUser();
  const session = await loadIntakeSessionById(supabase, user.id, id);
  const normalized = buildReviewedMetadataFromInput(metadata, session.reviewed_metadata_json ?? session.parsed_metadata_json);
  const reviewedJson = toReviewedMetadataJson(normalized);

  const updatedSession = await updateIntakeSession(id, {
    product_title: normalized.nama_produk || session.product_title,
    reviewed_metadata_json: reviewedJson,
    status: "REVIEWED",
    error_message: null,
  });

  await syncMarketplaceSourceMetadata(supabase, user.id, session, normalized).catch(() => undefined);

  if (updatedSession.product_id) {
    const product = await getProductById(updatedSession.product_id);

    if (product) {
      const productName = normalized.nama_produk || normalized.product_title || updatedSession.product_title || product.product_name;

      await updateProduct(product.id, {
        workspace_id: product.workspace_id ?? updatedSession.workspace_id ?? undefined,
        product_name: productName,
        niche: productNicheFromMetadata(normalized, product.niche),
        marketplace: productMarketplaceFromIntake(updatedSession, normalized),
      });
      revalidatePath(`/products/${product.id}`);
    }
  }

  revalidatePath("/prompts");

  return updatedSession;
}

export async function linkProductToIntake(intakeSessionId: string, productId: string) {
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("Product not found.");
  }

  return await updateIntakeSession(intakeSessionId, {
    workspace_id: product.workspace_id,
    product_id: product.id,
  });
}

export async function createProductFromIntake(
  intakeSessionId: string,
  input?: {
    product_code?: string | null;
    product_name?: string | null;
    niche?: string | null;
    notes?: string | null;
    status?: string | null;
  },
) {
  const session = await getIntakeSessionById(intakeSessionId);
  const metadata = metadataFromSession(session);
  const productName =
    readIntakeText(input?.product_name) ||
    readIntakeText(metadata.nama_produk) ||
    readIntakeText(metadata.product_title) ||
    readIntakeText(session.product_title);

  if (!productName) {
    throw new Error("Product title is required.");
  }

  const marketplace = productMarketplaceFromIntake(session, metadata);
  const marketplaceProductLink = session.shopee_url ?? session.tiktok_url;
  const status = productStatusFromIntake(input?.status);
  const productInput = {
    workspace_id: session.workspace_id ?? undefined,
    product_code: readIntakeText(input?.product_code) || buildProductCodeForIntake(productName, session),
    product_name: productName,
    niche: productNicheFromMetadata(metadata, input?.niche),
    marketplace,
    marketplace_product_link: marketplaceProductLink,
    status,
    notes: normalizeIntakeText(input?.notes) ?? session.raw_notes,
  };

  const existingProduct = session.product_id ? await getProductById(session.product_id) : null;
  const product = existingProduct
    ? await updateProduct(existingProduct.id, {
        workspace_id: existingProduct.workspace_id ?? session.workspace_id ?? undefined,
        product_name: productInput.product_name,
        niche: productInput.niche,
        marketplace: productInput.marketplace,
        marketplace_product_link: productInput.marketplace_product_link,
        status: nextProductStatusForIntake(existingProduct.status, status),
        notes: productInput.notes ?? existingProduct.notes,
      })
    : await createProduct(productInput);

  if (session.product_photo_drive_item_ref_id) {
    const existingProductImages = await listProductImages({ productId: product.id, limit: 1 });

    if (!existingProductImages.length) {
      await attachProductSourceImage({
        productId: product.id,
        driveItemRefId: session.product_photo_drive_item_ref_id,
        isPrimary: true,
        status: "ATTACHED",
        notes: "Auto-attached from intake photo.",
      });
    }
  }

  await updateIntakeSession(session.id, {
    workspace_id: product.workspace_id,
    product_id: product.id,
    status: session.status === "DRAFT" ? "NEEDS_REVIEW" : session.status,
  });

  revalidatePath("/products");
  revalidatePath("/intake");
  revalidatePath(`/products/${product.id}`);
  return product;
}

function manualMetadata(platform: string, session: IntakeSessionRecord): JsonRecord {
  return {
    entry_mode: "manual",
    platform,
    intake_session_id: session.id,
  };
}

function sourceMarketplacesFromMetadata(metadata: IntakeVisionParseOutput): MarketplacePlatform[] {
  if (metadata.marketplace === "Shopee + TikTok") {
    return ["SHOPEE", "TIKTOK"];
  }

  return hasSourceMarketplace(metadata.marketplace) ? [metadata.marketplace] : [];
}

function ocrEvidenceForPlatform(metadata: IntakeVisionParseOutput, platform: MarketplacePlatform): IntakeOcrEvidenceBlock {
  return platform === "SHOPEE" ? metadata.ocr_evidence.shopee_screenshot : metadata.ocr_evidence.tiktok_screenshot;
}

function marketplaceSourceFieldsForPlatform(
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

function visionMarketplaceMetadata(platform: MarketplacePlatform, session: IntakeSessionRecord, metadata: IntakeVisionParseOutput) {
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

async function createMarketplaceSourcesFromVisionEvidence(input: {
  product: ProductRecord;
  session: IntakeSessionRecord;
  metadata: IntakeVisionParseOutput;
  shopeeScreenshotDriveItemRefId: string | null;
  tiktokScreenshotDriveItemRefId: string | null;
}) {
  const title = input.metadata.product_title || input.metadata.nama_produk || input.product.product_name;
  const common = {
    product_id: input.product.id,
    workspace_id: input.product.workspace_id ?? input.session.workspace_id,
    status: "ACTIVE",
  } satisfies Partial<MarketplaceSourceInput>;

  await Promise.all([
    input.shopeeScreenshotDriveItemRefId
      ? createMarketplaceSource({
          ...common,
          ...marketplaceSourceFieldsForPlatform("SHOPEE", input.metadata, title),
          platform: "SHOPEE",
          screenshot_drive_item_ref_id: input.shopeeScreenshotDriveItemRefId,
          parsed_metadata_json: visionMarketplaceMetadata("SHOPEE", input.session, input.metadata),
        } as MarketplaceSourceInput)
      : Promise.resolve(null),
    input.tiktokScreenshotDriveItemRefId
      ? createMarketplaceSource({
          ...common,
          ...marketplaceSourceFieldsForPlatform("TIKTOK", input.metadata, title),
          platform: "TIKTOK",
          screenshot_drive_item_ref_id: input.tiktokScreenshotDriveItemRefId,
          parsed_metadata_json: visionMarketplaceMetadata("TIKTOK", input.session, input.metadata),
        } as MarketplaceSourceInput)
      : Promise.resolve(null),
  ]);
}

export async function createMarketplaceSourcesFromIntake(
  intakeSessionId: string,
  input: {
    shopee?: ManualSourceInput;
    tiktok?: ManualSourceInput;
  },
) {
  const session = await getIntakeSessionById(intakeSessionId);

  if (!session.product_id) {
    throw new Error("Link a product first.");
  }

  const product = await getProductById(session.product_id);

  if (!product) {
    throw new Error("Product not found.");
  }

  const workspaceId = product.workspace_id ?? session.workspace_id ?? undefined;
  const sources: MarketplaceSourceInput[] = [];

  if (input.shopee && (normalizeIntakeText(input.shopee.product_url) || session.shopee_url || normalizeIntakeText(input.shopee.title))) {
    sources.push({
      ...input.shopee,
      product_id: session.product_id,
      workspace_id: workspaceId,
      platform: "SHOPEE",
      product_url: normalizeIntakeText(input.shopee.product_url) ?? session.shopee_url,
      title: normalizeIntakeText(input.shopee.title) ?? session.product_title,
      screenshot_drive_item_ref_id: normalizeIntakeText(input.shopee.screenshot_drive_item_ref_id) ?? session.screenshot_drive_item_ref_id,
      parsed_metadata_json: input.shopee.parsed_metadata_json ?? manualMetadata("SHOPEE", session),
    });
  }

  if (input.tiktok && (normalizeIntakeText(input.tiktok.product_url) || session.tiktok_url || normalizeIntakeText(input.tiktok.title))) {
    sources.push({
      ...input.tiktok,
      product_id: session.product_id,
      workspace_id: workspaceId,
      platform: "TIKTOK",
      product_url: normalizeIntakeText(input.tiktok.product_url) ?? session.tiktok_url,
      title: normalizeIntakeText(input.tiktok.title) ?? session.product_title,
      screenshot_drive_item_ref_id: normalizeIntakeText(input.tiktok.screenshot_drive_item_ref_id) ?? session.screenshot_drive_item_ref_id,
      parsed_metadata_json: input.tiktok.parsed_metadata_json ?? manualMetadata("TIKTOK", session),
    });
  }

  if (!sources.length) {
    throw new Error("Add a source URL or title.");
  }

  const saved = [];

  for (const source of sources) {
    saved.push(await createMarketplaceSource(source));
  }

  revalidatePath("/intake");
  return saved;
}

export async function parseIntakeWithGemini(input: IntakeAnalysisUploadInput) {
  const { supabase, user } = await requireUser();
  assertUploadedImage(input.productImage, "Foto Produk Utama");
  if (input.shopeeScreenshot) {
    assertUploadedImage(input.shopeeScreenshot, "Screenshot Shopee");
  }
  if (input.tiktokScreenshot) {
    assertUploadedImage(input.tiktokScreenshot, "Screenshot TikTok");
  }
  assertHasMarketplaceScreenshot(input);

  const totalBytes = input.productImage.size + (input.shopeeScreenshot?.size ?? 0) + (input.tiktokScreenshot?.size ?? 0);
  const maxFileBytes = Math.max(input.productImage.size, input.shopeeScreenshot?.size ?? 0, input.tiktokScreenshot?.size ?? 0);
  const freshEvidenceCount = 1 + (input.shopeeScreenshot ? 1 : 0) + (input.tiktokScreenshot ? 1 : 0);
  const analysisStartedAt = new Date();
  const requestStartedAt = analysisStartedAt.toISOString();
  const productImageSummary = buildUploadedImageSummary(input.productImage);
  const shopeeScreenshotSummary = input.shopeeScreenshot
    ? buildUploadedImageSummary(input.shopeeScreenshot)
    : buildMissingImageSummary("Screenshot Shopee");
  const tiktokScreenshotSummary = input.tiktokScreenshot
    ? buildUploadedImageSummary(input.tiktokScreenshot)
    : buildMissingImageSummary("Screenshot TikTok");

  let analysisSession: IntakeSessionRecord | null = null;
  let task: AiTaskRecord | null = null;
  let taskWaitingForKey = false;
  let responseText: string | null = null;
  let repairAttempted = false;
  let repairResponseText: string | null = null;
  let selectedKeySelectionForSuccess: GeminiKeySelection | null = null;

  try {
    const createdTask = (await createAITask({
      taskType: "VISION_ANALYSIS",
      inputJson: buildIntakeTaskInput({
        productImage: productImageSummary,
        shopeeScreenshot: shopeeScreenshotSummary,
        tiktokScreenshot: tiktokScreenshotSummary,
        clientContext: null,
        analysisPath: "live_upload",
        freshEvidenceCount,
        savedEvidenceCount: 0,
        clientUploadBytes: totalBytes,
        totalUploadBytes: totalBytes,
        maxFileBytes,
        requestStartedAt,
      }),
      maxRetries: 0,
    })) as AiTaskRecord;
    task = createdTask;

    await markTaskRunning(createdTask.id);

    if (totalBytes > 19 * 1024 * 1024) {
      throw new Error("Total upload terlalu besar untuk analisis Gemini live.");
    }

    const uploadedEvidence = await uploadIntakeEvidenceToDrive(input);
    const draftCapture = await createDurableIntakeCapture(input, uploadedEvidence);
    analysisSession = draftCapture.session;
    const [productImagePart, shopeeScreenshotPart, tiktokScreenshotPart] = await Promise.all([
      buildIntakeAnalysisImagePart(input.productImage, "Foto Produk Utama"),
      input.shopeeScreenshot ? buildIntakeAnalysisImagePart(input.shopeeScreenshot, "Screenshot Shopee") : Promise.resolve(null),
      input.tiktokScreenshot ? buildIntakeAnalysisImagePart(input.tiktokScreenshot, "Screenshot TikTok") : Promise.resolve(null),
    ]);
    const excludedQuotaGroups = new Set<string>();
    const excludedKeyIds = new Set<string>();

    while (!responseText) {
      const selectedKey = await selectGeminiKeyForIntake(user.id, excludedQuotaGroups, excludedKeyIds);

      if (!selectedKey) {
        const message = "No Gemini key is ready for live intake analysis.";
        taskWaitingForKey = true;
        await markTaskWaitingForKey(createdTask.id, message);
        throw new Error(message);
      }

      const { error: taskKeyUpdateError } = await supabase
        .from("ai_tasks")
        .update({
          gemini_api_key_id: selectedKey.key.id,
        })
        .eq("id", createdTask.id)
        .eq("user_id", user.id);

      if (taskKeyUpdateError) {
        throw new Error(taskKeyUpdateError.message);
      }

      try {
        const response = await generateTrackedGeminiJsonText({
          aiTaskId: createdTask.id,
          geminiApiKey: selectedKey.key,
          taskType: "VISION_ANALYSIS",
          userId: user.id,
          request: {
            modelName: selectedKey.key.model_name as GeminiModelName,
            apiKey: selectedKey.secret,
            parts: [
              productImagePart,
              ...(shopeeScreenshotPart ? [shopeeScreenshotPart] : []),
              ...(tiktokScreenshotPart ? [tiktokScreenshotPart] : []),
              {
                text: buildIntakeParsePrompt({
                  productImage: productImageSummary,
                  shopeeScreenshot: input.shopeeScreenshot ? shopeeScreenshotSummary : null,
                  tiktokScreenshot: input.tiktokScreenshot ? tiktokScreenshotSummary : null,
                }),
              },
            ],
            systemInstruction: INTAKE_VISION_SYSTEM_INSTRUCTION,
            temperature: 0.1,
            maxOutputTokens: 4096,
            timeoutMs: 120_000,
            responseJsonSchema: GEMINI_INTAKE_VISION_RESPONSE_SCHEMA,
          },
        });

        selectedKeySelectionForSuccess = selectedKey;
        responseText = response.text;
      } catch (error) {
        if (error instanceof GeminiClientError) {
          if (error.status >= 500) {
            console.warn("[intake.parseIntakeWithGemini] Gemini upstream unavailable", {
              taskId: createdTask.id,
              userId: user.id,
              geminiApiKeyId: selectedKey.key.id,
              modelName: selectedKey.key.model_name,
              status: error.status,
              retryAfterSeconds: error.retryAfterSeconds,
              message: error.message,
            });
          }

          const disposition = getGeminiFailureDisposition(error);

          if (disposition.markKeyError) {
            excludedKeyIds.add(selectedKey.key.id);
            await markGeminiKeyError({
              serviceClient: createSupabaseServiceRoleClient(),
              userId: user.id,
              keyId: selectedKey.key.id,
            }).catch(() => undefined);
            continue;
          }

          if (disposition.markGroupError) {
            excludedQuotaGroups.add(getGeminiQuotaGroupKey(selectedKey.key));
            await markGeminiQuotaGroupError({
              serviceClient: createSupabaseServiceRoleClient(),
              userId: user.id,
              key: selectedKey.key,
            }).catch(() => undefined);
            continue;
          }

          if (disposition.markGroupCooldown) {
            excludedQuotaGroups.add(getGeminiQuotaGroupKey(selectedKey.key));
            await markGeminiQuotaGroupCooldown({
              serviceClient: createSupabaseServiceRoleClient(),
              userId: user.id,
              key: selectedKey.key,
              nextStatus: disposition.nextStatus ?? "RATE_LIMITED",
              cooldownUntil: disposition.cooldownUntil,
            }).catch(() => undefined);
            continue;
          }

          if (disposition.excludeQuotaGroup) {
            excludedQuotaGroups.add(getGeminiQuotaGroupKey(selectedKey.key));
            continue;
          }
        }

        throw error;
      }
    }

    const parsed = await parseIntakeVisionOutputWithRepair({
      rawText: responseText,
      repair: async ({ rawText, prompt }) => {
        repairAttempted = true;
        if (!selectedKeySelectionForSuccess) {
          throw new Error("Missing successful Gemini key selection for intake repair.");
        }

        const repairResult = await repairIntakeVisionOutput({
          rawText,
          prompt,
          userId: user.id,
          taskId: createdTask.id,
          fallbackSelection: selectedKeySelectionForSuccess,
          excludedQuotaGroups,
          excludedKeyIds,
        });

        selectedKeySelectionForSuccess = repairResult.selectedKeySelection;
        repairResponseText = repairResult.responseText;

        return repairResult.responseText;
      },
    });
    const parsedWithEvidenceAvailability = applyMarketplaceEvidenceAvailability(parsed, {
      shopee: Boolean(input.shopeeScreenshot),
      tiktok: Boolean(input.tiktokScreenshot),
    });
    const parsedWithNote: IntakeVisionParseOutput = {
      ...parsedWithEvidenceAvailability,
      confidence_notes: appendUniqueNote(parsedWithEvidenceAvailability.confidence_notes, "Analisis Gemini live dari bytes upload."),
    };
    const parsedJson = toReviewedMetadataJson(parsedWithNote);

    await updateIntakeSessionRecord(supabase, user.id, draftCapture.session.id, {
      product_title: buildIntakeProductTitle(parsedWithNote),
      parsed_metadata_json: parsedJson,
    });

    let product = draftCapture.product;

    try {
      product = await createProductFromIntake(draftCapture.session.id, {
        status: "DRAFT",
      });
    } catch (error) {
      console.warn("[intake.parseIntakeWithGemini] Product sync after metadata analysis failed", {
        sessionId: draftCapture.session.id,
        productId: draftCapture.product.id,
        message: safeErrorMessage(error),
      });
    }

    const finalSession = await getIntakeSessionById(draftCapture.session.id);
    analysisSession = finalSession;

    await createMarketplaceSourcesFromVisionEvidence({
      product,
      session: finalSession,
      metadata: parsedWithNote,
      shopeeScreenshotDriveItemRefId: uploadedEvidence.shopeeScreenshotDriveItem?.id ?? null,
      tiktokScreenshotDriveItemRefId: uploadedEvidence.tiktokScreenshotDriveItem?.id ?? null,
    });

    const requestFinishedAt = new Date().toISOString();
    const requestDurationMs = Math.max(0, Date.now() - analysisStartedAt.getTime());
    const successTelemetry = buildIntakeTelemetryPayload({
      clientContext: null,
      analysisPath: "live_upload",
      freshEvidenceCount,
      savedEvidenceCount: 0,
      clientUploadBytes: totalBytes,
      totalUploadBytes: totalBytes,
      maxFileBytes,
      requestStartedAt,
      requestFinishedAt,
      requestDurationMs,
      repairAttempted,
      repairSuccess: repairAttempted && Boolean(repairResponseText),
      failureKind: null,
      responseTextExcerpt: summarizeIntakeVisionResponseText(responseText),
      repairResponseTextExcerpt: summarizeIntakeVisionResponseText(repairResponseText),
      modelName: selectedKeySelectionForSuccess?.key.model_name ?? null,
    });
    const completedTask = await markTaskSuccess(
      createdTask.id,
      buildParsedMetadataTaskSnapshot(
        parsedWithNote,
        selectedKeySelectionForSuccess?.key.model_name,
        successTelemetry,
        responseText
          ? buildIntakeVisionTaskDiagnostics({
              repairAttempted,
              responseText,
              repairResponseText,
              modelName: selectedKeySelectionForSuccess?.key.model_name ?? null,
            })
          : undefined,
      ),
    );
    if (selectedKeySelectionForSuccess) {
      await markGeminiKeySuccess({
        serviceClient: createSupabaseServiceRoleClient(),
        userId: user.id,
        key: selectedKeySelectionForSuccess.key,
      }).catch(() => undefined);
    }

    revalidatePath("/intake");
    revalidatePath("/products");
    revalidatePath(`/products/${product.id}`);
    return {
      task: completedTask,
      session: finalSession,
      parsed: parsedJson,
      message: "Analisis Gemini selesai. Produk masuk list.",
    };
  } catch (error) {
    const message = safeErrorMessage(error);
    const upstreamStatus = error instanceof GeminiClientError ? error.status : null;
    const upstreamRetryAfterSeconds = error instanceof GeminiClientError ? error.retryAfterSeconds : null;
    const failureKind = classifyIntakeFailureKind({
      errorMessage: message,
      upstreamStatus,
      telemetryFailureKind: null,
      responseText,
      repairAttempted,
      repairResponseText,
    });
    const requestFinishedAt = new Date().toISOString();
    const requestDurationMs = Math.max(0, Date.now() - analysisStartedAt.getTime());
    const failureTelemetry = buildIntakeTelemetryPayload({
      clientContext: null,
      analysisPath: "live_upload",
      freshEvidenceCount,
      savedEvidenceCount: 0,
      clientUploadBytes: totalBytes,
      totalUploadBytes: totalBytes,
      maxFileBytes,
      requestStartedAt,
      requestFinishedAt,
      requestDurationMs,
      repairAttempted,
      repairSuccess: false,
      failureKind,
      upstreamStatus,
      upstreamRetryAfterSeconds,
      responseTextExcerpt: summarizeIntakeVisionResponseText(responseText),
      repairResponseTextExcerpt: summarizeIntakeVisionResponseText(repairResponseText),
      modelName: selectedKeySelectionForSuccess?.key.model_name ?? null,
    });
    const failureDiagnostics = responseText
      ? buildIntakeVisionTaskDiagnostics({
          repairAttempted,
          responseText,
          repairResponseText,
          modelName: selectedKeySelectionForSuccess?.key.model_name ?? null,
        })
      : null;
    const failureMessage = buildIntakeVisionFailureMessage(message, {
      responseText,
      repairAttempted,
      repairResponseText,
    });

    if (task && !taskWaitingForKey) {
      try {
        await markTaskFailed(task.id, failureMessage, {
          retryable: false,
          outputJson: {
            pipeline: "intake_vision",
            analysis_mode: "LIVE_IMAGE_BYTES",
            telemetry: failureTelemetry,
            ...(failureDiagnostics ? { diagnostics: failureDiagnostics } : {}),
          } satisfies JsonRecord,
        });
      } catch {
        // Keep the intake recoverable even if task failure update fails.
      }
    }

    if (analysisSession) {
      try {
        await updateIntakeSessionRecord(supabase, user.id, analysisSession.id, {
          status: "ERROR",
          error_message: failureMessage,
        });
      } catch {
        // Preserve the original failure if the intake row update also fails.
      }
    }

    revalidatePath("/intake");
    throw new Error(failureMessage);
  }
}

export async function createProductAnchorFromIntake(
  intakeSessionId: string,
  input?: {
    anchor_code?: string | null;
    source_product_image_id?: string | null;
    notes?: string | null;
  },
) {
  const { supabase, user } = await requireUser();
  const session = await loadIntakeSessionById(supabase, user.id, intakeSessionId);

  if (!session.product_id) {
    throw new Error("Link a product first.");
  }

  const product = await getProductById(session.product_id);

  if (!product) {
    throw new Error("Product not found.");
  }

  const workspace = await loadIntakeWorkspace(supabase, user.id, session);
  const selectedMetadataJson = session.reviewed_metadata_json ?? session.parsed_metadata_json;

  if (!selectedMetadataJson) {
    throw new Error("Parse metadata first.");
  }

  const metadata = buildReviewedMetadataFromInput(selectedMetadataJson);
  const existingAnchor = (await listProductAnchors({ intakeSessionId: session.id, limit: 10 }))[0] ?? null;
  const requestedSourceImage = input?.source_product_image_id
    ? workspace.productImages.find((image) => image.id === input.source_product_image_id) ?? null
    : null;
  const preservedSourceImage = existingAnchor?.source_product_image_id
    ? workspace.productImages.find((image) => image.id === existingAnchor.source_product_image_id) ?? null
    : null;
  const sourceImage = requestedSourceImage ?? preservedSourceImage ?? workspace.selectedSourceImage;
  const sourceImageDriveItem = sourceImage ? workspace.driveItems.get(sourceImage.drive_item_ref_id) ?? null : null;
  const anchorJson = buildIntakeAnchorJson(
    session,
    {
      ...workspace,
      selectedSourceImage: sourceImage,
      selectedSourceImageDriveItem: sourceImageDriveItem,
    },
    metadata,
  );
  const marketplaceSummaryJson: JsonRecord = {
    selected_marketplace: metadata.marketplace,
    source_count: workspace.marketplaceSources.length,
    platforms: workspace.marketplaceSources.map((source) => source.platform),
    reviewed_metadata: toReviewedMetadataJson(metadata),
  };
  const visionAnalysisJson: JsonRecord = {
    mode: "live_gemini",
    intake_session_id: session.id,
    source_image: buildProductImageSnapshot(sourceImage, sourceImageDriveItem),
    confidence_notes: metadata.confidence_notes,
  };
  const anchorCode = readIntakeText(input?.anchor_code) || existingAnchor?.anchor_code || buildProductAnchorCode(product.product_code);
  const notes = normalizeIntakeText(input?.notes) ?? existingAnchor?.notes ?? session.raw_notes;
  const workspaceId = product.workspace_id ?? session.workspace_id ?? null;

  if (existingAnchor) {
    const { data, error } = await supabase
      .from("product_anchors")
      .update({
        workspace_id: workspaceId,
        product_id: product.id,
        intake_session_id: session.id,
        source_product_image_id: sourceImage?.id ?? null,
        anchor_code: anchorCode,
        version: existingAnchor.version,
        anchor_json: anchorJson,
        vision_analysis_json: visionAnalysisJson,
        marketplace_summary_json: marketplaceSummaryJson,
        status: "READY",
        notes,
      })
      .eq("id", existingAnchor.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await updateIntakeSession(session.id, { status: "ANCHOR_READY" });
    revalidatePath("/intake");
    return data as ProductAnchorRecord;
  }

  const anchor = await createProductAnchor({
    workspace_id: workspaceId,
    product_id: product.id,
    intake_session_id: session.id,
    source_product_image_id: sourceImage?.id ?? null,
    anchor_code: anchorCode,
    version: 1,
    anchor_json: anchorJson,
    vision_analysis_json: visionAnalysisJson,
    marketplace_summary_json: marketplaceSummaryJson,
    status: "READY",
    notes,
  });

  await updateIntakeSession(session.id, { status: "ANCHOR_READY" });
  revalidatePath("/intake");
  return anchor;
}
