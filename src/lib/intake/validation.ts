export const MARKETPLACE_PLATFORMS = ["SHOPEE", "TIKTOK"] as const;

export const INTAKE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "NEEDS_REVIEW",
  "REVIEWED",
  "ANCHOR_READY",
  "ARCHIVED",
  "ERROR",
] as const;

export const MARKETPLACE_SOURCE_STATUSES = ["DRAFT", "ACTIVE", "NEEDS_REVIEW", "ARCHIVED", "ERROR"] as const;

export const PRODUCT_ANCHOR_STATUSES = ["DRAFT", "READY", "USED_FOR_PROMPT", "ARCHIVED", "ERROR"] as const;

export type MarketplacePlatform = (typeof MARKETPLACE_PLATFORMS)[number];
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];
export type MarketplaceSourceStatus = (typeof MARKETPLACE_SOURCE_STATUSES)[number];
export type ProductAnchorStatus = (typeof PRODUCT_ANCHOR_STATUSES)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = Record<string, JsonValue>;

export function isMarketplacePlatform(value: string): value is MarketplacePlatform {
  return (MARKETPLACE_PLATFORMS as readonly string[]).includes(value);
}

export function isIntakeStatus(value: string): value is IntakeStatus {
  return (INTAKE_STATUSES as readonly string[]).includes(value);
}

export function isMarketplaceSourceStatus(value: string): value is MarketplaceSourceStatus {
  return (MARKETPLACE_SOURCE_STATUSES as readonly string[]).includes(value);
}

export function isProductAnchorStatus(value: string): value is ProductAnchorStatus {
  return (PRODUCT_ANCHOR_STATUSES as readonly string[]).includes(value);
}

export function readIntakeText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeIntakeText(value: string | null | undefined) {
  const trimmed = readIntakeText(value);
  return trimmed.length > 0 ? trimmed : null;
}

export function hasMinimumIntakeInput(input: {
  product_title?: string | null;
  shopee_url?: string | null;
  tiktok_url?: string | null;
  product_photo_drive_item_ref_id?: string | null;
  screenshot_drive_item_ref_id?: string | null;
  raw_notes?: string | null;
}) {
  return Boolean(
    normalizeIntakeText(input.product_title) ||
      normalizeIntakeText(input.shopee_url) ||
      normalizeIntakeText(input.tiktok_url) ||
      normalizeIntakeText(input.product_photo_drive_item_ref_id) ||
      normalizeIntakeText(input.screenshot_drive_item_ref_id) ||
      normalizeIntakeText(input.raw_notes),
  );
}
