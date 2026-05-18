export type ProductWorkflowStage = "draft" | "analysis" | "prompt" | "video" | "upload";

export type ProductUploadScope = "none" | "shopee" | "tiktok" | "both";

export type ProductListFilter = "all" | ProductWorkflowStage;

export type ProductWorkflowStatusJson = {
  video_generated: boolean;
  uploaded_shopee: boolean;
  uploaded_tiktok: boolean;
};

export type ProductListRow = {
  id: string;
  product_code: string;
  product_name: string;
  niche: string | null;
  workspace_label: string;
  marketplace: string | null;
  marketplace_product_link: string | null;
  keyword: string;
  product_status: string;
  intake_status: string;
  created_at: string;
  created_at_label: string;
  latest_activity_at: string | null;
  latest_activity_label: string;
  thumbnail_url: string | null;
  href: string;
  continue_href: string | null;
  prompt_href: string | null;
  primary_status_label: string;
  status_context_label: string | null;
  workflow_stage: ProductWorkflowStage;
  upload_scope: ProductUploadScope;
  workflow_status_json: ProductWorkflowStatusJson;
  search_text: string;
};

export type PaginationState = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export const PRODUCT_LIST_MOBILE_PAGE_SIZE = 20;
export const PRODUCT_LIST_DESKTOP_PAGE_SIZE = 25;
export const PRODUCT_LIST_MAX_PAGE_SIZE = 50;

export const PRODUCT_LIST_FILTERS: Array<{ key: ProductListFilter; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "draft", label: "Draf" },
  { key: "analysis", label: "Analisis" },
  { key: "prompt", label: "Prompt" },
  { key: "video", label: "Video" },
  { key: "upload", label: "Upload" },
];

export const PRODUCT_UPLOAD_FILTERS: Array<{ key: Exclude<ProductUploadScope, "none">; label: string }> = [
  { key: "shopee", label: "Shopee" },
  { key: "tiktok", label: "TikTok" },
  { key: "both", label: "Keduanya" },
];

function readText(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0].trim() : "";
  }

  return typeof value === "string" ? value.trim() : "";
}

export function normalizeProductListSearch(value: string | string[] | null | undefined) {
  return readText(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function normalizeProductListPage(value: string | string[] | number | null | undefined) {
  const rawValue = typeof value === "number" ? String(value) : readText(value);

  if (!rawValue) {
    return 1;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function normalizeProductListPageSize(value: string | string[] | number | null | undefined, fallback: number) {
  const rawValue = typeof value === "number" ? String(value) : readText(value);
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 1), PRODUCT_LIST_MAX_PAGE_SIZE);
}

export function normalizeProductListFilter(value: string | string[] | null | undefined): ProductListFilter {
  const normalized = readText(value).toLowerCase();

  return PRODUCT_LIST_FILTERS.some((filter) => filter.key === normalized) ? (normalized as ProductListFilter) : "all";
}

export function normalizeProductUploadFilter(value: string | string[] | null | undefined): Exclude<ProductUploadScope, "none"> | null {
  const normalized = readText(value).toLowerCase();

  return PRODUCT_UPLOAD_FILTERS.some((filter) => filter.key === normalized)
    ? (normalized as Exclude<ProductUploadScope, "none">)
    : null;
}

export function createPaginationState(input: { page: number; pageSize: number; totalCount: number }): PaginationState {
  const totalPages = Math.max(Math.ceil(input.totalCount / input.pageSize), 1);
  const page = input.totalCount > 0 ? Math.min(Math.max(input.page, 1), totalPages) : 1;

  return {
    page,
    pageSize: input.pageSize,
    totalCount: input.totalCount,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

export function buildProductListHref(params: {
  affiliateProfileId?: string | null;
  detailId?: string | null;
  filter?: ProductListFilter | null;
  page?: number | null;
  search?: string | null;
  showAllWorkspaces?: boolean;
  tab?: string | null;
  uploadFilter?: Exclude<ProductUploadScope, "none"> | null;
}) {
  const searchParams = new URLSearchParams();

  if (params.showAllWorkspaces) {
    searchParams.set("workspace", "all");
  }

  if (params.affiliateProfileId) {
    searchParams.set("affiliate_profile_id", params.affiliateProfileId);
  }

  if (params.detailId) {
    searchParams.set("detail", params.detailId);
  }

  if (params.tab) {
    searchParams.set("tab", params.tab);
  }

  if (params.search) {
    searchParams.set("q", params.search);
  }

  if (params.filter && params.filter !== "all") {
    searchParams.set("filter", params.filter);
  }

  if (params.uploadFilter) {
    searchParams.set("upload", params.uploadFilter);
  }

  if (params.page && params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  const queryString = searchParams.toString();
  return queryString ? `/products?${queryString}` : "/products";
}
