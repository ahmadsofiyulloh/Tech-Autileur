"use server";

import { revalidatePath } from "next/cache.js";
import { redirect } from "next/navigation";
import {
  archivePromptPack,
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
import {
  buildPromptPackEditorStoragePayload,
  resolvePromptPackVideoMode,
  type JsonObject,
  type PromptPackGenerationOptionsJson,
} from "@/lib/prompts/prompt-pack-contract";
import { resolveVideoModel } from "@/lib/prompts/video-model-config";
import { resolveVoLengthPreset } from "@/lib/prompts/vo-length-presets";
import {
  buildContentVariantPromptCode,
  getContentVariant,
  type ContentVariantKey,
} from "@/lib/prompts/content-variants";
import { isShareAngle, normalizeShareVariantCount, type ShareAngle } from "@/lib/share/share-platform";
import { PROMPT_CLIP_KEYS, isPromptPackStatus, type PromptClipKey } from "@/lib/prompts/validation";

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
  const videoMode = resolvePromptPackVideoMode(formData.get("video_mode"));

  return {
    vo_enabled: voEnabled,
    vo_length_preset: voLengthPreset,
    video_model: videoModel,
    video_mode: videoMode,
  };
}

function readPromptAngle(formData: FormData, fallback: ShareAngle = "benefit_focused"): ShareAngle {
  const value = readText(formData, "angle") || fallback;

  if (!isShareAngle(value)) {
    throw new Error("Angle prompt tidak valid.");
  }

  return value;
}

function readPromptVariantCount(formData: FormData) {
  return normalizeShareVariantCount(Number(readText(formData, "variant_count")) || 1);
}

function mapAngleToContentVariantKey(angle: ShareAngle): ContentVariantKey {
  switch (angle) {
    case "problem_solution":
      return "problem_solution";
    case "social_proof":
      return "detail_proof";
    case "urgency_scarcity":
      return "price_value";
    case "educational":
    case "storytelling":
      return "use_case";
    case "benefit_focused":
    default:
      return "hero_hook";
  }
}

function buildPromptInputParams(input: {
  angle: ShareAngle;
  generationOptions: PromptPackGenerationOptionsJson;
  revisionInstruction?: string | null;
  variantCount: number;
}): JsonObject {
  return {
    angle: input.angle,
    variant_count: input.variantCount,
    generation_options: input.generationOptions as JsonObject,
    ...(input.revisionInstruction ? { revision_instruction: input.revisionInstruction } : {}),
  };
}

type GenerationMode = "gemini" | "mock";

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

