export const PRODUCT_STATUSES = [
  "DRAFT",
  "IMAGE_ATTACHED",
  "IMAGE_ANALYZED",
  "PROMPT_READY",
  "IN_PRODUCTION",
  "READY_FOR_UPLOAD",
  "UPLOADED",
  "ARCHIVED",
] as const;

export const PRODUCT_IMAGE_STATUSES = ["ATTACHED", "ANALYZED", "REPLACED", "ARCHIVED", "ERROR"] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type ProductImageStatus = (typeof PRODUCT_IMAGE_STATUSES)[number];

export function isProductStatus(value: string): value is ProductStatus {
  return (PRODUCT_STATUSES as readonly string[]).includes(value);
}

export function isProductImageStatus(value: string): value is ProductImageStatus {
  return (PRODUCT_IMAGE_STATUSES as readonly string[]).includes(value);
}
