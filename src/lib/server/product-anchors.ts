import "server-only";

import { revalidatePath } from "next/cache.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PRODUCT_ANCHOR_STATUSES,
  type JsonRecord,
  type ProductAnchorStatus,
  isProductAnchorStatus,
  normalizeIntakeText,
  readIntakeText,
} from "@/lib/intake/validation";
import { normalizeNullableWorkspaceUuid } from "@/lib/workspaces/validation";

export type ProductAnchorRecord = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  product_id: string;
  intake_session_id: string | null;
  source_product_image_id: string | null;
  anchor_code: string;
  version: number;
  anchor_json: JsonRecord | null;
  vision_analysis_json: JsonRecord | null;
  marketplace_summary_json: JsonRecord | null;
  status: ProductAnchorStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductAnchorInput = {
  product_id: string;
  workspace_id?: string | null;
  intake_session_id?: string | null;
  source_product_image_id?: string | null;
  anchor_code: string;
  version?: number | string | null;
  anchor_json?: JsonRecord | null;
  vision_analysis_json?: JsonRecord | null;
  marketplace_summary_json?: JsonRecord | null;
  status?: string;
  notes?: string | null;
};

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

function assertProductAnchorStatus(value: string): asserts value is ProductAnchorStatus {
  if (!isProductAnchorStatus(value)) {
    throw new Error(`Invalid anchor status. Expected one of: ${PRODUCT_ANCHOR_STATUSES.join(", ")}.`);
  }
}

function normalizeVersion(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 1;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("Anchor version must be 1 or higher.");
  }

  return parsed;
}

function normalizeAnchorCode(value: string) {
  const normalized = readIntakeText(value).toUpperCase();

  if (!normalized) {
    throw new Error("Anchor code is required.");
  }

  return normalized;
}

async function resolveProductWorkspaceId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  productId: string,
) {
  const { data, error } = await supabase
    .from("products")
    .select("id, workspace_id")
    .eq("id", productId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Product not found.");
  }

  return typeof data.workspace_id === "string" ? data.workspace_id : null;
}

export function buildProductAnchorCode(value: string) {
  const normalized = readIntakeText(value)
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase();

  return `${(normalized || "PRODUCT").slice(0, 12)}-ANCHOR`;
}

export async function createProductAnchor(input: ProductAnchorInput) {
  const { supabase, user } = await requireUser();
  const status = input.status ?? "DRAFT";
  assertProductAnchorStatus(status);
  const productWorkspaceId = await resolveProductWorkspaceId(supabase, user.id, input.product_id);
  const workspaceId =
    input.workspace_id !== undefined ? normalizeNullableWorkspaceUuid(input.workspace_id) : productWorkspaceId;

  const { data, error } = await supabase
    .from("product_anchors")
    .insert({
      user_id: user.id,
      workspace_id: workspaceId,
      product_id: input.product_id,
      intake_session_id: normalizeIntakeText(input.intake_session_id),
      source_product_image_id: normalizeIntakeText(input.source_product_image_id),
      anchor_code: normalizeAnchorCode(input.anchor_code),
      version: normalizeVersion(input.version),
      anchor_json: input.anchor_json ?? null,
      vision_analysis_json: input.vision_analysis_json ?? null,
      marketplace_summary_json: input.marketplace_summary_json ?? null,
      status,
      notes: normalizeIntakeText(input.notes),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/intake");
  return data as ProductAnchorRecord;
}

export async function listProductAnchors(input?: {
  productId?: string;
  intakeSessionId?: string;
  workspaceId?: string | null;
  limit?: number;
}) {
  const { supabase, user } = await requireUser();
  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = supabase
    .from("product_anchors")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.productId) {
    query = query.eq("product_id", input.productId);
  }

  if (input?.intakeSessionId) {
    query = query.eq("intake_session_id", input.intakeSessionId);
  }

  if (input?.workspaceId) {
    query = query.eq("workspace_id", input.workspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProductAnchorRecord[];
}

export async function getLatestProductAnchor(input: {
  productId: string;
  workspaceId?: string | null;
  intakeSessionId?: string | null;
}) {
  const anchors = await listProductAnchors({
    productId: input.productId,
    intakeSessionId: input.intakeSessionId ?? undefined,
    workspaceId: input.workspaceId ?? undefined,
    limit: 1,
  });

  return anchors[0] ?? null;
}
