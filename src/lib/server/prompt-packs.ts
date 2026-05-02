import "server-only";

import { revalidatePath } from "next/cache";
import {
  createAITask,
  markTaskFailed,
  markTaskRunning,
  markTaskSuccess,
  markTaskWaitingForKey,
  PROMPT_PACK_GEMINI_KEY_PRIORITY,
  listAvailableGeminiKeysByRole,
} from "@/lib/server/ai-task-queue";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PROMPT_PACK_STATUSES,
  type PromptPackStatus,
  isPromptPackStatus,
  normalizePromptCode,
} from "@/lib/prompts/validation";
import type { GeminiModelName } from "@/lib/gemini/validation";
import { decryptGeminiApiKey } from "@/lib/server/gemini-crypto";
import { GeminiClientError, generateGeminiJsonText } from "@/lib/server/gemini-client";
import {
  parsePromptPackGenerationOutput,
  type JsonObject,
  type PromptPackGenerationOutput,
} from "@/lib/prompts/prompt-pack-contract";

type ProductRecord = {
  id: string;
  user_id: string;
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
  analysis_json: unknown | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PromptPackRecord = {
  id: string;
  user_id: string;
  product_id: string;
  source_product_image_id: string | null;
  prompt_code: string;
  version: number;
  status: PromptPackStatus;
  product_analysis_json: JsonObject | null;
  i2i_prompts_json: JsonObject | null;
  i2v_prompts_json: JsonObject | null;
  consistency_rules_json: JsonObject | null;
  ai_task_id: string | null;
  error_message: string | null;
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
  input_json: JsonObject;
  output_json: JsonObject | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type PromptPackInput = {
  product_id: string;
  source_product_image_id?: string | null;
  prompt_code: string;
  version?: number;
  status?: string;
  product_analysis_json?: JsonObject | null;
  i2i_prompts_json?: JsonObject | null;
  i2v_prompts_json?: JsonObject | null;
  consistency_rules_json?: JsonObject | null;
  error_message?: string | null;
  notes?: string | null;
};

type PromptPackUpdateInput = Partial<PromptPackInput>;

type MockPromptContext = {
  promptPack: PromptPackRecord;
  product: ProductRecord;
  sourceProductImage: ProductImageRecord | null;
  sourceDriveItem: { id: string; name: string; drive_path: string; drive_url: string; mime_type: string | null } | null;
};

type PromptPackGenerationTaskInput = {
  promptPack: PromptPackRecord;
  product: ProductRecord;
  sourceProductImage: ProductImageRecord | null;
  sourceDriveItem: { id: string; name: string; drive_path: string; drive_url: string; mime_type: string | null } | null;
};

type PromptPackGenerationMode = "mock" | "gemini";

type PromptPackGenerationContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>;
  user: { id: string };
  promptPack: PromptPackRecord;
  product: ProductRecord;
  sourceProductImage: ProductImageRecord | null;
  sourceDriveItem: { id: string; name: string; drive_path: string; drive_url: string; mime_type: string | null } | null;
};

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = readText(value);
  return trimmed.length > 0 ? trimmed : null;
}

function assertPromptPackStatus(value: string): asserts value is PromptPackStatus {
  if (!isPromptPackStatus(value)) {
    throw new Error(`Invalid prompt pack status. Expected one of: ${PROMPT_PACK_STATUSES.join(", ")}.`);
  }
}

function ensurePromptVersion(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Prompt version must be a whole number greater than or equal to 1.");
  }

  return value;
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

async function requireOwnedProduct(productId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("products")
    .select("id, user_id, product_code, product_name, niche, marketplace, marketplace_product_link, status, notes, created_at, updated_at")
    .eq("id", productId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Product not found.");
  }

  return { supabase, user, product: data as ProductRecord };
}

async function requireOwnedProductImage(productImageId: string, productId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("product_images")
    .select("id, user_id, product_id, drive_item_ref_id, source_type, is_primary, analysis_json, status, notes, created_at, updated_at")
    .eq("id", productImageId)
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Source product image not found.");
  }

  return { supabase, user, productImage: data as ProductImageRecord };
}

async function requireOwnedPromptPack(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("prompt_packs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Prompt pack not found.");
  }

  return { supabase, user, promptPack: data as PromptPackRecord };
}

