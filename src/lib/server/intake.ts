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
import { decryptGeminiApiKey } from "@/lib/server/gemini-crypto";
import { GeminiClientError } from "@/lib/server/gemini-client";
import { generateTrackedGeminiJsonText } from "@/lib/server/gemini-usage-events";
import {
  appendUniqueNote,
  normalizeIntakeVisionOutput,
  parseIntakeVisionOutput,
  type IntakeVisionParseOutput,
} from "@/lib/intake/vision-contract";
import {
  INTAKE_STATUSES,
  type IntakeStatus,
  type JsonRecord,
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
  markGeminiKeySuccess,
  markGeminiQuotaGroupCooldown,
  type GeminiRoutableKey,
} from "@/lib/server/gemini-key-routing";
import { createDriveItem, getDriveItemById } from "@/lib/server/drive-items";
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
import { uploadFileToGoogleDrive } from "@/lib/server/google-drive";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
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
  shopeeScreenshot: File;
  tiktokScreenshot: File;
};

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function readJsonText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

  return normalizeIntakeVisionOutput({
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
  });
}

function toReviewedMetadataJson(metadata: IntakeVisionParseOutput) {
  return {
    ...metadata,
  } satisfies JsonRecord;
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

function productStatusFromIntake(session: IntakeSessionRecord, requestedStatus?: string | null) {
  const status = readIntakeText(requestedStatus);

  if (status) {
    return status;
  }

  return session.parsed_metadata_json || session.reviewed_metadata_json ? "IMAGE_ANALYZED" : "DRAFT";
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
  shopeeScreenshot: { name: string; mimeType: string; size: number };
  tiktokScreenshot: { name: string; mimeType: string; size: number };
}) {
  return [
    "You are analysing uploaded product evidence for a single-owner operator workflow.",
    "Return JSON only. Do not use markdown, code fences, or commentary.",
    "Return exactly one JSON object with these keys and no extras:",
    '{ "nama_produk": "", "keyword_cari_etalase": "", "deskripsi_visual": "", "use_case": "", "pain_point": "", "selling_angle": "", "target_viewer": "", "product_title": "", "marketplace": "", "category": "", "rating_text": "", "sold_count_text": "", "price_text": "", "shop_name": "", "visible_product_attributes": [], "risk_notes": [], "confidence_notes": [] }',
    "Use short operator-friendly Indonesian values.",
    "Analyse the uploaded product image, Shopee screenshot, and TikTok screenshot bytes directly.",
    "If a field is unknown, return an empty string or empty array.",
    "Do not claim visual parsing from links.",
    "",
    "Uploaded evidence:",
    JSON.stringify(
      {
        product_image: input.productImage,
        shopee_screenshot: input.shopeeScreenshot,
        tiktok_screenshot: input.tiktokScreenshot,
      },
      null,
      2,
    ),
  ].join("\n");
}

function buildParsedMetadataTaskSnapshot(metadata: IntakeVisionParseOutput) {
  return {
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
  } satisfies JsonRecord;
}

function buildIntakeTaskInput(input: {
  productImage: { name: string; mimeType: string; size: number };
  shopeeScreenshot: { name: string; mimeType: string; size: number };
  tiktokScreenshot: { name: string; mimeType: string; size: number };
}) {
  return {
    analysis_mode: "LIVE_IMAGE_BYTES",
    image_bytes_available: true,
    product_image: input.productImage,
    shopee_screenshot: input.shopeeScreenshot,
    tiktok_screenshot: input.tiktokScreenshot,
  } satisfies JsonRecord;
}

function buildIntakeProductTitle(metadata: IntakeVisionParseOutput) {
  return readIntakeText(metadata.nama_produk) || readIntakeText(metadata.keyword_cari_etalase) || "Intake Tanpa Nama";
}

