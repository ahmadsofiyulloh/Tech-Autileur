import type { PromptDetailTab } from "./prompt-detail-panel";
import type { PromptWorkbenchReadinessFilter } from "@/lib/prompts/prompt-workbench";

export function buildPromptsHref(params: {
  affiliateProfileId?: string | null;
  detailId?: string | null;
  intakeId?: string | null;
  page?: number | null;
  productId?: string | null;
  readiness?: PromptWorkbenchReadinessFilter | null;
  search?: string | null;
  tab?: PromptDetailTab | null;
  version?: string | null;
}) {
  const searchParams = new URLSearchParams();

  if (params.affiliateProfileId) {
    searchParams.set("affiliate_profile_id", params.affiliateProfileId);
  }

  if (params.productId) {
    searchParams.set("product_id", params.productId);
  }

  if (params.intakeId) {
    searchParams.set("intake_id", params.intakeId);
  }

  if (params.detailId) {
    searchParams.set("detail", params.detailId);
  }

  if (params.tab && params.tab !== "output") {
    searchParams.set("tab", params.tab);
  }

  if (params.version) {
    searchParams.set("version", params.version);
  }

  if (params.readiness && params.readiness !== "ALL") {
    searchParams.set("readiness", params.readiness);
  }

  if (params.search) {
    searchParams.set("q", params.search);
  }

  if (params.page && params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  const queryString = searchParams.toString();
  return queryString ? `/prompts?${queryString}` : "/prompts";
}

export function buildProductContinueHref(params: { affiliateProfileId?: string | null; intakeSessionId?: string | null }) {
  if (!params.intakeSessionId) {
    return null;
  }

  const searchParams = new URLSearchParams({
    intake_id: params.intakeSessionId,
    step: "prompt",
  });

  if (params.affiliateProfileId) {
    searchParams.set("affiliate_profile_id", params.affiliateProfileId);
  }

  return `/products/new?${searchParams.toString()}`;
}

export function buildCompactPageNumbers(page: number, totalPages: number) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= totalPages));
  const sortedPages = Array.from(pages).sort((left, right) => left - right);
  const items: Array<number | "ellipsis"> = [];

  for (const targetPage of sortedPages) {
    const previous = items[items.length - 1];

    if (typeof previous === "number" && targetPage - previous > 1) {
      items.push("ellipsis");
    }

    items.push(targetPage);
  }

  return items;
}
