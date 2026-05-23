"use server";

import { revalidatePath } from "next/cache.js";
import { redirect } from "next/navigation";
import {
  archiveProduct,
  attachProductSourceImage,
  bulkArchiveProducts,
  createProduct,
  updateProduct,
} from "@/lib/server/products";
import {
  createPromptPackGenerationTask,
  createPromptPackRegenerationVersion,
  listPromptPacks,
  runMockPromptPackTask,
  runRealPromptPackTask,
} from "@/lib/server/prompt-packs";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(`/products?error=${encodeURIComponent(message)}`);
}

function readBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export async function saveProduct(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");
  const productName = readText(formData, "product_name");
  const niche = readText(formData, "niche");
  const marketplace = readText(formData, "marketplace");
  const marketplaceProductLink = readText(formData, "marketplace_product_link");
  const status = readText(formData, "status");

  if (intent === "archive") {
    if (!id) {
      fail("Missing product id.");
    }

    await archiveProduct(id);
    revalidatePath("/products");
    revalidatePath("/products/new");
    revalidatePath("/intake");
    redirect("/products?message=Data%20dihapus.");
  }

  if (intent === "create") {
    if (!productName) {
      fail("Product name is required.");
    }

    await createProduct({
      product_name: productName,
      niche: niche || null,
      marketplace: marketplace || null,
      marketplace_product_link: marketplaceProductLink || null,
      status: status || undefined,
    });

    revalidatePath("/products");
    redirect("/products?message=Product created");
  }

  if (intent !== "update") {
    fail("Unsupported product action.");
  }

  if (!id) {
    fail("Missing product id.");
  }
  if (!productName) {
    fail("Product name is required.");
  }

  await updateProduct(id, {
    product_name: productName,
    niche: niche || null,
    marketplace: marketplace || null,
    marketplace_product_link: marketplaceProductLink || null,
    status: status || undefined,
  });

  revalidatePath("/products");
  redirect("/products?message=Product updated");
}

export async function saveProductStatus(formData: FormData) {
  const id = readText(formData, "id");

  if (!id) {
    fail("Missing product id.");
  }

  await updateProduct(id, {
    workflow_status_json: {
      video_generated: readBoolean(formData, "workflow_video_generated"),
      uploaded_shopee: readBoolean(formData, "workflow_uploaded_shopee"),
      uploaded_tiktok: readBoolean(formData, "workflow_uploaded_tiktok"),
    },
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect("/products?message=Status%20updated");
}

export async function saveProductImage(formData: FormData) {
  const productId = readText(formData, "product_id");
  const driveItemRefId = readText(formData, "drive_item_ref_id");
  const status = readText(formData, "status");
  const isPrimary = readBoolean(formData, "is_primary");

  if (!productId) {
    fail("Missing product id.");
  }
  if (!driveItemRefId) {
    fail("Drive item reference is required.");
  }

  await attachProductSourceImage({
    productId,
    driveItemRefId,
    isPrimary,
    status: status || undefined,
  });

  revalidatePath("/products");
  redirect("/products?message=Source image attached");
}

type GenerationMode = "gemini" | "mock";

async function generatePromptPack(promptPackId: string, generationMode: GenerationMode) {
  const { task } = await createPromptPackGenerationTask(promptPackId, {
    generationMode,
    maxRetries: generationMode === "mock" ? 0 : 3,
  });

  return generationMode === "mock"
    ? await runMockPromptPackTask(promptPackId, task.id)
    : await runRealPromptPackTask(promptPackId, task.id);
}

export async function regenerateProductPrompt(formData: FormData) {
  const productId = readText(formData, "product_id");
  const revisionInstruction = readText(formData, "revision_instruction");
  const generationMode: GenerationMode = "gemini";

  if (!productId) {
    fail("Product ID tidak ditemukan.");
  }

  if (revisionInstruction.length > 500) {
    fail("Catatan perubahan terlalu panjang (max 500 karakter).");
  }

  let nextVersionId: string | null = null;
  let generationMessage = "Prompt sedang digenerate";

  try {
    const productPromptPacks = await listPromptPacks({ productId, limit: 200 });
    const visiblePromptPacks = productPromptPacks.filter((pack) => pack.status !== "ARCHIVED");
    const latestPromptPack = visiblePromptPacks[0] ?? null;

    if (!latestPromptPack) {
      fail("Belum ada prompt pack untuk produk ini.");
    }

    if (latestPromptPack.status === "QUEUED" || latestPromptPack.status === "GENERATING") {
      fail("Prompt sedang diproses. Tunggu hingga selesai.");
    }

    const nextVersion = await createPromptPackRegenerationVersion(latestPromptPack.id, {
      revisionInstruction: revisionInstruction || null,
      regenerationScope: "full_pack",
      productId,
      intakeSessionId: latestPromptPack.intake_session_id,
      affiliateProfileId: latestPromptPack.affiliate_profile_id,
      sourceProductImageId: latestPromptPack.source_product_image_id,
    });

    nextVersionId = nextVersion.id;
    const result = await generatePromptPack(nextVersion.id, generationMode);
    nextVersionId = result.promptPack.id;

    if (result.task.status !== "SUCCESS") {
      generationMessage = result.message;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal generate ulang prompt. Coba lagi.";
    if (nextVersionId) {
      revalidatePath("/products");
      revalidatePath(`/products/${productId}`);
      revalidatePath("/prompts");
      redirect(`/prompts?detail=${nextVersionId}&error=${encodeURIComponent(message)}`);
    }
    fail(message);
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/prompts");
  revalidatePath(`/prompts/${nextVersionId}`);
  revalidatePath(`/prompts/${nextVersionId}/history`);
  redirect(`/prompts?detail=${nextVersionId}&message=${encodeURIComponent(generationMessage)}`);
}

export async function bulkArchiveProductsAction(formData: FormData) {
  const productIds = formData.getAll("product_ids").map((value) => String(value));

  if (!productIds.length) {
    fail("Tidak ada produk yang dipilih.");
  }

  try {
    const result = await bulkArchiveProducts(productIds);
    revalidatePath("/products");
    revalidatePath("/products/new");
    revalidatePath("/intake");
    redirect(`/products?message=${encodeURIComponent(`${result.archivedCount} produk diarsipkan.`)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengarsipkan produk.";
    fail(message);
  }
}
