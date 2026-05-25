import "server-only";

import { revalidatePath } from "next/cache.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createAITask } from "@/lib/server/ai-task-queue";
import {
  isSharePlatform,
  isShareAngle,
  normalizeShareVariantCount,
  type SharePlatform,
  type ShareAngle,
  type ShareGenerateOptions,
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
  ai_task_id: string | null;
  platform: SharePlatform;
  angle: ShareAngle;
  variant_count: number;
  input_params: ShareGenerateOptions | null;
  output_json: ShareGenerationOutputItem[] | null;
  status: ShareGenerationStatus;
  error_message: string | null;
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

async function requireOwnedProduct(input: {
  productId: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
}) {
  const { data, error } = await input.supabase
    .from("products")
    .select("id, product_name, marketplace, niche")
    .eq("user_id", input.userId)
    .eq("id", input.productId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Produk tidak ditemukan.");
  }

  return data as { id: string; product_name: string; marketplace: string | null; niche: string | null };
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
  inputParams?: ShareGenerateOptions;
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

  // Fetch latest intake session metadata if available
  const { data: intakeSession } = await supabase
    .from("product_intake_sessions")
    .select("reviewed_metadata_json, parsed_metadata_json")
    .eq("user_id", user.id)
    .eq("product_id", input.productId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const metadata = intakeSession?.reviewed_metadata_json ?? intakeSession?.parsed_metadata_json ?? null;

  const { data: generation, error } = await supabase
    .from("share_generations")
    .insert({
      user_id: user.id,
      product_id: input.productId,
      platform: input.platform,
      angle: input.angle,
      variant_count: variantCount,
      input_params: input.inputParams ?? null,
      output_json: null,
      status: "generating",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const taskInput = {
    generationId: generation.id,
    productId: input.productId,
    productName: product.product_name,
    affiliateUrl: input.affiliateUrl,
    platform: input.platform as SharePlatform,
    angle: input.angle as ShareAngle,
    variantCount,
    inputParams: input.inputParams ?? null,
    productMarketplace: product.marketplace ?? null,
    productNiche: product.niche ?? null,
    productMetadata: metadata,
  };

  let task: Awaited<ReturnType<typeof createAITask>>;
  try {
    task = await createAITask({
      taskType: "SHARE_CAPTION",
      inputJson: taskInput,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Gagal membuat task share caption.";
    await supabase
      .from("share_generations")
      .update({
        status: "error",
        error_message: errorMessage,
      })
      .eq("id", generation.id)
      .eq("user_id", user.id);
    throw new Error(errorMessage);
  }

  const { error: taskLinkError } = await supabase
    .from("share_generations")
    .update({
      ai_task_id: task.id,
      error_message: null,
    })
    .eq("id", generation.id)
    .eq("user_id", user.id);

  if (taskLinkError) {
    const errorMessage = taskLinkError.message;
    const serviceClient = createSupabaseServiceRoleClient();
    await serviceClient
      .from("share_generations")
      .update({
        status: "error",
        error_message: errorMessage,
      })
      .eq("id", generation.id)
      .eq("user_id", user.id);
    await serviceClient
      .from("ai_tasks")
      .update({
        status: "FAILED",
        error_message: errorMessage,
        finished_at: new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", user.id);
    throw new Error(errorMessage);
  }

  void import("@/lib/server/share-caption-task")
    .then((mod) => mod.runRealShareCaptionTask(task.id, taskInput))
    .catch((error) => {
      const errorMessage = error instanceof Error ? error.message : "Worker share caption gagal dimulai.";
      void (async () => {
        const serviceClient = createSupabaseServiceRoleClient();
        await serviceClient
          .from("share_generations")
          .update({
            status: "error",
            error_message: errorMessage,
          })
          .eq("id", generation.id)
          .eq("user_id", user.id);
        await serviceClient
          .from("ai_tasks")
          .update({
            status: "FAILED",
            error_message: errorMessage,
            finished_at: new Date().toISOString(),
          })
          .eq("id", task.id)
          .eq("user_id", user.id);
      })().catch(() => undefined);
    });

  revalidatePath("/share");
  return { ...(generation as ShareGenerationRecord), ai_task_id: task.id };
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
