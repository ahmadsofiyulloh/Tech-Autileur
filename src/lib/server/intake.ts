import "server-only";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  INTAKE_STATUSES,
  type IntakeStatus,
  type JsonRecord,
  hasMinimumIntakeInput,
  isIntakeStatus,
  normalizeIntakeText,
  readIntakeText,
} from "@/lib/intake/validation";
import { buildProductCode, createProduct, getProductById } from "@/lib/server/products";
import { buildProductAnchorCode, createProductAnchor } from "@/lib/server/product-anchors";
import {
  type MarketplaceSourceInput,
  createMarketplaceSource,
} from "@/lib/server/product-marketplace-sources";

export type IntakeSessionRecord = {
  id: string;
  user_id: string;
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

async function getIntakeSessionById(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("product_intake_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Intake not found.");
  }

  return data as IntakeSessionRecord;
}

function intakePayload(input: IntakeSessionInput) {
  return {
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

export async function createIntakeSession(input: IntakeSessionInput) {
  const { supabase, user } = await requireUser();
  const status = input.status ?? "DRAFT";
  assertIntakeStatus(status);

  if (!hasMinimumIntakeInput(input)) {
    throw new Error("Add a title, link, Drive ref, or notes.");
  }

  const { data, error } = await supabase
    .from("product_intake_sessions")
    .insert({
      user_id: user.id,
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

export async function listIntakeSessions(input?: { status?: IntakeStatus | string; limit?: number }) {
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
      ...intakePayload(input),
      ...(input.status ? { status: input.status } : {}),
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
  return await updateIntakeSession(id, {
    reviewed_metadata_json: metadata,
    status: "REVIEWED",
  });
}

export async function linkProductToIntake(intakeSessionId: string, productId: string) {
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("Product not found.");
  }

  return await updateIntakeSession(intakeSessionId, {
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
  },
) {
  const session = await getIntakeSessionById(intakeSessionId);
  const productName = readIntakeText(input?.product_name) || readIntakeText(session.product_title);

  if (!productName) {
    throw new Error("Product title is required.");
  }

  const marketplace = session.shopee_url ? "SHOPEE" : session.tiktok_url ? "TIKTOK" : null;
  const marketplaceProductLink = session.shopee_url ?? session.tiktok_url;
  const product = await createProduct({
    product_code: readIntakeText(input?.product_code) || buildProductCode(productName),
    product_name: productName,
    niche: normalizeIntakeText(input?.niche),
    marketplace,
    marketplace_product_link: marketplaceProductLink,
    status: "DRAFT",
    notes: normalizeIntakeText(input?.notes) ?? session.raw_notes,
  });

  await updateIntakeSession(session.id, {
    product_id: product.id,
    status: session.status === "DRAFT" ? "NEEDS_REVIEW" : session.status,
  });

  revalidatePath("/products");
  revalidatePath("/intake");
  return product;
}

function manualMetadata(platform: string, session: IntakeSessionRecord): JsonRecord {
  return {
    entry_mode: "manual",
    platform,
    intake_session_id: session.id,
  };
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

  const sources: MarketplaceSourceInput[] = [];

  if (input.shopee && (normalizeIntakeText(input.shopee.product_url) || session.shopee_url || normalizeIntakeText(input.shopee.title))) {
    sources.push({
      ...input.shopee,
      product_id: session.product_id,
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

export async function createProductAnchorFromIntake(
  intakeSessionId: string,
  input?: {
    anchor_code?: string | null;
    source_product_image_id?: string | null;
    notes?: string | null;
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

  const anchor = await createProductAnchor({
    product_id: product.id,
    intake_session_id: session.id,
    source_product_image_id: normalizeIntakeText(input?.source_product_image_id),
    anchor_code: readIntakeText(input?.anchor_code) || buildProductAnchorCode(product.product_code),
    version: 1,
    anchor_json: {
      entry_mode: "manual_intake",
      intake_session_id: session.id,
      product_title: session.product_title,
      shopee_url: session.shopee_url,
      tiktok_url: session.tiktok_url,
    },
    vision_analysis_json: null,
    marketplace_summary_json: session.reviewed_metadata_json,
    status: "DRAFT",
    notes: normalizeIntakeText(input?.notes),
  });

  await updateIntakeSession(session.id, { status: "ANCHOR_READY" });
  revalidatePath("/intake");
  return anchor;
}
