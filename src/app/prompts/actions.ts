"use server";

import { revalidatePath } from "next/cache.js";
import { redirect } from "next/navigation";
import {
  archivePromptPack,
  cancelPromptPackGenerationTask,
  createPromptPack,
  createPromptPackGenerationTask,
  createPromptPackRegenerationVersion,
  getPromptPackById,
  listPromptPacks,
  markPromptPackReadyForFlow,
  updatePromptPack,
} from "@/lib/server/prompt-packs";
import { exportPromptPackTextFile } from "@/lib/server/prompt-pack-generated-files";
import { getProductById } from "@/lib/server/products";
import { listPromptReadinessProjections } from "@/lib/server/prompt-readiness";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildPromptPackEditorStoragePayload,
  type JsonObject,
  type PromptPackGenerationOptionsJson,
} from "@/lib/prompts/prompt-pack-contract";
import { resolveVideoModel } from "@/lib/prompts/video-model-config";
import { resolveVoLengthPreset } from "@/lib/prompts/vo-length-presets";
import {
  buildContentVariantPromptCode,
  getContentVariant,
  isContentVariantKey,
  type ContentVariantKey,
} from "@/lib/prompts/content-variants";
import { getRegenerationScope, isRegenerationScopeKey } from "@/lib/prompts/prompt-regeneration";
import { PROMPT_CLIP_KEYS, isPromptPackStatus, type PromptClipKey } from "@/lib/prompts/validation";
import {
  getGeminiTemporaryUnavailableRetryMessage,
  isGeminiTemporaryUnavailableMessage,
} from "@/lib/gemini/error-message";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNullableText(formData: FormData, key: string) {
  const value = readText(formData, key);
  return value.length > 0 ? value : null;
}

function readGenerationOptions(formData: FormData): PromptPackGenerationOptionsJson {
  const voEnabled = formData.get("vo_enabled") !== "false";
  const voLengthPreset = resolveVoLengthPreset(formData.get("vo_length_preset"));
  const videoModel = resolveVideoModel(formData.get("video_model"));

  return {
    vo_enabled: voEnabled,
    vo_length_preset: voLengthPreset,
    video_model: videoModel,
  };
}

type GenerationMode = "gemini" | "mock";

const MAX_BULK_PROMPT_PRODUCTS = 50;
const PROMPT_STATE_PROJECTION_STATUSES = new Set(["PROMPT_QUEUED", "PROMPT_GENERATED", "PROMPT_FAILED"]);
const BULK_ENQUEUE_BLOCKING_PROMPT_STATUSES = new Set([
  "QUEUED",
  "GENERATING",
  "GENERATED",
  "NEEDS_REVIEW",
  "APPROVED",
  "ERROR",
]);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Prompt pack operation failed.";
}

function readSafeReturnTo(formData: FormData) {
  const value = readText(formData, "return_to");

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "";
  }

  return value;
}

function appendRedirectMessage(path: string, key: "message" | "error" | "warning", message: string) {
  const [pathname, query = ""] = path.split("?");
  const searchParams = new URLSearchParams(query);
  searchParams.set(key, message);

  return `${pathname}?${searchParams.toString()}`;
}

function promptDetailRedirect(promptPackId: string, key: "message" | "error" | "warning", message: string) {
  const searchParams = new URLSearchParams({ detail: promptPackId });
  return appendRedirectMessage(`/prompts?${searchParams.toString()}`, key, message);
}

function buildPromptRedirectFromForm(
  formData: FormData,
  key: "message" | "error" | "warning",
  message: string,
  productId?: string | null,
) {
  const returnTo = readSafeReturnTo(formData);

  if (returnTo) {
    return appendRedirectMessage(returnTo, key, message);
  }

  const searchParams = new URLSearchParams({ [key]: message });
  const nextProductId = productId ?? readText(formData, "product_id");
  const intakeSessionId = readText(formData, "intake_session_id");
  const affiliateProfileId = readText(formData, "affiliate_profile_id");

  if (nextProductId) {
    searchParams.set("product_id", nextProductId);
  }

  if (intakeSessionId) {
    searchParams.set("intake_id", intakeSessionId);
  }

  if (affiliateProfileId) {
    searchParams.set("affiliate_profile_id", affiliateProfileId);
  }

  return `/prompts?${searchParams.toString()}`;
}