function promptProductDetailRedirect(
  productId: string,
  key: "message" | "error" | "warning",
  message: string,
  input?: {
    tab?: "output" | "generate" | "history";
    version?: string | null;
  },
) {
  const searchParams = new URLSearchParams({ detail: productId });

  if (input?.tab && input.tab !== "output") {
    searchParams.set("tab", input.tab);
  }

  if (input?.version) {
    searchParams.set("version", input.version);
  }

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

function doneFromForm(formData: FormData, message: string, productId?: string | null): never {
  redirect(buildPromptRedirectFromForm(formData, "message", message, productId));
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

function readJsonRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function getContentVariantForAngle(angle: ShareAngle) {
  const contentVariant = getContentVariant(mapAngleToContentVariantKey(angle));

  if (!contentVariant) {
    throw new Error("Varian prompt tidak valid.");
  }

  return contentVariant;
}

function buildSinglePromptCode(productCode: string) {
  return buildContentVariantPromptCode(productCode, "single");
}

async function startPromptPackGeneration(promptPackId: string, generationMode: GenerationMode) {
  const task = await createPromptPackGenerationTask(promptPackId, {
    generationMode,
    maxRetries: generationMode === "mock" ? 0 : 3,
  });

  void import("@/lib/server/prompt-packs")
    .then((mod) =>
      generationMode === "mock"
        ? mod.runMockPromptPackTask(promptPackId, task.task.id)
        : mod.runRealPromptPackTask(promptPackId, task.task.id),
    )
    .catch(() => undefined);

  return task.promptPack;
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
    const status = intent === "create_generate" ? "DRAFT" : readText(formData, "status") || "DRAFT";
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
      const angle = readPromptAngle(formData);
      const variantCount = readPromptVariantCount(formData);
      const contentVariant = getContentVariantForAngle(angle);
      const generationOptions = readGenerationOptions(formData);
      const productPromptPacks = await listPromptPacks({ productId, limit: 200 });
      const latestProductVersion = productPromptPacks.reduce((max, promptPack) => Math.max(max, promptPack.version), 0);
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
        prompt_code: productPromptPacks[0]?.prompt_code ?? buildSinglePromptCode(product.product_code),
        version: intent === "create_generate" ? latestProductVersion + 1 : readVersion(formData, "version"),
        status,
        ...(storagePayload
          ? {
              i2i_prompts_json: storagePayload.i2i_prompts_json,
              i2v_prompts_json: storagePayload.i2v_prompts_json,
            }
          : {}),
        personalization_json: personalizationJson,
        angle,
        variant_count: variantCount,
        input_params_json: buildPromptInputParams({
          angle,
          generationOptions,
          variantCount,
        }),
      });
      createdPromptPackId = promptPack.id;

      if (intent === "create_generate") {
        await startPromptPackGeneration(promptPack.id, generationMode);
        message = "Prompt sedang di-generate...";
      }
    } catch (error) {
      if (createdPromptPackId) {
        revalidatePromptRoutes(createdPromptPackId, productId);
        if (returnTo) {
          redirect(appendRedirectMessage(returnTo, "error", errorMessage(error)));
        }
        redirect(promptProductDetailRedirect(productId, "error", errorMessage(error), {
          tab: "generate",
          version: createdPromptPackId,
        }));
      }

      failFromForm(formData, errorMessage(error));
    }

    if (createdPromptPackId) {
      revalidatePromptRoutes(createdPromptPackId, productId);
      if (intent !== "create_generate" && returnTo) {
        redirect(appendRedirectMessage(returnTo, "message", message));
      }
      redirect(promptProductDetailRedirect(productId, "message", message, {
        tab: "output",
        version: createdPromptPackId,
      }));
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
    redirect(promptProductDetailRedirect(readText(formData, "product_id"), "message", `TXT Drive disimpan: ${exportedFileName}`, {
      tab: "output",
      version: id,
    }));
  }

  if (intent === "regenerate") {
    let nextPromptPackId = id;
    let productId = readNullableText(formData, "product_id");

    try {
      const generationOptions = readGenerationOptions(formData);
      const existing = await getPromptPackById(id);
      productId = productId ?? existing.product_id;
      const angle = readPromptAngle(formData, existing.angle);
      const variantCount = formData.has("variant_count")
        ? readPromptVariantCount(formData)
        : normalizeShareVariantCount(existing.variant_count);
      const contentVariant = getContentVariantForAngle(angle);
      const revisionInstruction = readNullableText(formData, "revision_instruction");
      const nextVersion = await createPromptPackRegenerationVersion(existing.id, {
        storagePayload: {
          personalization_json: withContentVariantPersonalization(
            readJsonRecord(existing.personalization_json),
            contentVariant,
            generationOptions,
          ),
        },
        revisionInstruction,
        regenerationScope: "full_pack",
        productId,
        intakeSessionId: readNullableText(formData, "intake_session_id"),
        affiliateProfileId: readNullableText(formData, "affiliate_profile_id"),
        sourceProductImageId: readNullableText(formData, "source_product_image_id"),
        angle,
        variantCount,
        inputParamsJson: buildPromptInputParams({
          angle,
          generationOptions,
          revisionInstruction,
          variantCount,
        }),
      });
      nextPromptPackId = nextVersion.id;
      await startPromptPackGeneration(nextVersion.id, generationMode);
    } catch (error) {
      if (nextPromptPackId !== id) {
        revalidatePromptRoutes(id, productId ?? null);
        revalidatePromptRoutes(nextPromptPackId, productId ?? null);
        redirect(promptProductDetailRedirect(productId ?? readText(formData, "product_id"), "error", errorMessage(error), {
          tab: "generate",
          version: nextPromptPackId,
        }));
      }

      failFromForm(formData, errorMessage(error));
    }

    revalidatePromptRoutes(id, productId);
    revalidatePromptRoutes(nextPromptPackId, productId);
    redirect(promptProductDetailRedirect(productId ?? readText(formData, "product_id"), "message", "Prompt pack sedang di-generate...", {
      tab: "output",
      version: nextPromptPackId,
    }));
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
