import { isSharePlatform, type SharePlatform } from "./share-platform";

export type ShareListRow = {
  id: string;
  product_name: string;
  marketplace: string | null;
  product_url: string | null;
  thumbnail_url: string | null;
  affiliate_url: string | null;
  share_status: ShareProductStatus;
  latest_generation_at: string | null;
  href: string;
  search_text: string;
};

export type ShareProductStatus = "needs_link" | "ready" | "generated" | "error";

export type PaginationState = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export const SHARE_LIST_MOBILE_PAGE_SIZE = 20;
export const SHARE_LIST_DESKTOP_PAGE_SIZE = 25;
export const SHARE_LIST_MAX_PAGE_SIZE = 50;

function readText(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0].trim() : "";
  }

  return typeof value === "string" ? value.trim() : "";
}

export function normalizeShareListSearch(value: string | string[] | null | undefined) {
  return readText(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function normalizeShareListPage(value: string | string[] | number | null | undefined) {
  const rawValue = typeof value === "number" ? String(value) : readText(value);

  if (!rawValue) {
    return 1;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function normalizeShareListPageSize(value: string | string[] | number | null | undefined, fallback: number) {
  const rawValue = typeof value === "number" ? String(value) : readText(value);
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 1), SHARE_LIST_MAX_PAGE_SIZE);
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

export function buildShareListHref(params: {
  platform: SharePlatform;
  detailId?: string | null;
  tab?: string | null;
  search?: string | null;
  page?: number | null;
}) {
  const searchParams = new URLSearchParams();

  if (params.detailId) {
    searchParams.set("detail", params.detailId);
  }

  if (params.tab) {
    searchParams.set("tab", params.tab);
  }

  if (params.search) {
    searchParams.set("q", params.search);
  }

  if (params.page && params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  const queryString = searchParams.toString();
  return queryString ? `/share/${params.platform}?${queryString}` : `/share/${params.platform}`;
}

export function normalizeShareDetailId(value: string | string[] | null | undefined) {
  return readText(value) || null;
}

export type ShareTab = "output" | "history" | "generate";

export function normalizeShareTab(value: string | string[] | null | undefined): ShareTab {
  const raw = readText(value).toLowerCase();
  if (raw === "history") return "history";
  if (raw === "generate") return "generate";
  return "output";
}

export function normalizeSharePlatformParam(value: string | null | undefined): SharePlatform | null {
  if (!value) return null;
  return isSharePlatform(value) ? value : null;
}