function failFromForm(formData: FormData, message: string): never {
  redirect(buildPromptRedirectFromForm(formData, "error", message));
}

function buildPromptGenerationRedirect(message: string) {
  const isRetryableGeminiError = isGeminiTemporaryUnavailableMessage(message);
  return {
    key: isRetryableGeminiError ? ("warning" as const) : ("error" as const),
    message: isRetryableGeminiError ? getGeminiTemporaryUnavailableRetryMessage() : message,
  };
}

function doneFromForm(formData: FormData, message: string, productId?: string | null): never {
  redirect(buildPromptRedirectFromForm(formData, "message", message, productId));
}

function readSelectedProductIds(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll("product_ids")
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function revalidatePromptRoutes(promptPackId: string, productId?: string | null) {
  revalidatePath("/prompts");
  revalidatePath(`/prompts/${promptPackId}`);
  revalidatePath(`/prompts/${promptPackId}/history`);

  if (productId) {
    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
  }
}

function readGenerationMode(formData: FormData): GenerationMode {
  const value = readText(formData, "generation_mode");

  if (!value || value === "gemini" || value === "mock") {
    return (value || "gemini") as GenerationMode;
  }

  throw new Error("Mode generasi tidak valid.");
}

function readStoredGenerationMode(input: unknown): GenerationMode {
  if (input && typeof input === "object" && !Array.isArray(input) && "mode" in input) {
    return (input as { mode?: unknown }).mode === "mock" ? "mock" : "gemini";
  }

  return "gemini";
}

function readContentVariant(formData: FormData) {
  const value = readText(formData, "content_variant_key") || "hero_hook";

  if (!isContentVariantKey(value)) {
    throw new Error("Varian konten tidak valid.");
  }

  const contentVariant = getContentVariant(value);

  if (!contentVariant) {
    throw new Error("Varian konten tidak valid.");
  }

  return contentVariant;
}

function readRegenerationScopeFromForm(formData: FormData) {
  const value = readText(formData, "regeneration_scope") || "full_pack";

  if (!isRegenerationScopeKey(value)) {
    throw new Error("Lingkup regenerasi tidak valid.");
  }

  return getRegenerationScope(value);
}

function withContentVariantPersonalization(
  personalizationJson: JsonObject | null | undefined,
  contentVariant: NonNullable<ReturnType<typeof getContentVariant>>,
  generationOptions?: PromptPackGenerationOptionsJson,
): JsonObject {
  return {
    ...(personalizationJson ?? {}),
    content_variant: {
      key: contentVariant.key,
      label: contentVariant.label,
      description: contentVariant.description,
      storyGoal: contentVariant.storyGoal,
      hookStrategy: contentVariant.hookStrategy,
      sourcePriority: contentVariant.sourcePriority,
    },
    ...(generationOptions ? { generation_options: generationOptions } : {}),
  };
}

function readVersion(formData: FormData, key: string) {
  const value = readText(formData, key);

  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("Versi prompt harus angka utuh minimal 1.");
  }

  return parsed;
}

function clipFieldName(clipKey: PromptClipKey, field: "i2i_first_frame" | "i2i_last_frame" | "i2v_prompt") {
  return `${clipKey}_${field}`;
}

function readPromptEditorPayload(formData: FormData, existingPersonalization?: unknown) {
  const clips = PROMPT_CLIP_KEYS.reduce(
    (result, clipKey) => ({
      ...result,
      [clipKey]: {
        i2i_first_frame: readText(formData, clipFieldName(clipKey, "i2i_first_frame")),
        i2i_last_frame: readText(formData, clipFieldName(clipKey, "i2i_last_frame")),
        i2v_prompt: readText(formData, clipFieldName(clipKey, "i2v_prompt")),
      },
    }),
    {} as Record<PromptClipKey, { i2i_first_frame: string; i2i_last_frame: string; i2v_prompt: string }>,
  );

  return buildPromptPackEditorStoragePayload(
    {
      clips,
      caption: readText(formData, "caption"),
      tags: readText(formData, "tags"),
    },
    existingPersonalization,
  );
}

