import { redirect } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { OperatorDetailDrawer } from "@/components/operator/detail-drawer";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { NativeLinkButton } from "@/components/ui/native-button";
import { buildProductListHref, PRODUCT_LIST_DESKTOP_PAGE_SIZE, normalizeProductListFilter, normalizeProductListPage, normalizeProductListSearch, normalizeProductUploadFilter } from "@/lib/products/product-list-contract";
import { listProductListPage } from "@/lib/server/product-list";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductDetailPanel, resolveProductDetailTab } from "./product-detail-panel";
import { ProductList } from "./product-list";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{
    affiliate_profile_id?: string | string[];
    detail?: string | string[];
    filter?: string | string[];
    page?: string | string[];
    q?: string | string[];
    tab?: string | string[];
    upload?: string | string[];
    workspace?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const query = await searchParams;
  const requestedAffiliateProfileId = firstParam(query.affiliate_profile_id) ?? null;
  const requestedFilter = normalizeProductListFilter(firstParam(query.filter));
  const requestedPage = normalizeProductListPage(firstParam(query.page));
  const requestedSearch = normalizeProductListSearch(firstParam(query.q));
  const requestedUploadFilter = normalizeProductUploadFilter(firstParam(query.upload));
  const selectedProductDetailId = firstParam(query.detail) ?? "";
  const selectedProductDetailTab = resolveProductDetailTab(firstParam(query.tab));
  const showAllWorkspaces = firstParam(query.workspace) === "all";

  let currentWorkspace: Awaited<ReturnType<typeof getCurrentWorkspace>> | null = null;
  let productPage: Awaited<ReturnType<typeof listProductListPage>> | null = null;

  try {
    currentWorkspace = await getCurrentWorkspace();
    productPage = await listProductListPage({
      affiliateProfileId: requestedAffiliateProfileId,
      filter: requestedFilter,
      page: requestedPage,
      pageSize: PRODUCT_LIST_DESKTOP_PAGE_SIZE,
      search: requestedSearch,
      showAllWorkspaces,
      uploadFilter: requestedUploadFilter,
      workspaceId: currentWorkspace && !showAllWorkspaces ? currentWorkspace.id : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load products.";

    return (
      <SectionCard icon={Package} title="Produk tidak bisa dimuat." description={message}>
        <EmptyState icon={Package} title="Produk tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  if (!productPage) {
    return (
      <SectionCard icon={Package} title="Produk tidak bisa dimuat." description="Produk tidak tersedia.">
        <EmptyState icon={Package} title="Produk tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  const selectedProductRow = productPage.rows.find((product) => product.id === selectedProductDetailId) ?? null;
  const hasProductDetail = Boolean(selectedProductDetailId && selectedProductRow);
  const productsCloseHref = buildProductListHref({
    affiliateProfileId: requestedAffiliateProfileId,
    filter: requestedFilter,
    page: productPage.pagination.page,
    search: requestedSearch,
    showAllWorkspaces,
    uploadFilter: requestedUploadFilter,
  });
  const productDetailHrefBase = selectedProductRow
    ? buildProductListHref({
        affiliateProfileId: requestedAffiliateProfileId,
        detailId: selectedProductDetailId,
        filter: requestedFilter,
        page: productPage.pagination.page,
        search: requestedSearch,
        showAllWorkspaces,
        uploadFilter: requestedUploadFilter,
      })
    : productsCloseHref;
  const productDetailSubtitle = selectedProductRow
    ? [selectedProductRow.workspace_label, selectedProductRow.primary_status_label].filter(Boolean).join(" - ")
    : null;
  const shouldShowList =
    productPage.totalProductCount > 0 ||
    requestedSearch.length > 0 ||
    requestedFilter !== "all" ||
    Boolean(requestedUploadFilter);

  return (
    <div className="operator-detail-layout" data-has-detail={hasProductDetail ? "true" : undefined}>
      <div className="operator-detail-layout__list">
        {shouldShowList ? (
          <ProductList
            activeProductId={hasProductDetail ? selectedProductDetailId : null}
            affiliateProfileId={requestedAffiliateProfileId}
            filter={requestedFilter}
            pagination={productPage.pagination}
            products={productPage.rows}
            search={requestedSearch}
            showAllWorkspaces={showAllWorkspaces}
            uploadFilter={requestedUploadFilter}
          />
        ) : (
          <EmptyState
            icon={Package}
            title={currentWorkspace && !showAllWorkspaces ? "Belum ada produk di workspace ini." : "Belum ada produk."}
            description="Mulai dari intake."
            action={
              <NativeLinkButton className="primary" href="/products/new">
                <Plus size={16} aria-hidden="true" />
                Intake baru
              </NativeLinkButton>
            }
          />
        )}
      </div>

      {selectedProductRow ? (
        <OperatorDetailDrawer
          ariaLabel="Detail produk"
          closeHref={productsCloseHref}
          subtitle={productDetailSubtitle}
          title={selectedProductRow.product_name ?? "Detail produk"}
        >
          <ProductDetailPanel
            activeTab={selectedProductDetailTab}
            detailHrefBase={productDetailHrefBase}
            productId={selectedProductRow.id}
          />
        </OperatorDetailDrawer>
      ) : null}
    </div>
  );
}