async function buildIntakeAnalysisImagePart(file: File) {
  const buffer = await file.arrayBuffer();

  return {
    inline_data: {
      mime_type: file.type || "application/octet-stream",
      data: Buffer.from(buffer).toString("base64"),
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
  if (!session.product_id || !hasSourceMarketplace(metadata.marketplace)) {
    return;
  }

  const { data: source, error } = await supabase
    .from("product_marketplace_sources")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", session.product_id)
    .eq("platform", metadata.marketplace)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!source) {
    return;
  }

  const { error: updateError } = await supabase
    .from("product_marketplace_sources")
    .update({
      parsed_metadata_json: toReviewedMetadataJson(metadata),
    })
    .eq("id", source.id)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function readGeminiSecretForKey(
  serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
  geminiKeyId: string,
) {
  const { data, error } = await serviceClient
    .from("gemini_api_key_secrets")
    .select("encrypted_api_key")
    .eq("gemini_api_key_id", geminiKeyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.encrypted_api_key) {
    return null;
  }

  return decryptGeminiApiKey(data.encrypted_api_key);
}

async function selectGeminiKeyForIntake(userId: string, excludedQuotaGroups: ReadonlySet<string> = new Set()) {
  const serviceClient = createSupabaseServiceRoleClient();
  const geminiKeys = await listQuotaAwareGeminiKeys({
    userId,
    purpose: "VISION_ANALYSIS",
    excludedQuotaGroups,
    serviceClient,
  });

  for (const geminiKey of geminiKeys) {
    const secret = await readGeminiSecretForKey(serviceClient, userId, geminiKey.id);

    if (!secret) {
      continue;
    }

    return {
      key: geminiKey,
      secret,
      role: geminiKey.role,
    };
  }

  return null;
}

async function updateIntakeSessionRecord(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  id: string,
  input: Partial<Pick<IntakeSessionInput, "status" | "error_message" | "parsed_metadata_json" | "reviewed_metadata_json">>,
) {
  const { data, error } = await supabase
    .from("product_intake_sessions")
    .update({
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

function assertUploadedImage(file: File, label: string) {
  if (!(file instanceof File)) {
    throw new Error(`${label} is required.`);
  }

  if (!file.size) {
    throw new Error(`${label} cannot be empty.`);
  }

  if (!file.type.startsWith("image/")) {
    throw new Error(`${label} must be an image file.`);
  }
}

function buildUploadedImageSummary(file: File) {
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

function readDrivePath(value: string | null | undefined) {
  const trimmed = readText(value);
  return trimmed ? trimmed.replace(/\/+$/g, "") : "";
}

function sanitizeDriveLeafName(value: string) {
  const trimmed = readText(value);

  if (!trimmed) {
    return "upload.bin";
  }

  return trimmed.replace(/[\\/:*?"<>|]+/g, "-");
}

function readDrivePathSegments(value: string | null | undefined) {
  return readDrivePath(value)
    .split("/")
    .map((segment) => readText(segment))
    .filter((segment) => segment.length > 0)
    .map((segment) => sanitizeDriveLeafName(segment))
    .filter((segment) => segment.length > 0);
}

function buildIntakeDrivePath(input: {
  workspaceCode: string;
  workspaceDrivePath: string | null;
  intakeCode: string;
  folderLabel: string;
  fileName: string;
}) {
  const rootSegments = readDrivePathSegments(input.workspaceDrivePath);
  const fallbackRootSegments = [`AffiliateAI`, "02_WORKSPACES", input.workspaceCode, "ROOT_FOLDER"].map(sanitizeDriveLeafName);
  const folderSegments = readDrivePathSegments(input.folderLabel);
  const intakeFolder = sanitizeDriveLeafName(input.intakeCode);
  const fileName = sanitizeDriveLeafName(input.fileName);
  const segments = rootSegments.length ? rootSegments : fallbackRootSegments;

  return [...segments, "INTAKE", intakeFolder, ...folderSegments, fileName].filter(Boolean).join("/");
}

async function uploadIntakeEvidenceToDrive(input: {
  productImage: File;
  shopeeScreenshot: File;
  tiktokScreenshot: File;
}) {
  const workspace = await getCurrentWorkspace();

  if (!workspace) {
    throw new Error("Pilih workspace aktif dulu.");
  }

  if (!workspace.drive_root_folder_ref_id) {
    throw new Error("Folder Drive Utama belum diisi.");
  }

  const rootFolder = await getDriveItemById(workspace.drive_root_folder_ref_id);

  if (!rootFolder?.drive_item_id) {
    throw new Error("Folder Drive Utama belum tersinkron ke Google Drive.");
  }

  const intakeCode = `INTAKE-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
  const uploads = [
    {
      file: input.productImage,
      folderLabel: "SOURCE_IMAGES",
      name: sanitizeDriveLeafName(input.productImage.name) || "product-image",
      notes: "Foto Produk Utama",
      purpose: "SOURCE_IMAGE" as const,
    },
    {
      file: input.shopeeScreenshot,
      folderLabel: "SCREENSHOTS/SHOPEE",
      name: sanitizeDriveLeafName(input.shopeeScreenshot.name) || "shopee-screenshot",
      notes: "Screenshot Shopee",
      purpose: "OTHER" as const,
    },
    {
      file: input.tiktokScreenshot,
      folderLabel: "SCREENSHOTS/TIKTOK",
      name: sanitizeDriveLeafName(input.tiktokScreenshot.name) || "tiktok-screenshot",
      notes: "Screenshot TikTok",
      purpose: "OTHER" as const,
    },
  ] as const;

  const results = [];

  for (const upload of uploads) {
    const uploaded = await uploadFileToGoogleDrive({
      file: upload.file,
      name: upload.name,
      description: upload.notes,
      parentFolderId: rootFolder.drive_item_id,
    });
    const drivePath = buildIntakeDrivePath({
      workspaceCode: workspace.workspace_code,
      workspaceDrivePath: workspace.drive_root_folder_path,
      intakeCode,
      folderLabel: upload.folderLabel,
      fileName: upload.file.name,
    });

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
      purpose: upload.purpose,
      status: "ACTIVE",
      notes: upload.notes,
    });

    results.push({
      ...uploaded,
      driveItem,
    });
  }

  return {
    workspace,
    intakeCode,
    productImageDriveItem: results[0]?.driveItem ?? null,
    shopeeScreenshotDriveItem: results[1]?.driveItem ?? null,
    tiktokScreenshotDriveItem: results[2]?.driveItem ?? null,
  };
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
        status: nextProductStatusForIntake(product.status, "IMAGE_ANALYZED"),
      });
      revalidatePath(`/products/${product.id}`);
    }
  }

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
  const status = productStatusFromIntake(session, input?.status);
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

function visionMarketplaceMetadata(platform: string, session: IntakeSessionRecord, metadata: IntakeVisionParseOutput) {
  return {
    entry_mode: "gemini_vision",
    platform,
    intake_session_id: session.id,
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
    title,
    category: input.metadata.category,
    rating_text: input.metadata.rating_text,
    sold_count_text: input.metadata.sold_count_text,
    price_text: input.metadata.price_text,
    shop_name: input.metadata.shop_name,
    status: "ACTIVE",
  } satisfies Partial<MarketplaceSourceInput>;

  await Promise.all([
    input.shopeeScreenshotDriveItemRefId
      ? createMarketplaceSource({
          ...common,
          platform: "SHOPEE",
          screenshot_drive_item_ref_id: input.shopeeScreenshotDriveItemRefId,
          parsed_metadata_json: visionMarketplaceMetadata("SHOPEE", input.session, input.metadata),
        } as MarketplaceSourceInput)
      : Promise.resolve(null),
    input.tiktokScreenshotDriveItemRefId
      ? createMarketplaceSource({
          ...common,
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
  assertUploadedImage(input.shopeeScreenshot, "Screenshot Shopee");
  assertUploadedImage(input.tiktokScreenshot, "Screenshot TikTok");

  const totalBytes = input.productImage.size + input.shopeeScreenshot.size + input.tiktokScreenshot.size;

  if (totalBytes > 19 * 1024 * 1024) {
    throw new Error("Total upload terlalu besar untuk analisis Gemini live.");
  }

  const uploadedEvidence = await uploadIntakeEvidenceToDrive(input);
  const productImageSummary = buildUploadedImageSummary(input.productImage);
  const shopeeScreenshotSummary = buildUploadedImageSummary(input.shopeeScreenshot);
  const tiktokScreenshotSummary = buildUploadedImageSummary(input.tiktokScreenshot);
  const task = (await createAITask({
    taskType: "VISION_ANALYSIS",
    inputJson: buildIntakeTaskInput({
      productImage: productImageSummary,
      shopeeScreenshot: shopeeScreenshotSummary,
      tiktokScreenshot: tiktokScreenshotSummary,
    }),
    maxRetries: 0,
  })) as AiTaskRecord;

  let analysisSession: IntakeSessionRecord | null = null;

  try {
    const selectedKey = await selectGeminiKeyForIntake(user.id);

    if (!selectedKey) {
      throw new Error("No Gemini key is ready for live intake analysis.");
    }

    const { error: taskKeyUpdateError } = await supabase
      .from("ai_tasks")
      .update({
        gemini_api_key_id: selectedKey.key.id,
      })
      .eq("id", task.id)
      .eq("user_id", user.id);

    if (taskKeyUpdateError) {
      throw new Error(taskKeyUpdateError.message);
    }

    await markTaskRunning(task.id);

    const [productImagePart, shopeeScreenshotPart, tiktokScreenshotPart] = await Promise.all([
      buildIntakeAnalysisImagePart(input.productImage),
      buildIntakeAnalysisImagePart(input.shopeeScreenshot),
      buildIntakeAnalysisImagePart(input.tiktokScreenshot),
    ]);

    const response = await generateTrackedGeminiJsonText({
      aiTaskId: task.id,
      geminiApiKey: selectedKey.key,
      taskType: "VISION_ANALYSIS",
      userId: user.id,
      request: {
        modelName: selectedKey.key.model_name as GeminiModelName,
        apiKey: selectedKey.secret,
        parts: [
          productImagePart,
          shopeeScreenshotPart,
          tiktokScreenshotPart,
          {
            text: buildIntakeParsePrompt({
              productImage: productImageSummary,
              shopeeScreenshot: shopeeScreenshotSummary,
              tiktokScreenshot: tiktokScreenshotSummary,
            }),
          },
        ],
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });

    const parsed = parseIntakeVisionOutput(response.text);
    const parsedWithNote: IntakeVisionParseOutput = {
      ...parsed,
      confidence_notes: appendUniqueNote(parsed.confidence_notes, "Analisis Gemini live dari bytes upload."),
    };
    const parsedJson = toReviewedMetadataJson(parsedWithNote);

    analysisSession = await createIntakeSession({
      product_title: buildIntakeProductTitle(parsedWithNote),
      parsed_metadata_json: parsedJson,
      product_photo_drive_item_ref_id: uploadedEvidence.productImageDriveItem?.id ?? null,
      screenshot_drive_item_ref_id: uploadedEvidence.shopeeScreenshotDriveItem?.id ?? null,
      status: "NEEDS_REVIEW",
    });
    const product = await createProductFromIntake(analysisSession.id, {
      status: "IMAGE_ANALYZED",
    });

    analysisSession = {
      ...analysisSession,
      product_id: product.id,
      workspace_id: product.workspace_id,
    };

    const completedTask = await markTaskSuccess(task.id, buildParsedMetadataTaskSnapshot(parsedWithNote));

    revalidatePath("/intake");
    revalidatePath("/products");
    revalidatePath(`/products/${product.id}`);
    return {
      task: completedTask,
      session: analysisSession,
      parsed: parsedJson,
      message: "Analisis Gemini selesai. Produk masuk list.",
    };
  } catch (error) {
    const message = safeErrorMessage(error);

    try {
      await markTaskFailed(task.id, message, { retryable: false });
    } catch {
      // Keep the intake recoverable even if task failure update fails.
    }

    if (analysisSession) {
      try {
        await updateIntakeSessionRecord(supabase, user.id, analysisSession.id, {
          status: "ERROR",
          error_message: message,
        });
      } catch {
        // Preserve the original failure if the intake row update also fails.
      }
    }

    revalidatePath("/intake");
    throw new Error(message);
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
