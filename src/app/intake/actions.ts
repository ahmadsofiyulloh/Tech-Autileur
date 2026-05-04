"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createIntakeSession,
  createMarketplaceSourcesFromIntake,
  createProductAnchorFromIntake,
  createProductFromIntake,
  linkProductToIntake,
  parseIntakeWithGemini,
  reviewIntakeMetadata,
  updateIntakeSession,
} from "@/lib/server/intake";
import type { JsonRecord } from "@/lib/intake/validation";

const INTAKE_RETURN_PATH = "/products/new";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readUploadedFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function redirectWithError(message: string, params?: Record<string, string>): never {
  const searchParams = new URLSearchParams({ error: message });

  for (const [key, value] of Object.entries(params ?? {})) {
    searchParams.set(key, value);
  }

  redirect(`${INTAKE_RETURN_PATH}?${searchParams.toString()}`);
}

function redirectWithMessage(message: string, params?: Record<string, string>): never {
  const searchParams = new URLSearchParams({ message });

  for (const [key, value] of Object.entries(params ?? {})) {
    searchParams.set(key, value);
  }

  redirect(`${INTAKE_RETURN_PATH}?${searchParams.toString()}`);
}

function buildPromptEditorRedirect(message: string, params: {
  productId: string;
  intakeId: string;
  affiliateProfileId?: string | null;
}) {
  const searchParams = new URLSearchParams({
    message,
    product_id: params.productId,
    intake_id: params.intakeId,
  });

  if (params.affiliateProfileId) {
    searchParams.set("affiliate_profile_id", params.affiliateProfileId);
  }

  return `/prompts?${searchParams.toString()}`;
}

function reviewedMetadataFromForm(formData: FormData): JsonRecord {
  return {
    nama_produk: readText(formData, "review_nama_produk") || readText(formData, "review_product_title"),
    keyword_cari_etalase: readText(formData, "review_keyword_cari_etalase") || readText(formData, "review_category"),
    deskripsi_visual: readText(formData, "review_deskripsi_visual"),
    use_case: readText(formData, "review_use_case"),
    pain_point: readText(formData, "review_pain_point"),
    selling_angle: readText(formData, "review_selling_angle"),
    target_viewer: readText(formData, "review_target_viewer"),
  };
}

function sourceFromForm(formData: FormData, prefix: string) {
  return {
    product_url: readText(formData, `${prefix}_product_url`) || null,
    affiliate_url: readText(formData, `${prefix}_affiliate_url`) || null,
    title: readText(formData, `${prefix}_title`) || null,
    category: readText(formData, `${prefix}_category`) || null,
    rating_text: readText(formData, `${prefix}_rating_text`) || null,
    sold_count_text: readText(formData, `${prefix}_sold_count_text`) || null,
    price_text: readText(formData, `${prefix}_price_text`) || null,
    shop_name: readText(formData, `${prefix}_shop_name`) || null,
    screenshot_drive_item_ref_id: readText(formData, `${prefix}_screenshot_drive_item_ref_id`) || null,
    status: readText(formData, `${prefix}_status`) || "DRAFT",
    parsed_metadata_json: {
      entry_mode: "manual",
      platform: prefix.toUpperCase(),
      title: readText(formData, `${prefix}_title`) || null,
      category: readText(formData, `${prefix}_category`) || null,
      rating_text: readText(formData, `${prefix}_rating_text`) || null,
      sold_count_text: readText(formData, `${prefix}_sold_count_text`) || null,
      price_text: readText(formData, `${prefix}_price_text`) || null,
      shop_name: readText(formData, `${prefix}_shop_name`) || null,
    },
  };
}

