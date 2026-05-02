import "server-only";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  MARKETPLACE_PLATFORMS,
  MARKETPLACE_SOURCE_STATUSES,
  type JsonRecord,
  type MarketplacePlatform,
  type MarketplaceSourceStatus,
  isMarketplacePlatform,
  isMarketplaceSourceStatus,
  normalizeIntakeText,
} from "@/lib/intake/validation";

export type MarketplaceSourceRecord = {
  id: string;
  user_id: string;
  product_id: string;
  platform: MarketplacePlatform;
  product_url: string | null;
  affiliate_url: string | null;
  title: string | null;
  category: string | null;
  rating_text: string | null;
  sold_count_text: string | null;
  price_text: string | null;
  shop_name: string | null;
  screenshot_drive_item_ref_id: string | null;
  parsed_metadata_json: JsonRecord | null;
  status: MarketplaceSourceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketplaceSourceInput = {
  product_id: string;
  platform: string;
  product_url?: string | null;
  affiliate_url?: string | null;
  title?: string | null;
  category?: string | null;
  rating_text?: string | null;
  sold_count_text?: string | null;
  price_text?: string | null;
  shop_name?: string | null;
  screenshot_drive_item_ref_id?: string | null;
  parsed_metadata_json?: JsonRecord | null;
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

function assertMarketplacePlatform(value: string): asserts value is MarketplacePlatform {
  if (!isMarketplacePlatform(value)) {
    throw new Error(`Invalid marketplace platform. Expected one of: ${MARKETPLACE_PLATFORMS.join(", ")}.`);
  }
}

function assertMarketplaceSourceStatus(value: string): asserts value is MarketplaceSourceStatus {
  if (!isMarketplaceSourceStatus(value)) {
    throw new Error(`Invalid marketplace source status. Expected one of: ${MARKETPLACE_SOURCE_STATUSES.join(", ")}.`);
  }
}

export async function createMarketplaceSource(input: MarketplaceSourceInput) {
  const { supabase, user } = await requireUser();
  const status = input.status ?? "DRAFT";
  assertMarketplacePlatform(input.platform);
  assertMarketplaceSourceStatus(status);

  const productUrl = normalizeIntakeText(input.product_url);
  const title = normalizeIntakeText(input.title);

  if (!productUrl && !title) {
    throw new Error("Source needs a product URL or title.");
  }

  const { data, error } = await supabase
    .from("product_marketplace_sources")
    .upsert(
      {
        user_id: user.id,
        product_id: input.product_id,
        platform: input.platform,
        product_url: productUrl,
        affiliate_url: normalizeIntakeText(input.affiliate_url),
        title,
        category: normalizeIntakeText(input.category),
        rating_text: normalizeIntakeText(input.rating_text),
        sold_count_text: normalizeIntakeText(input.sold_count_text),
        price_text: normalizeIntakeText(input.price_text),
        shop_name: normalizeIntakeText(input.shop_name),
        screenshot_drive_item_ref_id: normalizeIntakeText(input.screenshot_drive_item_ref_id),
        parsed_metadata_json: input.parsed_metadata_json ?? null,
        status,
        notes: normalizeIntakeText(input.notes),
      },
      { onConflict: "user_id,product_id,platform" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/intake");
  return data as MarketplaceSourceRecord;
}

export async function listProductMarketplaceSources(input?: {
  productId?: string;
  platform?: MarketplacePlatform | string;
  limit?: number;
}) {
  const { supabase, user } = await requireUser();

  if (input?.platform) {
    assertMarketplacePlatform(input.platform);
  }

  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = supabase
    .from("product_marketplace_sources")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.productId) {
    query = query.eq("product_id", input.productId);
  }

  if (input?.platform) {
    query = query.eq("platform", input.platform);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as MarketplaceSourceRecord[];
}
