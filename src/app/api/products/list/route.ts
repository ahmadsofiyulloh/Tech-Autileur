import {
  PRODUCT_LIST_MOBILE_PAGE_SIZE,
  normalizeProductListFilter,
  normalizeProductListPage,
  normalizeProductListPageSize,
  normalizeProductListSearch,
  normalizeProductUploadFilter,
} from "@/lib/products/product-list-contract";
import { listProductListPage } from "@/lib/server/product-list";
import { getCurrentWorkspace } from "@/lib/server/workspaces";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const showAllWorkspaces = url.searchParams.get("workspace") === "all";
    const currentWorkspace = await getCurrentWorkspace();
    const productPage = await listProductListPage({
      affiliateProfileId: url.searchParams.get("affiliate_profile_id"),
      filter: normalizeProductListFilter(url.searchParams.get("filter")),
      page: normalizeProductListPage(url.searchParams.get("page")),
      pageSize: normalizeProductListPageSize(url.searchParams.get("page_size"), PRODUCT_LIST_MOBILE_PAGE_SIZE),
      search: normalizeProductListSearch(url.searchParams.get("q")),
      showAllWorkspaces,
      uploadFilter: normalizeProductUploadFilter(url.searchParams.get("upload")),
      workspaceId: currentWorkspace && !showAllWorkspaces ? currentWorkspace.id : undefined,
    });

    return Response.json({
      pagination: productPage.pagination,
      rows: productPage.rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Produk gagal dimuat.";
    const status = message.includes("Authentication") ? 401 : 400;

    return Response.json({ error: message }, { status });
  }
}
