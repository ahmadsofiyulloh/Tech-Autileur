import "server-only";

import { revalidatePath } from "next/cache.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isSharePlatform,
  isShareAngle,
  normalizeShareVariantCount,
  type SharePlatform,
  type ShareAngle,
} from "@/lib/share/share-platform";

type ShareGenerationStatus = "generating" | "generated" | "error";

type ShareGenerationOutputItem = {
  caption: string;
  angle: ShareAngle;
  platform: SharePlatform;
  platform_specific_fields?: Record<string, unknown>;
};

type ShareGenerationRecord = {
  id: string;
  user_id: string;
  product_id: string;
  platform: SharePlatform;
  angle: ShareAngle;
  variant_count: number;
  output_json: ShareGenerationOutputItem[] | null;
  status: ShareGenerationStatus;
  error_message: string | null;
  created_at: string;
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

function assertSharePlatform(value: string): asserts value is SharePlatform {
  if (!isSharePlatform(value)) {
    throw new Error(`Invalid share platform: ${value}`);
  }
}

function assertShareAngle(value: string): asserts value is ShareAngle {
  if (!isShareAngle(value)) {
    throw new Error(`Invalid share angle: ${value}`);
  }
}

const platformCopyHints: Record<SharePlatform, string> = {
  facebook: "Cocok untuk post komunitas dan feed.",
  threads: "Cocok untuk percakapan singkat.",
  x: "Cocok untuk update ringkas.",
  pinterest: "Cocok untuk pin inspirasi produk.",
};

const angleHooks: Record<ShareAngle, string> = {
  benefit_focused: "Fokus ke manfaat utama yang langsung terasa.",
  problem_solution: "Mulai dari masalah harian lalu arahkan ke solusi.",
  social_proof: "Tampilkan alasan produk ini layak dipercaya.",
  urgency_scarcity: "Tekankan momentum tanpa klaim stok palsu.",
  educational: "Beri konteks edukatif yang membantu pembeli memilih.",
  storytelling: "Buka dengan cerita pendek seputar pemakaian produk.",
};

async function requireOwnedProduct(input: {
  productId: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
}) {
  const { data, error } = await input.supabase
    .from("products")
    .select("id, product_name")
    .eq("user_id", input.userId)
    .eq("id", input.productId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Produk tidak ditemukan.");
  }

  return data as { id: string; product_name: string };
}

function buildMockShareOutput(input: {
  affiliateUrl: string;
  angle: ShareAngle;
  platform: SharePlatform;
  productName: string;
  variantCount: number;
}): ShareGenerationOutputItem[] {
  return Array.from({ length: input.variantCount }, (_, index) => {
    const variantNumber = index + 1;

    return {
      caption: [
        `${input.productName} - varian ${variantNumber}.`,
        angleHooks[input.angle],
        platformCopyHints[input.platform],
        `Cek link affiliate: ${input.affiliateUrl}`,
      ].join(" "),
      angle: input.angle,
      platform: input.platform,
      platform_specific_fields: {
        affiliate_url: input.affiliateUrl,
        mode: "mock",
        variant_index: variantNumber,
      },
    };
  });
}

export async function getLatestShareGeneration(input: { productId: string; platform: SharePlatform }) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("share_generations")
    .select("*")
    .eq("user_id", user.id)
    .eq("product_id", input.productId)
    .eq("platform", input.platform)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as ShareGenerationRecord | null;
}

export async function listShareGenerationHistory(input: {
  productId: string;
  platform: SharePlatform;
  limit?: number;
}) {
  const { supabase, user } = await requireUser();
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

  const { data, error } = await supabase
    .from("share_generations")
    .select("*")
    .eq("user_id", user.id)
    .eq("product_id", input.productId)
    .eq("platform", input.platform)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ShareGenerationRecord[];
}

export async function listLatestGenerationsByProducts(input: {
  productIds: string[];
  platform: SharePlatform;
}) {
  if (!input.productIds.length) {
    return [] as ShareGenerationRecord[];
  }

  const { supabase, user } = await requireUser();

  // Fetch latest generation per product for the given platform.
  // We fetch all and deduplicate in-memory since Supabase doesn't support
  // DISTINCT ON via the JS client.
  const { data, error } = await supabase
    .from("share_generations")
    .select("*")
    .eq("user_id", user.id)
    .eq("platform", input.platform)
    .in("product_id", input.productIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ShareGenerationRecord[];
  const seen = new Set<string>();
  const latest: ShareGenerationRecord[] = [];

  for (const row of rows) {
    if (!seen.has(row.product_id)) {
      seen.add(row.product_id);
      latest.push(row);
    }
  }

  return latest;
}

export async function createShareGeneration(input: {
  affiliateUrl: string;
  productId: string;
  platform: string;
  angle: string;
  variantCount: number;
}) {
  assertSharePlatform(input.platform);
  assertShareAngle(input.angle);

  const { supabase, user } = await requireUser();
  const variantCount = normalizeShareVariantCount(input.variantCount);
  const product = await requireOwnedProduct({
    productId: input.productId,
    supabase,
    userId: user.id,
  });
  const outputJson = buildMockShareOutput({
    affiliateUrl: input.affiliateUrl,
    angle: input.angle,
    platform: input.platform,
    productName: product.product_name,
    variantCount,
  });

  const { data, error } = await supabase
    .from("share_generations")
    .insert({
      user_id: user.id,
      product_id: input.productId,
      platform: input.platform,
      angle: input.angle,
      variant_count: variantCount,
      output_json: outputJson,
      status: "generated",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/share");
  return data as ShareGenerationRecord;
}

export async function updateShareGenerationOutput(input: {
  id: string;
  outputJson: ShareGenerationOutputItem[];
}) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("share_generations")
    .update({
      output_json: input.outputJson,
      status: "generated",
    })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/share");
  return data as ShareGenerationRecord;
}

export async function updateShareGenerationError(input: {
  id: string;
  errorMessage: string;
}) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("share_generations")
    .update({
      status: "error",
      error_message: input.errorMessage,
    })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/share");
  return data as ShareGenerationRecord;
}

export type { ShareGenerationRecord, ShareGenerationOutputItem, ShareGenerationStatus };
