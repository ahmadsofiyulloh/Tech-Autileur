"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archivePromptPack,
  createPromptPackGenerationTask,
  createPromptPack,
  runRealPromptPackTask,
  runMockPromptPackTask,
  updatePromptPack,
} from "@/lib/server/prompt-packs";
import { isPromptPackStatus } from "@/lib/prompts/validation";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNullableText(formData: FormData, key: string) {
  const value = readText(formData, key);
  return value.length > 0 ? value : null;
}

type GenerationMode = "gemini" | "mock";

function readGenerationMode(formData: FormData): GenerationMode {
  const value = readText(formData, "generation_mode");

  if (!value || value === "gemini" || value === "mock") {
    return (value || "gemini") as GenerationMode;
  }

  fail("Invalid generation mode.");
}

function readVersion(formData: FormData, key: string) {
  const value = readText(formData, key);

  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    fail("Prompt version must be a whole number greater than or equal to 1.");
  }

  return parsed;
}

function fail(message: string): never {
  redirect(`/prompts?error=${encodeURIComponent(message)}`);
}

export async function savePromptPack(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");
  const productId = readText(formData, "product_id");
  const sourceProductImageId = readNullableText(formData, "source_product_image_id");
  const promptCode = readText(formData, "prompt_code");
  const version = readVersion(formData, "version");
  const status = readText(formData, "status");
  const notes = readNullableText(formData, "notes");
  const generationMode = readGenerationMode(formData);

  if (intent === "archive") {
    if (!id) {
      fail("Missing prompt pack id.");
    }

    await archivePromptPack(id);
    revalidatePath("/prompts");
    redirect("/prompts?message=Prompt pack archived");
  }

  if (intent === "generate") {
    if (!id) {
      fail("Missing prompt pack id.");
    }

    const { task } = await createPromptPackGenerationTask(id, {
      generationMode,
      maxRetries: generationMode === "mock" ? 0 : 3,
    });

    const result =
      generationMode === "mock" ? await runMockPromptPackTask(id, task.id) : await runRealPromptPackTask(id, task.id);

    revalidatePath("/prompts");
    redirect(`/prompts?message=${encodeURIComponent(result.message)}`);
  }

  if (intent === "create") {
    if (!productId) {
      fail("Product is required.");
    }
    if (!promptCode) {
      fail("Prompt code is required.");
    }

    if (status && !isPromptPackStatus(status)) {
      fail("Invalid prompt pack status.");
    }

    await createPromptPack({
      product_id: productId,
      source_product_image_id: sourceProductImageId,
      prompt_code: promptCode,
      version,
      status: status || "DRAFT",
      notes,
    });

    revalidatePath("/prompts");
    redirect("/prompts?message=Prompt pack created");
  }

  if (intent !== "update") {
    fail("Unsupported prompt pack action.");
  }

  if (!id) {
    fail("Missing prompt pack id.");
  }
  if (!productId) {
    fail("Product is required.");
  }
  if (!promptCode) {
    fail("Prompt code is required.");
  }

  if (status && !isPromptPackStatus(status)) {
    fail("Invalid prompt pack status.");
  }

  await updatePromptPack(id, {
    product_id: productId,
    source_product_image_id: sourceProductImageId,
    prompt_code: promptCode,
    version,
    status: status || undefined,
    notes,
  });

  revalidatePath("/prompts");
  redirect("/prompts?message=Prompt pack updated");
}
