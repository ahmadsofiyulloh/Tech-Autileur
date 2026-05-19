import "server-only";

import { revalidatePath } from "next/cache.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProductById } from "@/lib/server/products";
import { getPromptPackById } from "@/lib/server/prompt-packs";

export type ContentRecord = {
  id: string;
  user_id: string;
  product_id: string;
  content_code: string;
  platform: string | null;
  hook_type: string | null;
  angle: string | null;
  caption_tiktok: string | null;
  caption_shopee: string | null;
  tags_tiktok: unknown | null;
  tags_shopee: unknown | null;
  prompt_pack_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type ContentInput = {
  product_id: string;
  content_code?: string;
  platform?: string | null;
  hook_type?: string | null;
  angle?: string | null;
  caption_tiktok?: string | null;
  caption_shopee?: string | null;
  tags_tiktok?: unknown | null;
  tags_shopee?: unknown | null;
  prompt_pack_id?: string | null;
  status?: string;
};

type ContentUpdateInput = Partial<ContentInput>;

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = readText(value);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStatus(value: string | null | undefined, fallback = "DRAFT") {
  const trimmed = readText(value);
  return trimmed ? trimmed.toUpperCase() : fallback;
}

function buildContentCode(productCode: string | null | undefined) {
  const base = readText(productCode).replace(/[^A-Za-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const prefix = base ? `CONTENT-${base.toUpperCase()}` : "CONTENT";
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
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

async function requireOwnedContent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  contentId: string,
) {
  const { data, error } = await supabase
    .from("contents")
    .select("*")
    .eq("id", contentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Content not found.");
  }

  return data as ContentRecord;
}

async function validateContentReferences(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  productId: string,
  promptPackId?: string | null,
) {
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("Product not found.");
  }

  if (promptPackId) {
    const promptPack = (await getPromptPackById(promptPackId)) as { id: string; product_id: string };

    if (promptPack.product_id !== product.id) {
      throw new Error("Prompt pack must belong to the selected product.");
    }
  }

  return { product };
}

export async function listContents(input?: { productId?: string | null; promptPackId?: string | null; status?: string; limit?: number }) {
  const { supabase, user } = await requireUser();
  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = supabase
    .from("contents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.productId) {
    query = query.eq("product_id", input.productId);
  }

  if (input?.promptPackId) {
    query = query.eq("prompt_pack_id", input.promptPackId);
  }

  if (input?.status) {
    query = query.eq("status", normalizeStatus(input.status));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ContentRecord[];
}

export async function getContentById(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("contents").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as ContentRecord | null;
}

export async function createContent(input: ContentInput) {
  const { supabase, user } = await requireUser();
  const productId = readText(input.product_id);

  if (!productId) {
    throw new Error("Product is required.");
  }

  const promptPackId = normalizeNullableText(input.prompt_pack_id);
  const { product } = await validateContentReferences(supabase, user.id, productId, promptPackId);
  const contentCode = readText(input.content_code) || buildContentCode(product.product_code);

  const { data, error } = await supabase
    .from("contents")
    .insert({
      user_id: user.id,
      product_id: product.id,
      content_code: contentCode.toUpperCase(),
      platform: normalizeNullableText(input.platform),
      hook_type: normalizeNullableText(input.hook_type),
      angle: normalizeNullableText(input.angle),
      caption_tiktok: normalizeNullableText(input.caption_tiktok),
      caption_shopee: normalizeNullableText(input.caption_shopee),
      tags_tiktok: input.tags_tiktok ?? null,
      tags_shopee: input.tags_shopee ?? null,
      prompt_pack_id: promptPackId,
      status: normalizeStatus(input.status),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/controller");
  return data as ContentRecord;
}

export async function updateContent(id: string, input: ContentUpdateInput) {
  const { supabase, user } = await requireUser();
  const current = await requireOwnedContent(supabase, user.id, id);
  const patch: Partial<ContentRecord> = {};

  if (input.product_id !== undefined) {
    const productId = readText(input.product_id);
    if (!productId) {
      throw new Error("Product is required.");
    }

    await validateContentReferences(supabase, user.id, productId, normalizeNullableText(input.prompt_pack_id ?? current.prompt_pack_id));
    patch.product_id = productId;
  }

  if (input.content_code !== undefined) {
    const contentCode = readText(input.content_code);
    if (!contentCode) {
      throw new Error("Content code is required.");
    }

    patch.content_code = contentCode.toUpperCase();
  }

  if (input.platform !== undefined) {
    patch.platform = normalizeNullableText(input.platform);
  }

  if (input.hook_type !== undefined) {
    patch.hook_type = normalizeNullableText(input.hook_type);
  }

  if (input.angle !== undefined) {
    patch.angle = normalizeNullableText(input.angle);
  }

  if (input.caption_tiktok !== undefined) {
    patch.caption_tiktok = normalizeNullableText(input.caption_tiktok);
  }

  if (input.caption_shopee !== undefined) {
    patch.caption_shopee = normalizeNullableText(input.caption_shopee);
  }

  if (input.tags_tiktok !== undefined) {
    patch.tags_tiktok = input.tags_tiktok;
  }

  if (input.tags_shopee !== undefined) {
    patch.tags_shopee = input.tags_shopee;
  }

  if (input.prompt_pack_id !== undefined) {
    const promptPackId = normalizeNullableText(input.prompt_pack_id);
    if (promptPackId) {
      await validateContentReferences(supabase, user.id, input.product_id ?? current.product_id, promptPackId);
    }

    patch.prompt_pack_id = promptPackId;
  }

  if (input.status !== undefined) {
    patch.status = normalizeStatus(input.status, current.status);
  }

  if (!Object.keys(patch).length) {
    throw new Error("No content changes provided.");
  }

  const { data, error } = await supabase
    .from("contents")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/controller");
  return data as ContentRecord;
}

export async function archiveContent(id: string) {
  return await updateContent(id, { status: "ARCHIVED" });
}

export { buildContentCode };

