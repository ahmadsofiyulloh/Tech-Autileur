import "server-only";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PRODUCT_IMAGE_STATUSES,
  PRODUCT_STATUSES,
  type ProductImageStatus,
  type ProductStatus,
  isProductImageStatus,
  isProductStatus,
} from "@/lib/products/validation";

type ProductRecord = {
  id: string;
  user_id: string;
  product_code: string;
  product_name: string;
  niche: string | null;
  marketplace: string | null;
  marketplace_product_link: string | null;
  status: ProductStatus;
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
  analysis_json: unknown | null;
  status: ProductImageStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ProductInput = {
  id?: string;
  product_code: string;
  product_name: string;
  niche?: string | null;
  marketplace?: string | null;
  marketplace_product_link?: string | null;
  status?: string;
  notes?: string | null;
};

type AttachSourceImageInput = {
  productId: string;
  driveItemRefId: string;
  isPrimary?: boolean;
  status?: string;
  notes?: string | null;
  analysisJson?: unknown | null;
};

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = readText(value);
  return trimmed.length > 0 ? trimmed : null;
}

function assertProductStatus(value: string): asserts value is ProductStatus {
  if (!isProductStatus(value)) {
    throw new Error(`Invalid product status. Expected one of: ${PRODUCT_STATUSES.join(", ")}.`);
  }
}

function assertProductImageStatus(value: string): asserts value is ProductImageStatus {
  if (!isProductImageStatus(value)) {
    throw new Error(`Invalid product image status. Expected one of: ${PRODUCT_IMAGE_STATUSES.join(", ")}.`);
  }
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

function ensureProductCode(value: string) {
  const trimmed = readText(value);

  if (!trimmed) {
    throw new Error("Product code is required.");
  }

  return trimmed.toUpperCase();
}

export function buildProductCode(name: string) {
  const normalized = readText(name)
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase();

  if (!normalized) {
    return "PRODUCT0001";
  }

  return normalized.slice(0, 8).padEnd(8, "0");
}

export async function createProduct(input: ProductInput) {
  const { supabase, user } = await requireUser();
  const status = input.status ?? "DRAFT";
  assertProductStatus(status);

  const { data, error } = await supabase
    .from("products")
    .insert({
      user_id: user.id,
      product_code: ensureProductCode(input.product_code),
      product_name: readText(input.product_name),
      niche: normalizeNullableText(input.niche),
      marketplace: normalizeNullableText(input.marketplace),
      marketplace_product_link: normalizeNullableText(input.marketplace_product_link),
      status,
      notes: normalizeNullableText(input.notes),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/products");
  return data as ProductRecord;
}

export async function listProducts(input?: { status?: ProductStatus | string; limit?: number }) {
  const { supabase, user } = await requireUser();

  if (input?.status) {
    assertProductStatus(input.status);
  }

  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = supabase.from("products").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit);

  if (input?.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProductRecord[];
}

export async function getProductById(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("products").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as ProductRecord | null;
}

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  const { supabase, user } = await requireUser();

  if (input.status) {
    assertProductStatus(input.status);
  }

  const { data, error } = await supabase
    .from("products")
    .update({
      ...(input.product_code !== undefined ? { product_code: ensureProductCode(input.product_code) } : {}),
      ...(input.product_name !== undefined ? { product_name: readText(input.product_name) } : {}),
      ...(input.niche !== undefined ? { niche: normalizeNullableText(input.niche) } : {}),
      ...(input.marketplace !== undefined ? { marketplace: normalizeNullableText(input.marketplace) } : {}),
      ...(input.marketplace_product_link !== undefined
        ? { marketplace_product_link: normalizeNullableText(input.marketplace_product_link) }
        : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: normalizeNullableText(input.notes) } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/products");
  return data as ProductRecord;
}

export async function archiveProduct(id: string) {
  return await updateProduct(id, { status: "ARCHIVED" });
}

export async function listProductImages(input?: { productId?: string; limit?: number }) {
  const { supabase, user } = await requireUser();

  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = supabase
    .from("product_images")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.productId) {
    query = query.eq("product_id", input.productId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProductImageRecord[];
}

export async function attachProductSourceImage(input: AttachSourceImageInput) {
  const { supabase, user } = await requireUser();
  const status = input.status ?? "ATTACHED";
  assertProductImageStatus(status);

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", input.productId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (productError) {
    throw new Error(productError.message);
  }

  if (!product) {
    throw new Error("Product not found.");
  }

  const { data: driveItem, error: driveItemError } = await supabase
    .from("drive_items")
    .select("id")
    .eq("id", input.driveItemRefId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (driveItemError) {
    throw new Error(driveItemError.message);
  }

  if (!driveItem) {
    throw new Error("Drive item not found.");
  }

  const { data, error } = await supabase
    .from("product_images")
    .upsert(
      {
        user_id: user.id,
        product_id: input.productId,
        drive_item_ref_id: input.driveItemRefId,
        source_type: "GOOGLE_DRIVE",
        is_primary: input.isPrimary ?? false,
        analysis_json: input.analysisJson ?? null,
        status,
        notes: normalizeNullableText(input.notes),
      },
      {
        onConflict: "user_id,product_id,drive_item_ref_id",
      },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/products");
  return data as ProductImageRecord;
}