export async function saveIntake(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");
  const workspaceScope = readText(formData, "workspace_scope");
  const affiliateProfileId = readText(formData, "affiliate_profile_id");
  let message = "Intake saved";
  let redirectParams: Record<string, string> | undefined;
  let finalRedirectPath: string | null = null;

  try {
    if (intent === "create_session") {
      const session = await createIntakeSession({
        product_title: readText(formData, "product_title"),
        shopee_url: readText(formData, "shopee_url"),
        tiktok_url: readText(formData, "tiktok_url"),
        product_photo_drive_item_ref_id: readText(formData, "product_photo_drive_item_ref_id"),
        screenshot_drive_item_ref_id: readText(formData, "screenshot_drive_item_ref_id"),
        status: "SUBMITTED",
      });
      message = "Intake saved";
      redirectParams = {
        step: "prompt",
        intake_id: session.id,
        ...(workspaceScope === "all" ? { workspace: "all" } : {}),
        ...(affiliateProfileId ? { affiliate_profile_id: affiliateProfileId } : {}),
      };
    } else if (intent === "update_session") {
      if (!id) {
        throw new Error("Missing intake id.");
      }

      await updateIntakeSession(id, {
        product_title: readText(formData, "product_title"),
        shopee_url: readText(formData, "shopee_url"),
        tiktok_url: readText(formData, "tiktok_url"),
        product_photo_drive_item_ref_id: readText(formData, "product_photo_drive_item_ref_id"),
        screenshot_drive_item_ref_id: readText(formData, "screenshot_drive_item_ref_id"),
        status: readText(formData, "status") || undefined,
      });
      message = "Intake updated";
    } else if (intent === "parse_intake") {
      const productImage = readUploadedFile(formData, "product_image");
      const shopeeScreenshot = readUploadedFile(formData, "shopee_screenshot") ?? readUploadedFile(formData, "marketplace_screenshot");
      const tiktokScreenshot = readUploadedFile(formData, "tiktok_screenshot");

      if (!productImage || !shopeeScreenshot || !tiktokScreenshot) {
        throw new Error("Upload semua evidence dulu.");
      }

      const result = await parseIntakeWithGemini({
        productImage,
        shopeeScreenshot,
        tiktokScreenshot,
      });
      message = result.message;
      redirectParams = {
        step: "prompt",
        intake_id: result.session.id,
        ...(workspaceScope === "all" ? { workspace: "all" } : {}),
        ...(affiliateProfileId ? { affiliate_profile_id: affiliateProfileId } : {}),
      };
    } else if (intent === "review_metadata" || intent === "save_reviewed_metadata") {
      if (!id) {
        throw new Error("Missing intake id.");
      }

      const reviewedSession = await reviewIntakeMetadata(id, reviewedMetadataFromForm(formData));
      message = "Review saved";
      redirectParams = {
        step: "prompt",
        intake_id: id,
        ...(workspaceScope === "all" ? { workspace: "all" } : {}),
        ...(affiliateProfileId ? { affiliate_profile_id: affiliateProfileId } : {}),
      };

      if (reviewedSession.product_id) {
        finalRedirectPath = buildPromptEditorRedirect(message, {
          productId: reviewedSession.product_id,
          intakeId: reviewedSession.id,
          affiliateProfileId,
        });
      }
    } else if (intent === "link_product") {
      if (!id) {
        throw new Error("Missing intake id.");
      }

      const productId = readText(formData, "product_id");

      if (!productId) {
        throw new Error("Choose a product.");
      }

      await linkProductToIntake(id, productId);
      message = "Product linked";
    } else if (intent === "create_product") {
      if (!id) {
        throw new Error("Missing intake id.");
      }

      await createProductFromIntake(id, {
        product_name: readText(formData, "product_name"),
        niche: readText(formData, "niche"),
      });
      message = "Product created";
    } else if (intent === "save_sources") {
      if (!id) {
        throw new Error("Missing intake id.");
      }

      await createMarketplaceSourcesFromIntake(id, {
        shopee: sourceFromForm(formData, "shopee"),
        tiktok: sourceFromForm(formData, "tiktok"),
      });
      message = "Sources saved";
    } else if (intent === "create_anchor" || intent === "update_anchor") {
      if (!id) {
        throw new Error("Missing intake id.");
      }

      await createProductAnchorFromIntake(id, {
        source_product_image_id: readText(formData, "source_product_image_id"),
      });
      message = "Anchor updated";
    } else {
      throw new Error("Unsupported intake action.");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unable to save intake.";
    const errorParams =
      intent === "review_metadata" || intent === "save_reviewed_metadata"
        ? {
            step: "prompt",
            ...(id ? { intake_id: id } : {}),
            ...(workspaceScope === "all" ? { workspace: "all" } : {}),
            ...(affiliateProfileId ? { affiliate_profile_id: affiliateProfileId } : {}),
          }
        : undefined;

    redirectWithError(errorMessage, errorParams);
  }

  revalidatePath("/intake");
  revalidatePath(INTAKE_RETURN_PATH);
  revalidatePath("/products");

  if (finalRedirectPath) {
    redirect(finalRedirectPath);
  }

  redirectWithMessage(message, redirectParams);
}