async function loadPromptPackGenerationContext(promptPackId: string) {
  const { supabase, user, promptPack } = await requireOwnedPromptPack(promptPackId);
  const serviceClient = createSupabaseServiceRoleClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, user_id, product_code, product_name, niche, marketplace, marketplace_product_link, status, notes, created_at, updated_at")
    .eq("id", promptPack.product_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (productError) {
    throw new Error(productError.message);
  }

  if (!product) {
    throw new Error("Product not found.");
  }

  const sourceProductImage = promptPack.source_product_image_id
    ? (
        await supabase
          .from("product_images")
          .select("id, user_id, product_id, drive_item_ref_id, source_type, is_primary, analysis_json, status, notes, created_at, updated_at")
          .eq("id", promptPack.source_product_image_id)
          .eq("user_id", user.id)
          .eq("product_id", promptPack.product_id)
          .maybeSingle()
      ).data ?? null
    : await getPrimaryProductImageForPromptPack(promptPack.product_id);

  if (promptPack.source_product_image_id && !sourceProductImage) {
    throw new Error("Source product image not found.");
  }

  const sourceDriveItem =
    sourceProductImage
      ? (
          await supabase
            .from("drive_items")
            .select("id, name, drive_path, drive_url, mime_type")
            .eq("id", sourceProductImage.drive_item_ref_id)
            .eq("user_id", user.id)
            .maybeSingle()
        ).data ?? null
      : null;

  return {
    supabase,
    serviceClient,
    user,
    promptPack: promptPack as PromptPackRecord,
    product: product as ProductRecord,
    sourceProductImage: sourceProductImage as ProductImageRecord | null,
    sourceDriveItem: sourceDriveItem as PromptPackGenerationContext["sourceDriveItem"],
  };
}

function buildPromptPackAnalysis(context: MockPromptContext): JsonObject {
  const { promptPack, product, sourceProductImage, sourceDriveItem } = context;

  return {
    mode: "mock",
    prompt_code: promptPack.prompt_code,
    version: promptPack.version,
    product: {
      id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      niche: product.niche,
      marketplace: product.marketplace,
      marketplace_product_link: product.marketplace_product_link,
      status: product.status,
    },
    source_image: sourceProductImage
      ? {
          id: sourceProductImage.id,
          is_primary: sourceProductImage.is_primary,
          status: sourceProductImage.status,
          source_type: sourceProductImage.source_type,
          drive_item_ref_id: sourceProductImage.drive_item_ref_id,
          drive_item: sourceDriveItem,
        }
      : null,
    coverage: {
      vision_analysis: 1,
      i2i_prompts: 4,
      i2v_prompts: 2,
    },
    vision_analysis: {
      summary: `Mock vision analysis for ${product.product_name} (${promptPack.prompt_code} v${promptPack.version}).`,
      hero_direction: "Highlight the core product and keep the composition production-safe for later prompt tuning.",
      scene_constraints: [
        "Keep the product centered in the frame.",
        "Preserve the dominant brand colors.",
        "Avoid introducing extra objects that do not exist in the source image.",
      ],
      risks: sourceProductImage
        ? ["Mock output only. Replace with Gemini vision analysis after live runner work lands."]
        : [
            "No source product image is attached yet.",
            "Mock output only. Replace with Gemini vision analysis after live runner work lands.",
          ],
    },
  };
}

function buildI2IPrompts(context: MockPromptContext): JsonObject {
  const { promptPack, product, sourceProductImage } = context;

  const sourceLabel = sourceProductImage
    ? `source image row ${sourceProductImage.id}`
    : "an attached source image row";

  return {
    clip_01_start_frame: {
      slot: "clip_01_start_frame",
      prompt: `Mock i2i prompt for the opening frame of clip 1 for ${product.product_name} (${promptPack.prompt_code} v${promptPack.version}). Keep it aligned with ${sourceLabel}.`,
      composition: "Start-frame composition with stable lighting and product-first framing.",
    },
    clip_01_last_frame: {
      slot: "clip_01_last_frame",
      prompt: `Mock i2i prompt for the last frame of clip 1 for ${product.product_name}. Match the product silhouette and end pose from the opening frame.`,
      composition: "End-frame composition with matched perspective and color consistency.",
    },
    clip_02_start_frame: {
      slot: "clip_02_start_frame",
      prompt: `Mock i2i prompt for the opening frame of clip 2 for ${product.product_name}. Keep the hero product readable and keep the scene clean.`,
      composition: "Second opening frame with a slightly different camera angle but identical product identity.",
    },
    clip_02_last_frame: {
      slot: "clip_02_last_frame",
      prompt: `Mock i2i prompt for the last frame of clip 2 for ${product.product_name}. End with a tidy composition and clear product focus.`,
      composition: "Second end frame with motion-safe spacing and stable packaging details.",
    },
  };
}

function buildI2VPrompts(context: MockPromptContext): JsonObject {
  const { promptPack, product, sourceProductImage } = context;
  const sourceLabel = sourceProductImage ? `source image row ${sourceProductImage.id}` : "the product reference";

  return {
    clip_01: {
      slot: "clip_01",
      prompt: `Mock i2v prompt for clip 1 of ${product.product_name} (${promptPack.prompt_code} v${promptPack.version}). Use ${sourceLabel} as the visual anchor.`,
      motion_notes: "Keep motion subtle, clean, and product-safe.",
    },
    clip_02: {
      slot: "clip_02",
      prompt: `Mock i2v prompt for clip 2 of ${product.product_name}. Continue the same product identity and maintain smooth motion continuity.`,
      motion_notes: "Use the same brand palette and preserve the key silhouette.",
    },
  };
}

function buildConsistencyRules(context: MockPromptContext): JsonObject {
  const { promptPack, product, sourceProductImage } = context;

  return {
    mode: "mock",
    prompt_code: promptPack.prompt_code,
    version: promptPack.version,
    product_name: product.product_name,
    rules: [
      "Keep product identity and proportions consistent across all clips.",
      "Do not invent props, text, or packaging that are not visible in the source reference.",
      "Keep the palette, light direction, and product silhouette stable.",
      "Preserve the same product-first composition in every slot.",
      sourceProductImage ? "Treat the selected source product image row as the canonical visual anchor." : "Attach a primary source image row before live generation.",
    ],
  };
}

function buildPromptPackTaskInput(context: MockPromptContext, generationMode: PromptPackGenerationMode) {
  return {
    prompt_pack_id: context.promptPack.id,
    prompt_code: context.promptPack.prompt_code,
    version: context.promptPack.version,
    product_id: context.product.id,
    product_code: context.product.product_code,
    source_product_image_id: context.sourceProductImage?.id ?? null,
    source_drive_item_id: context.sourceProductImage?.drive_item_ref_id ?? null,
    mode: generationMode,
  };
}

function buildPromptPackGenerationPrompt(context: PromptPackGenerationContext, selectedGeminiKey: { id: string; label: string; model_name: string; role: string }) {
  const { promptPack, product, sourceProductImage, sourceDriveItem } = context;

  const sourceImageSection = sourceProductImage
    ? {
        id: sourceProductImage.id,
        is_primary: sourceProductImage.is_primary,
        status: sourceProductImage.status,
        source_type: sourceProductImage.source_type,
        drive_item_ref_id: sourceProductImage.drive_item_ref_id,
        drive_item: sourceDriveItem,
      }
    : null;

  return [
    "You are generating a structured prompt pack for a single-owner affiliate content workflow.",
    "Return JSON only. Do not use markdown, code fences, or commentary.",
    "The JSON object must contain exactly these top-level keys: product_analysis_json, i2i_prompts_json, i2v_prompts_json, consistency_rules_json.",
    "Do not omit required keys. Do not add unrelated prose.",
    "Required slots:",
    "- i2i_prompts_json: clip_01_start_frame, clip_01_last_frame, clip_02_start_frame, clip_02_last_frame",
    "- i2v_prompts_json: clip_01, clip_02",
    "Each i2i slot object must include slot, prompt, and composition.",
    "Each i2v slot object must include slot, prompt, and motion_notes.",
    "product_analysis_json must include mode, prompt_code, version, product, source_image, coverage, and vision_analysis.",
    "consistency_rules_json must include mode, prompt_code, version, product_name, and rules.",
    "",
    "Context:",
    JSON.stringify(
      {
        prompt_pack: {
          id: promptPack.id,
          prompt_code: promptPack.prompt_code,
          version: promptPack.version,
          status: promptPack.status,
        },
        product: {
          id: product.id,
          product_code: product.product_code,
          product_name: product.product_name,
          niche: product.niche,
          marketplace: product.marketplace,
          marketplace_product_link: product.marketplace_product_link,
          status: product.status,
        },
        source_image: sourceImageSection,
        generation_policy: {
          model_name: selectedGeminiKey.model_name,
          key_label: selectedGeminiKey.label,
          key_role: selectedGeminiKey.role,
        },
        required_output_shape: {
          product_analysis_json: {
            mode: "gemini",
            prompt_code: promptPack.prompt_code,
            version: promptPack.version,
            product: "object",
            source_image: "object-or-null",
            coverage: {
              vision_analysis: 1,
              i2i_prompts: 4,
              i2v_prompts: 2,
            },
            vision_analysis: {
              summary: "string",
              hero_direction: "string",
              scene_constraints: "string[]",
              risks: "string[]",
            },
          },
          i2i_prompts_json: {
            clip_01_start_frame: { slot: "clip_01_start_frame", prompt: "string", composition: "string" },
            clip_01_last_frame: { slot: "clip_01_last_frame", prompt: "string", composition: "string" },
            clip_02_start_frame: { slot: "clip_02_start_frame", prompt: "string", composition: "string" },
            clip_02_last_frame: { slot: "clip_02_last_frame", prompt: "string", composition: "string" },
          },
          i2v_prompts_json: {
            clip_01: { slot: "clip_01", prompt: "string", motion_notes: "string" },
            clip_02: { slot: "clip_02", prompt: "string", motion_notes: "string" },
          },
          consistency_rules_json: {
            mode: "gemini",
            prompt_code: promptPack.prompt_code,
            version: promptPack.version,
            product_name: product.product_name,
            rules: ["string[]"],
          },
        },
      },
      null,
      2,
    ),
  ].join("\n");
}

export async function getPrimaryProductImageForPromptPack(productId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("product_images")
    .select("id, user_id, product_id, drive_item_ref_id, source_type, is_primary, analysis_json, status, notes, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .eq("is_primary", true)
    .in("status", ["ATTACHED", "ANALYZED"])
    .order("created_at", { ascending: true })
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as ProductImageRecord | null;
}

function sanitizeGeminiFailureMessage(error: unknown) {
  if (error instanceof GeminiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Prompt pack generation failed.";
}

async function updatePromptPackGenerationResult(
  context: PromptPackGenerationContext,
  taskId: string,
  outputJson: PromptPackGenerationOutput,
) {
  const { data, error } = await context.supabase
    .from("prompt_packs")
    .update({
      ai_task_id: taskId,
      status: "GENERATED",
      error_message: null,
      product_analysis_json: outputJson.product_analysis_json,
      i2i_prompts_json: outputJson.i2i_prompts_json,
      i2v_prompts_json: outputJson.i2v_prompts_json,
      consistency_rules_json: outputJson.consistency_rules_json,
    })
    .eq("id", context.promptPack.id)
    .eq("user_id", context.user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prompts");
  return data as PromptPackRecord;
}

async function updatePromptPackGenerationFailure(context: PromptPackGenerationContext, taskId: string, message: string) {
  const { error } = await context.supabase
    .from("prompt_packs")
    .update({
      ai_task_id: taskId,
      status: "ERROR",
      error_message: message,
    })
    .eq("id", context.promptPack.id)
    .eq("user_id", context.user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createPromptPackGenerationTask(
  promptPackId: string,
  options?: { maxRetries?: number; generationMode?: PromptPackGenerationMode },
) {
  const context = await loadPromptPackGenerationContext(promptPackId);
  const generationMode = options?.generationMode ?? "gemini";
  const maxRetries = options?.maxRetries ?? 3;

  const taskInput = buildPromptPackTaskInput(
    {
      promptPack: context.promptPack,
      product: context.product,
      sourceProductImage: context.sourceProductImage,
      sourceDriveItem: context.sourceDriveItem,
    },
    generationMode,
  );

  const task = (await createAITask({
    taskType: "PROMPT_PACK_GENERATION",
    inputJson: taskInput,
    maxRetries,
  })) as AiTaskRecord;

  const { data, error } = await context.supabase
    .from("prompt_packs")
    .update({
      ai_task_id: task.id,
      status: "QUEUED",
      error_message: null,
    })
    .eq("id", promptPackId)
    .eq("user_id", context.user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prompts");
  return {
    promptPack: data as PromptPackRecord,
    task,
    taskInput,
    context,
  };
}

export async function completePromptPackFromMockTask(promptPackId: string, taskId: string) {
  const context = await loadPromptPackGenerationContext(promptPackId);
  const mockContext: MockPromptContext = {
    promptPack: context.promptPack,
    product: context.product,
    sourceProductImage: context.sourceProductImage,
    sourceDriveItem: context.sourceDriveItem,
  };

  const outputJson = {
    product_analysis_json: buildPromptPackAnalysis(mockContext),
    i2i_prompts_json: buildI2IPrompts(mockContext),
    i2v_prompts_json: buildI2VPrompts(mockContext),
    consistency_rules_json: buildConsistencyRules(mockContext),
  } as PromptPackGenerationOutput;

  const promptPack = await updatePromptPackGenerationResult(context, taskId, outputJson);

  return {
    promptPack,
    outputJson,
  };
}

export async function runMockPromptPackTask(promptPackId: string, taskId: string) {
  await markTaskRunning(taskId);

  try {
    const completed = await completePromptPackFromMockTask(promptPackId, taskId);
    const task = await markTaskSuccess(taskId, completed.outputJson);

    return {
      task,
      promptPack: completed.promptPack,
      message: "Mock prompt pack output generated.",
    };
  } catch (error) {
    const message = sanitizeGeminiFailureMessage(error);
    try {
      await markTaskFailed(taskId, message, { retryable: false });
    } catch {
      // Preserve the original error if task failure update also fails.
    }

    try {
      const context = await loadPromptPackGenerationContext(promptPackId);
      await updatePromptPackGenerationFailure(context, taskId, message);
    } catch {
      // Preserve the original error if prompt pack failure update also fails.
    }

    throw new Error(message);
  }
}

type GeminiSelectedKey = {
  id: string;
  user_id: string;
  key_code: string;
  label: string;
  provider: string;
  google_account_label: string | null;
  project_label: string | null;
  model_name: string;
  role: string;
  rpm_limit: number | null;
  rpd_limit: number | null;
  tpm_limit: number | null;
  requests_today: number;
  last_used_at: string | null;
  cooldown_until: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

async function readGeminiSecretForKey(context: PromptPackGenerationContext, geminiKeyId: string) {
  const { data, error } = await context.serviceClient
    .from("gemini_api_key_secrets")
    .select("encrypted_api_key")
    .eq("gemini_api_key_id", geminiKeyId)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.encrypted_api_key) {
    return null;
  }

  return decryptGeminiApiKey(data.encrypted_api_key);
}

async function updateGeminiKeyOperationalStatus(
  context: PromptPackGenerationContext,
  geminiKeyId: string,
  nextStatus: "RATE_LIMITED" | "COOLDOWN",
  cooldownUntil: string | null,
) {
  const { error } = await context.serviceClient
    .from("gemini_api_keys")
    .update({
      status: nextStatus,
      cooldown_until: cooldownUntil,
    })
    .eq("id", geminiKeyId)
    .eq("user_id", context.user.id);

  if (error) {
    throw new Error(error.message);
  }
}

function buildGeminiKeySelectionLabel(key: GeminiSelectedKey) {
  return `${key.label} (${key.model_name})`;
}

export async function runRealPromptPackTask(promptPackId: string, taskId: string) {
  const context = await loadPromptPackGenerationContext(promptPackId);
  await markTaskRunning(taskId);

  let selectedKey: GeminiSelectedKey | null = null;
  let selectedSecret: string | null = null;
  let selectedRole: string | null = null;

  for (const role of PROMPT_PACK_GEMINI_KEY_PRIORITY) {
    const geminiKeys = (await listAvailableGeminiKeysByRole(role)) as GeminiSelectedKey[];

    for (const geminiKey of geminiKeys) {
      const secret = await readGeminiSecretForKey(context, geminiKey.id);

      if (!secret) {
        continue;
      }

      selectedKey = geminiKey;
      selectedSecret = secret;
      selectedRole = role;
      break;
    }

    if (selectedKey) {
      break;
    }
  }

  if (!selectedKey || !selectedSecret || !selectedRole) {
    const message = "No eligible Gemini key is available for prompt-pack generation.";
    const waitingTask = await markTaskWaitingForKey(taskId, message);
    return {
      task: waitingTask,
      promptPack: context.promptPack,
      message,
    };
  }

  const { error: taskKeyUpdateError } = await context.serviceClient
    .from("ai_tasks")
    .update({
      gemini_api_key_id: selectedKey.id,
    })
    .eq("id", taskId)
    .eq("user_id", context.user.id);

  if (taskKeyUpdateError) {
    const message = sanitizeGeminiFailureMessage(new Error(taskKeyUpdateError.message));
    await markTaskFailed(taskId, message, { retryable: false }).catch(() => undefined);
    throw new Error(message);
  }

  const { error: generatingUpdateError } = await context.supabase
    .from("prompt_packs")
    .update({
      ai_task_id: taskId,
      status: "GENERATING",
      error_message: null,
    })
    .eq("id", promptPackId)
    .eq("user_id", context.user.id);

  if (generatingUpdateError) {
    const message = sanitizeGeminiFailureMessage(new Error(generatingUpdateError.message));
    await markTaskFailed(taskId, message, { retryable: false }).catch(() => undefined);
    throw new Error(message);
  }

  const prompt = buildPromptPackGenerationPrompt(context, selectedKey);

  try {
    const response = await generateGeminiJsonText({
      modelName: selectedKey.model_name as GeminiModelName,
      apiKey: selectedSecret,
      prompt,
      temperature: 0.2,
      maxOutputTokens: 8192,
    });

    const parsed = parsePromptPackGenerationOutput(response.text);
    const outputJson = {
      product_analysis_json: parsed.product_analysis_json,
      i2i_prompts_json: parsed.i2i_prompts_json,
      i2v_prompts_json: parsed.i2v_prompts_json,
      consistency_rules_json: parsed.consistency_rules_json,
    } as PromptPackGenerationOutput;

    const promptPack = await updatePromptPackGenerationResult(context, taskId, outputJson);
    const task = await markTaskSuccess(taskId, outputJson);

    await context.serviceClient
      .from("gemini_api_keys")
      .update({
        requests_today: selectedKey.requests_today + 1,
        last_used_at: new Date().toISOString(),
        status: "ACTIVE",
        cooldown_until: null,
      })
      .eq("id", selectedKey.id)
      .eq("user_id", context.user.id);

    return {
      task,
      promptPack,
      message: `Prompt pack generated with Gemini using ${buildGeminiKeySelectionLabel(selectedKey)}.`,
    };
  } catch (error) {
    if (error instanceof GeminiClientError && error.status === 429) {
      const retryAfterSeconds = error.retryAfterSeconds ?? 900;
      const cooldownUntil = new Date(Date.now() + retryAfterSeconds * 1000).toISOString();
      const nextStatus = retryAfterSeconds > 0 ? "COOLDOWN" : "RATE_LIMITED";

      try {
        await updateGeminiKeyOperationalStatus(context, selectedKey.id, nextStatus, cooldownUntil);
      } catch {
        // Ignore key status update failures so the prompt pack failure still reports cleanly.
      }

      const retryTask = await markTaskFailed(taskId, error.message, { retryable: true });

      if (retryTask.status === "RETRYING") {
        await context.supabase
          .from("prompt_packs")
          .update({
            ai_task_id: taskId,
            status: "QUEUED",
            error_message: null,
          })
          .eq("id", promptPackId)
          .eq("user_id", context.user.id);

        return {
          task: retryTask,
          promptPack: context.promptPack,
          message: `Gemini rate limited. Prompt pack task will retry later. Using ${buildGeminiKeySelectionLabel(selectedKey)}.`,
        };
      }

      const exhaustedMessage = "Gemini rate limit was reached and retries were exhausted.";

      try {
        await updatePromptPackGenerationFailure(context, taskId, exhaustedMessage);
      } catch {
        // Preserve the original retry exhaustion state if prompt pack update also fails.
      }

      return {
        task: retryTask,
        promptPack: context.promptPack,
        message: exhaustedMessage,
      };
    }

    const message = sanitizeGeminiFailureMessage(error);

    const failedTask = await markTaskFailed(taskId, message, { retryable: false });

    try {
      await updatePromptPackGenerationFailure(context, taskId, message);
    } catch {
      // Preserve the original failure if prompt pack update also fails.
    }

    return {
      task: failedTask,
      promptPack: context.promptPack,
      message,
    };
  }
}

export async function createMockPromptPackOutput(id: string) {
  const created = await createPromptPackGenerationTask(id, { generationMode: "mock", maxRetries: 0 });
  const completed = await runMockPromptPackTask(id, created.task.id);

  return completed.promptPack;
}

export async function listPromptPacks(input?: { productId?: string; status?: PromptPackStatus | string; limit?: number }) {
  const { supabase, user } = await requireUser();

  if (input?.status) {
    assertPromptPackStatus(input.status);
  }

  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = supabase
    .from("prompt_packs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.productId) {
    query = query.eq("product_id", input.productId);
  }

  if (input?.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PromptPackRecord[];
}

export async function getPromptPackById(id: string) {
  const { promptPack } = await requireOwnedPromptPack(id);
  return promptPack;
}

export async function createPromptPack(input: PromptPackInput) {
  const { supabase, user } = await requireOwnedProduct(input.product_id);
  const status = input.status ?? "DRAFT";
  assertPromptPackStatus(status);
  const version = ensurePromptVersion(input.version ?? 1);
  const sourceProductImageId = normalizeNullableText(input.source_product_image_id);

  if (sourceProductImageId) {
    await requireOwnedProductImage(sourceProductImageId, input.product_id);
  }

  const { data, error } = await supabase
    .from("prompt_packs")
    .insert({
      user_id: user.id,
      product_id: input.product_id,
      source_product_image_id: sourceProductImageId,
      prompt_code: normalizePromptCode(input.prompt_code),
      version,
      status,
      product_analysis_json: input.product_analysis_json ?? null,
      i2i_prompts_json: input.i2i_prompts_json ?? null,
      i2v_prompts_json: input.i2v_prompts_json ?? null,
      consistency_rules_json: input.consistency_rules_json ?? null,
      ai_task_id: null,
      error_message: normalizeNullableText(input.error_message),
      notes: normalizeNullableText(input.notes),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prompts");
  return data as PromptPackRecord;
}

export async function updatePromptPack(id: string, input: PromptPackUpdateInput) {
  const { supabase, user, promptPack } = await requireOwnedPromptPack(id);

  if (input.status) {
    assertPromptPackStatus(input.status);
  }

  const nextProductId = input.product_id ?? promptPack.product_id;
  const nextSourceProductImageId =
    input.source_product_image_id === undefined
      ? promptPack.source_product_image_id
      : normalizeNullableText(input.source_product_image_id);

  if (input.product_id) {
    await requireOwnedProduct(input.product_id);
  }

  if (nextSourceProductImageId) {
    await requireOwnedProductImage(nextSourceProductImageId, nextProductId);
  }

  const { data, error } = await supabase
    .from("prompt_packs")
    .update({
      ...(input.product_id !== undefined ? { product_id: input.product_id } : {}),
      ...(input.source_product_image_id !== undefined
        ? { source_product_image_id: nextSourceProductImageId }
        : input.product_id !== undefined
          ? { source_product_image_id: null }
          : {}),
      ...(input.prompt_code !== undefined ? { prompt_code: normalizePromptCode(input.prompt_code) } : {}),
      ...(input.version !== undefined ? { version: ensurePromptVersion(input.version) } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.product_analysis_json !== undefined ? { product_analysis_json: input.product_analysis_json } : {}),
      ...(input.i2i_prompts_json !== undefined ? { i2i_prompts_json: input.i2i_prompts_json } : {}),
      ...(input.i2v_prompts_json !== undefined ? { i2v_prompts_json: input.i2v_prompts_json } : {}),
      ...(input.consistency_rules_json !== undefined ? { consistency_rules_json: input.consistency_rules_json } : {}),
      ...(input.error_message !== undefined ? { error_message: normalizeNullableText(input.error_message) } : {}),
      ...(input.notes !== undefined ? { notes: normalizeNullableText(input.notes) } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prompts");
  return data as PromptPackRecord;
}

export async function archivePromptPack(id: string) {
  return await updatePromptPack(id, { status: "ARCHIVED" });
}