async function savePromptPackFields(formData: FormData, id: string) {
  const existing = await getPromptPackById(id);
  const productId = readText(formData, "product_id");
  const intakeSessionId = readNullableText(formData, "intake_session_id");
  const affiliateProfileId = readNullableText(formData, "affiliate_profile_id");
  const sourceProductImageId = readNullableText(formData, "source_product_image_id");
  const storagePayload = readPromptEditorPayload(formData, existing.personalization_json);

  if (!productId) {
    throw new Error("Produk wajib dipilih.");
  }

  return await updatePromptPack(id, {
    product_id: productId,
    intake_session_id: intakeSessionId,
    affiliate_profile_id: affiliateProfileId,
    source_product_image_id: sourceProductImageId,
    version: readVersion(formData, "version"),
    i2i_prompts_json: storagePayload.i2i_prompts_json,
    i2v_prompts_json: storagePayload.i2v_prompts_json,
    personalization_json: storagePayload.personalization_json,
  });
}


async function queuePromptPackForProduct(input: {
  productId: string;
  generationMode: GenerationMode;
  contentVariantKey: ContentVariantKey;
}) {
  const product = await getProductById(input.productId);

  if (!product) {
    throw new Error("Produk tidak ditemukan.");
  }

  const productPromptPacks = await listPromptPacks({ productId: input.productId, limit: 200 });
  const contentVariant = getContentVariant(input.contentVariantKey);

  if (!contentVariant) {
    throw new Error("Varian konten tidak valid.");
  }

  const promptCode = buildContentVariantPromptCode(product.product_code, contentVariant.key);
  const matchingPromptPacks = productPromptPacks.filter((promptPack) => promptPack.prompt_code === promptCode);
  const latestMatchingPromptPack = matchingPromptPacks[0] ?? null;
  const latestMatchingVersion = matchingPromptPacks.reduce((max, promptPack) => Math.max(max, promptPack.version), 0);

  if (latestMatchingPromptPack && BULK_ENQUEUE_BLOCKING_PROMPT_STATUSES.has(latestMatchingPromptPack.status)) {
    return {
      promptPackId: latestMatchingPromptPack.id,
      productName: product.product_name,
      skipped: true,
    };
  }

  const draftPromptPack = matchingPromptPacks.find((promptPack) => promptPack.status === "DRAFT" && !promptPack.ai_task_id) ?? null;
  let promptPack = draftPromptPack
    ? await updatePromptPack(draftPromptPack.id, {
        status: "QUEUED",
        error_message: null,
        personalization_json: withContentVariantPersonalization(draftPromptPack.personalization_json, contentVariant),
      })
    : null;

  if (!promptPack) {
    try {
      promptPack = await createPromptPack({
        product_id: input.productId,
        prompt_code: promptCode,
        version: latestMatchingVersion + 1,
        status: "QUEUED",
        personalization_json: withContentVariantPersonalization(null, contentVariant),
      });
    } catch (error) {
      const message = errorMessage(error);
      if (message.includes("prompt_packs_user_prompt_code_version_key") || message.toLowerCase().includes("duplicate key value")) {
        return {
          promptPackId: latestMatchingPromptPack?.id ?? "",
          productName: product.product_name,
          skipped: true,
        };
      }

      throw error;
    }
  }

  if (!promptPack) {
    throw new Error("Prompt pack tidak dapat diantrikan.");
  }

  try {
    const task = await createPromptPackGenerationTask(promptPack.id, {
      generationMode: input.generationMode,
      maxRetries: input.generationMode === "mock" ? 0 : 3,
    });

    return {
      promptPackId: task.promptPack.id,
      productName: product.product_name,
      skipped: false,
    };
  } catch (error) {
    await updatePromptPack(promptPack.id, {
      status: "ERROR",
      error_message: errorMessage(error),
    }).catch(() => undefined);
    throw error;
  }
}

