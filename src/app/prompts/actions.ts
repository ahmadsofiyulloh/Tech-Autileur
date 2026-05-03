"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archivePromptPack,
  createPromptPack,
  createPromptPackGenerationTask,
  createPromptPackRegenerationVersion,
  getPromptPackById,
  markPromptPackReadyForFlow,
  runMockPromptPackTask,
  runRealPromptPackTask,
  updatePromptPack,
} from "@/lib/server/prompt-packs";
import { getProductById } from "@/lib/server/products";
import { buildPromptPackEditorStoragePayload } from "@/lib/prompts/prompt-pack-contract";
import { PROMPT_CLIP_KEYS, isPromptPackStatus, type PromptClipKey } from "@/lib/prompts/validation";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNullableText(formData: FormData, key: string) {
  const value = readText(formData, key);
  return value.length > 0 ? value : null;
}

function buildPromptRedirect(message: string, productId?: string | null) {
  const searchParams = new URLSearchParams({ message });

  if (productId) {
    searchParams.set("product_id", productId);
  }

  return `/prompts?${searchParams.toString()}`;
}

type GenerationMode = "gemini" | "mock";

function fail(message: string): never {
  redirect(`/prompts?error=${encodeURIComponent(message)}`);
}

function readGenerationMode(formData: FormData): GenerationMode {
  const value = readText(formData, "generation_mode");

  if (!value || value === "gemini" || value === "mock") {
    return (value || "gemini") as GenerationMode;
  }

  fail("Mode generasi tidak valid.");
}

function readVersion(formData: FormData, key: string) {
  const value = readText(formData, key);

  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    fail("Versi prompt harus angka utuh minimal 1.");
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

async function generatePromptPack(promptPackId: string, generationMode: GenerationMode) {
  const { task } = await createPromptPackGenerationTask(promptPackId, {
    generationMode,
    maxRetries: generationMode === "mock" ? 0 : 3,
  });

  return generationMode === "mock"
    ? await runMockPromptPackTask(promptPackId, task.id)
    : await runRealPromptPackTask(promptPackId, task.id);
}

async function savePromptPackFields(formData: FormData, id: string) {
  const existing = await getPromptPackById(id);
  const productId = readText(formData, "product_id");
  const intakeSessionId = readNullableText(formData, "intake_session_id");
  const affiliateProfileId = readNullableText(formData, "affiliate_profile_id");
  const sourceProductImageId = readNullableText(formData, "source_product_image_id");
  const storagePayload = readPromptEditorPayload(formData, existing.personalization_json);

  if (!productId) {
    fail("Produk wajib dipilih.");
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
  const generationMode: GenerationMode = isMockIntent ? "mock" : readGenerationMode(formData);

  if (intent === "archive") {
    if (!id) {
      fail("ID prompt pack tidak ditemukan.");
    }

    await archivePromptPack(id);
    revalidatePath("/prompts");
    redirect(buildPromptRedirect("Prompt pack diarsipkan", readText(formData, "product_id") || null));
  }

  if (intent === "create_generate" || intent === "create") {
    const productId = readText(formData, "product_id");
    const status = readText(formData, "status") || "DRAFT";

    if (!productId) {
      fail("Produk wajib dipilih.");
    }

    const product = await getProductById(productId);
    if (!product) {
      fail("Produk tidak ditemukan.");
    }

    if (status && !isPromptPackStatus(status)) {
      fail("Status prompt pack tidak valid.");
    }

    const storagePayload = readPromptEditorPayload(formData);
    const promptPack = await createPromptPack({
      product_id: productId,
      intake_session_id: readNullableText(formData, "intake_session_id"),
      affiliate_profile_id: readNullableText(formData, "affiliate_profile_id"),
      source_product_image_id: readNullableText(formData, "source_product_image_id"),
      version: readVersion(formData, "version"),
      status,
      i2i_prompts_json: storagePayload.i2i_prompts_json,
      i2v_prompts_json: storagePayload.i2v_prompts_json,
      personalization_json: storagePayload.personalization_json,
    });

    if (intent === "create") {
      revalidatePath("/prompts");
      redirect(buildPromptRedirect("Prompt pack disimpan", productId));
    }

    const result = await generatePromptPack(promptPack.id, generationMode);
    revalidatePath("/prompts");
    redirect(buildPromptRedirect(result.message, productId));
  }

  if (!id) {
    fail("ID prompt pack tidak ditemukan.");
  }

  if (intent === "update") {
    await savePromptPackFields(formData, id);
    revalidatePath("/prompts");
    redirect(buildPromptRedirect("Prompt pack disimpan", readText(formData, "product_id") || null));
  }

  if (intent === "regenerate") {
    const existing = await getPromptPackById(id);
    const productId = readText(formData, "product_id");
    const storagePayload = readPromptEditorPayload(formData, existing.personalization_json);

    if (!productId) {
      fail("Produk wajib dipilih.");
    }

    const nextVersion = await createPromptPackRegenerationVersion(existing.id, {
      storagePayload,
      revisionInstruction: readNullableText(formData, "revision_instruction"),
      productId,
      intakeSessionId: readNullableText(formData, "intake_session_id"),
      affiliateProfileId: readNullableText(formData, "affiliate_profile_id"),
      sourceProductImageId: readNullableText(formData, "source_product_image_id"),
    });
    const result = await generatePromptPack(nextVersion.id, generationMode);

    revalidatePath("/prompts");
    redirect(buildPromptRedirect(result.message, readText(formData, "product_id") || null));
  }

  if (intent === "mark_ready") {
    const saved = await savePromptPackFields(formData, id);
    await markPromptPackReadyForFlow(saved.id);
    revalidatePath("/prompts");
    redirect(buildPromptRedirect("Versi dipilih siap Flow", readText(formData, "product_id") || null));
  }

  fail("Aksi prompt pack tidak didukung.");
}
