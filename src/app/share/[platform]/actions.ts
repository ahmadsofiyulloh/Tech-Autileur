"use server";

import { redirect } from "next/navigation";
import { upsertShareProductLink } from "@/lib/server/share-product-links";
import { createShareGeneration } from "@/lib/server/share-generations";
import { buildShareListHref } from "@/lib/share/share-list-contract";
import {
  isSharePlatform,
  isShareAngle,
  normalizeShareVariantCount,
  normalizeShareGenerateOptions,
  type ShareGenerateOptions,
} from "@/lib/share/share-platform";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(productId: string, platform: string, message: string): never {
  const base = isSharePlatform(platform) ? buildShareListHref({ platform, detailId: productId }) : "/share";
  const separator = base.includes("?") ? "&" : "?";
  redirect(`${base}${separator}error=${encodeURIComponent(message)}`);
}

export async function generateShareCaption(formData: FormData) {
  const productId = readText(formData, "product_id");
  const platform = readText(formData, "platform");
  const affiliateUrl = readText(formData, "affiliate_url");
  const angle = readText(formData, "angle");
  const variantCountRaw = readText(formData, "variant_count");
  const optionsJsonRaw = readText(formData, "options_json");

  if (!productId) {
    redirect("/share");
  }

  if (!isSharePlatform(platform)) {
    redirect("/share");
  }

  if (!affiliateUrl) {
    fail(productId, platform, "Affiliate URL wajib diisi.");
  }

  if (!isShareAngle(angle)) {
    fail(productId, platform, "Angle tidak valid.");
  }

  const variantCount = normalizeShareVariantCount(Number(variantCountRaw) || 2);

  // Parse and normalize options if present; fall back to defaults if absent or invalid.
  // Options are persisted to share_generations.input_params (see SHARE-V1-003a migration).
  let options: ShareGenerateOptions | undefined;
  if (optionsJsonRaw) {
    try {
      const parsed = JSON.parse(optionsJsonRaw);
      options = normalizeShareGenerateOptions(platform, parsed);
    } catch {
      // Invalid JSON or parse error — proceed with defaults (options = undefined).
    }
  }

  try {
    await upsertShareProductLink({ productId, affiliateUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan affiliate URL.";
    fail(productId, platform, message);
  }

  try {
    await createShareGeneration({
      affiliateUrl,
      productId,
      platform,
      angle,
      variantCount,
      inputParams: options,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat generation.";
    fail(productId, platform, message);
  }

  // Mock generation is persisted server-side until live Gemini share copy is wired.
  const successHref = buildShareListHref({
    platform,
    detailId: productId,
    tab: "output",
  });

  redirect(successHref);
}