export async function bulkEnqueuePromptPacks(formData: FormData) {
  let generationMode: GenerationMode;
  let contentVariant: NonNullable<ReturnType<typeof getContentVariant>>;

  try {
    generationMode = readGenerationMode(formData);
    contentVariant = readContentVariant(formData);
  } catch (error) {
    failFromForm(formData, errorMessage(error));
  }

  const selectedProductIds = readSelectedProductIds(formData);
  const returnTo = readSafeReturnTo(formData);

  if (!selectedProductIds.length) {
    failFromForm(formData, "Pilih minimal satu produk.");
  }

  if (selectedProductIds.length > MAX_BULK_PROMPT_PRODUCTS) {
    failFromForm(formData, `Maksimal ${MAX_BULK_PROMPT_PRODUCTS} produk sekali antre.`);
  }

  const currentWorkspace = await getCurrentWorkspace();
  const workspaceId = currentWorkspace?.id ?? null;
  const projections = await listPromptReadinessProjections({
    workspaceId,
    productIds: selectedProductIds,
    limit: selectedProductIds.length,
  });
  const projectionMap = new Map(projections.map((projection) => [projection.product.id, projection]));
  let queuedCount = 0;
  let skippedCount = 0;

  for (const productId of selectedProductIds) {
    const projection = projectionMap.get(productId);

    if (!projection) {
      failFromForm(formData, "Produk terpilih tidak ditemukan.");
    }

    if (projection.status !== "READY_FOR_PROMPT" && !PROMPT_STATE_PROJECTION_STATUSES.has(projection.status)) {
      failFromForm(formData, "Produk terpilih belum siap untuk antre prompt.");
    }

    const queued = await queuePromptPackForProduct({
      productId,
      generationMode,
      contentVariantKey: contentVariant.key,
    });

    if (queued.skipped) {
      skippedCount += 1;
      continue;
    }

    queuedCount += 1;
  }

  revalidatePath("/prompts");

  const message =
    queuedCount && skippedCount
      ? `${queuedCount} produk diantrikan, ${skippedCount} sudah terproses.`
      : queuedCount
        ? `${queuedCount} produk diantrikan.`
        : "Prompt sudah terantri.";

  if (returnTo) {
    redirect(appendRedirectMessage(returnTo, "message", message));
  }

  doneFromForm(formData, message);
}

export async function cancelPromptPackGeneration(formData: FormData) {
  const id = readText(formData, "id");
  const productId = readText(formData, "product_id");

  if (!id) {
    failFromForm(formData, "ID prompt pack tidak ditemukan.");
  }

  try {
    await cancelPromptPackGenerationTask(id);
  } catch (error) {
    failFromForm(formData, errorMessage(error));
  }

  revalidatePromptRoutes(id, productId || null);
  doneFromForm(formData, "Antrian prompt dibatalkan.", productId || null);
}

export async function retryPromptPackGeneration(formData: FormData) {
  const id = readText(formData, "id");

  if (!id) {
    failFromForm(formData, "ID prompt pack tidak ditemukan.");
  }

  let productId: string | null = null;

  try {
    const promptPack = await getPromptPackById(id);
    productId = promptPack.product_id;
    const supabase = await createSupabaseServerClient();
    let generationMode: GenerationMode = "gemini";
    let taskStatus: string | null = null;

    if (promptPack.ai_task_id) {
      const { data: task, error: taskError } = await supabase
        .from("ai_tasks")
        .select("status, input_json")
        .eq("id", promptPack.ai_task_id)
        .eq("user_id", promptPack.user_id)
        .maybeSingle();

      if (taskError) {
        throw new Error(taskError.message);
      }

      taskStatus = typeof task?.status === "string" ? task.status : null;
      generationMode = readStoredGenerationMode(task?.input_json);
    }

    if (["QUEUED", "RUNNING", "RETRYING"].includes(taskStatus ?? "")) {
      throw new Error("Task prompt masih aktif.");
    }

    if (
      promptPack.status !== "ERROR" &&
      taskStatus !== "FAILED" &&
      taskStatus !== "WAITING_FOR_KEY"
    ) {
      throw new Error("Prompt pack belum berstatus gagal.");
    }

    await createPromptPackGenerationTask(promptPack.id, {
      generationMode,
      maxRetries: generationMode === "mock" ? 0 : 3,
    });
  } catch (error) {
    failFromForm(formData, errorMessage(error));
  }

  revalidatePromptRoutes(id, productId);
  doneFromForm(formData, "Prompt masuk antrian ulang.", productId);
}

