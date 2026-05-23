import "server-only";

import { revalidatePath } from "next/cache.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ShareProductLinkRecord = {
  id: string;
  user_id: string;
  product_id: string;
  affiliate_url: string;
  created_at: string;
  updated_at: string;
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

function normalizeAffiliateUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Affiliate URL wajib diisi.");
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Affiliate URL harus berupa URL http atau https.");
    }

    return parsed.toString();
  } catch (error) {
    if (error instanceof Error && error.message.includes("http")) {
      throw error;
    }

    throw new Error("Affiliate URL tidak valid.");
  }
}

export async function getShareProductLink(productId: string) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("share_product_links")
    .select("*")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as ShareProductLinkRecord | null;
}

export async function listShareProductLinks(productIds: string[]) {
  if (!productIds.length) {
    return [] as ShareProductLinkRecord[];
  }

  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("share_product_links")
    .select("*")
    .eq("user_id", user.id)
    .in("product_id", productIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ShareProductLinkRecord[];
}

export async function upsertShareProductLink(input: { productId: string; affiliateUrl: string }) {
  const { supabase, user } = await requireUser();
  const affiliateUrl = normalizeAffiliateUrl(input.affiliateUrl);

  const { data, error } = await supabase
    .from("share_product_links")
    .upsert(
      {
        user_id: user.id,
        product_id: input.productId,
        affiliate_url: affiliateUrl,
      },
      {
        onConflict: "user_id,product_id",
      },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/share");
  return data as ShareProductLinkRecord;
}

export type { ShareProductLinkRecord };
