"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveProduct,
  attachProductSourceImage,
  createProduct,
  updateProduct,
} from "@/lib/server/products";

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