export async function savePromptPack(formData: FormData) {
  const rawIntent = readText(formData, "intent");
  const isMockIntent = rawIntent.endsWith("_mock");
  const intent = isMockIntent ? rawIntent.replace(/_mock$/, "") : rawIntent;
  const id = readText(formData, "id");
  let generationMode: GenerationMode;

  try {
    generationMode = isMockIntent ? "mock" : readGenerationMode(formData);
  } catch (error) {
    failFromForm(formData, errorMessage(error));
  }

  if (intent === "archive") {
    if (!id) {
      failFromForm(formData, "ID prompt pack tidak ditemukan.");
    }

    try {
      await archivePromptPack(id);
    } catch (error) {
      failFromForm(formData, errorMessage(error));
    }

    revalidatePromptRoutes(id, readText(formData, "product_id") || null);
    doneFromForm(formData, "Data dihapus.", readText(formData, "product_id") || null);
  }

  if (intent === "create_generate" || intent === "create") {
    const productId = readText(formData, "product_id");
    const status = readText(formData, "status") || "DRAFT";
    const returnTo = readSafeReturnTo(formData);
    let message = "Prompt pack disimpan";
    let createdPromptPackId = "";

    if (!productId) {
      failFromForm(formData, "Produk wajib dipilih.");
    }

    try {
      const product = await getProductById(productId);
      if (!product) {
        throw new Error("Produk tidak ditemukan.");
      }

      if (status && !isPromptPackStatus(status)) {
        throw new Error("Status prompt pack tidak valid.");
      }

      const storagePayload = intent === "create" ? readPromptEditorPayload(formData) : null;
      const contentVariant = readContentVariant(formData);
      const generationOptions = intent === "create_generate" ? readGenerationOptions(formData) : undefined;
      const personalizationJson = withContentVariantPersonalization(
        storagePayload?.personalization_json,
        contentVariant,
        generationOptions,
      );
      const promptPack = await createPromptPack({
        product_id: productId,
        intake_session_id: readNullableText(formData, "intake_session_id"),
        affiliate_profile_id: readNullableText(formData, "affiliate_profile_id"),
        source_product_image_id: readNullableText(formData, "source_product_image_id"),
        prompt_code: buildContentVariantPromptCode(product.product_code, contentVariant.key),
        version: readVersion(formData, "version"),
        status,
        ...(storagePayload
          ? {
              i2i_prompts_json: storagePayload.i2i_prompts_json,
              i2v_prompts_json: storagePayload.i2v_prompts_json,
            }
          : {}),
        personalization_json: personalizationJson,
      });
      createdPromptPackId = promptPack.id;

      if (intent === "create_generate") {
        await createPromptPackGenerationTask(promptPack.id, {
          generationMode,
          maxRetries: generationMode === "mock" ? 0 : 3,
        });
        message = "Prompt pack dibuat. Generasi dimulai di detail.";
      }
    } catch (error) {
      if (createdPromptPackId) {
        revalidatePromptRoutes(createdPromptPackId, productId);
        if (returnTo) {
          redirect(appendRedirectMessage(returnTo, "error", errorMessage(error)));
        }
        redirect(promptDetailRedirect(createdPromptPackId, "error", errorMessage(error)));
      }

      failFromForm(formData, errorMessage(error));
    }

    if (createdPromptPackId) {
      revalidatePromptRoutes(createdPromptPackId, productId);
      if (returnTo) {
        redirect(appendRedirectMessage(returnTo, "message", message));
      }
      redirect(promptDetailRedirect(createdPromptPackId, "message", message));
    }

    doneFromForm(formData, message, productId);
  }

  if (!id) {
    failFromForm(formData, "ID prompt pack tidak ditemukan.");
  }

  if (intent === "update") {
    try {
      await savePromptPackFields(formData, id);
    } catch (error) {
      failFromForm(formData, errorMessage(error));
    }

    revalidatePromptRoutes(id, readText(formData, "product_id") || null);
    doneFromForm(formData, "Prompt pack disimpan", readText(formData, "product_id") || null);
  }

  if (intent === "export_prompt_txt") {
    let exportedFileName = "";

    try {
      const driveItem = await exportPromptPackTextFile(id);
      exportedFileName = driveItem.name;
    } catch (error) {
      failFromForm(formData, errorMessage(error));
    }

    revalidatePromptRoutes(id, readText(formData, "product_id") || null);
    redirect(promptDetailRedirect(id, "message", `TXT Drive disimpan: ${exportedFileName}`));
  }

  if (intent === "regenerate") {
    let nextPromptPackId = id;
    let productId = readNullableText(formData, "product_id");

    try {
      const regenerationScope = readRegenerationScopeFromForm(formData);
      const generationOptions = readGenerationOptions(formData);
      const existing = await getPromptPackById(id);
      productId = productId ?? existing.product_id;
      const nextVersion = await createPromptPackRegenerationVersion(existing.id, {
        storagePayload: {
          personalization_json: {
            ...(existing.personalization_json && typeof existing.personalization_json === "object" && !Array.isArray(existing.personalization_json)
              ? (existing.personalization_json as JsonObject)
              : {}),
            generation_options: generationOptions,
          },
        },
        revisionInstruction: readNullableText(formData, "revision_instruction"),
        regenerationScope: regenerationScope.key,
        productId,
        intakeSessionId: readNullableText(formData, "intake_session_id"),
        affiliateProfileId: readNullableText(formData, "affiliate_profile_id"),
        sourceProductImageId: readNullableText(formData, "source_product_image_id"),
      });
      nextPromptPackId = nextVersion.id;

      // Enqueue only — PromptGenerationMonitor will POST to /api/prompts/[id]/generate
      // which runs runRealPromptPackTask inside its own request context where cookies() works.
      await createPromptPackGenerationTask(nextVersion.id, {
        generationMode,
        maxRetries: generationMode === "mock" ? 0 : 3,
      });
    } catch (error) {
      if (nextPromptPackId !== id) {
        const messageText = errorMessage(error);
        const redirectInfo = buildPromptGenerationRedirect(messageText);
        revalidatePromptRoutes(id, productId ?? null);
        revalidatePromptRoutes(nextPromptPackId, productId ?? null);
        const searchParams = new URLSearchParams({ detail: nextPromptPackId, tab: "output" });
        redirect(appendRedirectMessage(`/prompts?${searchParams.toString()}`, redirectInfo.key, redirectInfo.message));
      }

      failFromForm(formData, errorMessage(error));
    }

    revalidatePromptRoutes(id, productId);
    revalidatePromptRoutes(nextPromptPackId, productId);
    const searchParams = new URLSearchParams({ detail: nextPromptPackId, tab: "output" });
    redirect(appendRedirectMessage(`/prompts?${searchParams.toString()}`, "message", "Prompt pack sedang di-generate..."));
  }

  if (intent === "mark_ready") {
    try {
      const saved = await savePromptPackFields(formData, id);
      await markPromptPackReadyForFlow(saved.id);
    } catch (error) {
      failFromForm(formData, errorMessage(error));
    }

    revalidatePromptRoutes(id, readText(formData, "product_id") || null);
    doneFromForm(formData, "Versi dipilih siap Flow", readText(formData, "product_id") || null);
  }

  failFromForm(formData, "Aksi prompt pack tidak didukung.");
}
