"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Edit3, FileText, Package, Plus, Search } from "lucide-react";
import { ActionToolbar } from "@/components/operator/action-toolbar";
import { EmptyState } from "@/components/operator/empty-state";
import { FilterChips } from "@/components/operator/filter-chips";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { NativeButton, NativeLinkButton } from "@/components/ui/native-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { MediaThumbnailFrame } from "@/components/operator/media-thumbnail-frame";
import { SearchInput } from "@/components/operator/search-input";
import { StatusBadge } from "@/components/operator/status-badge";
import {
  buildProductListHref,
  createPaginationState,
  PRODUCT_LIST_FILTERS,
  PRODUCT_LIST_MOBILE_PAGE_SIZE,
  PRODUCT_UPLOAD_FILTERS,
  type PaginationState,
  type ProductListFilter,
  type ProductListRow,
  type ProductUploadScope,
} from "@/lib/products/product-list-contract";
import { saveProduct } from "./actions";
import { ProductStatusSheet } from "./product-metadata-sheet";

const PRODUCT_LIST_MOBILE_MEDIA_QUERY = "(max-width: 860px)";

type ProductListProps = {
  activeProductId?: string | null;
  affiliateProfileId?: string | null;
  filter: ProductListFilter;
  pagination: PaginationState;
  products: ProductListRow[];
  search: string;
  showAllWorkspaces: boolean;
  uploadFilter: Exclude<ProductUploadScope, "none"> | null;
};

function fieldValue(value: string | null | undefined) {
  return value && value.length > 0 ? value : "Belum ada";
}

function ProductThumbnail({
  alt,
  className,
  fallbackSize,
  src,
}: {
  alt: string;
  className: string;
  fallbackSize: number;
  src: string | null;
}) {
  return (
    <MediaThumbnailFrame
      alt={alt}
      className={className}
      fallback={<Package size={fallbackSize} aria-hidden="true" />}
      src={src}
    />
  );
}

function buildCompactPageNumbers(page: number, totalPages: number) {
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

function ProductPaginationStepper({
  affiliateProfileId,
  filter,
  pagination,
  search,
  showAllWorkspaces,
  uploadFilter,
}: {
  affiliateProfileId?: string | null;
  filter: ProductListFilter;
  pagination: PaginationState;
  search: string;
  showAllWorkspaces: boolean;
  uploadFilter: Exclude<ProductUploadScope, "none"> | null;
}) {
  const pageItems = buildCompactPageNumbers(pagination.page, pagination.totalPages);

  return (
    <nav className="list-pagination-stepper" aria-label="Navigasi halaman produk">
      <div className="list-pagination-stepper__status">
        <StatusBadge status={`Halaman ${pagination.page}/${pagination.totalPages}`} tone="neutral" />
      </div>
      <div className="list-pagination-stepper__controls">
        {pagination.hasPreviousPage ? (
          <NativeLinkButton
            className="compact tertiary"
            href={buildProductListHref({
              affiliateProfileId,
              filter,
              page: pagination.page - 1,
              search,
              showAllWorkspaces,
              uploadFilter,
            })}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Sebelumnya
          </NativeLinkButton>
        ) : (
          <NativeButton className="compact tertiary" type="button" disabled>
            <ArrowLeft size={15} aria-hidden="true" />
            Sebelumnya
          </NativeButton>
        )}

        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <span className="list-pagination-stepper__ellipsis" aria-hidden="true" key={`ellipsis-${index}`}>
              ...
            </span>
          ) : item === pagination.page ? (
            <NativeButton className="compact primary" type="button" aria-current="page" disabled key={item}>
              {item}
            </NativeButton>
          ) : (
            <NativeLinkButton
              className="compact tertiary"
              href={buildProductListHref({
                affiliateProfileId,
                filter,
                page: item,
                search,
                showAllWorkspaces,
                uploadFilter,
              })}
              key={item}
            >
              {item}
            </NativeLinkButton>
          ),
        )}

        {pagination.hasNextPage ? (
          <NativeLinkButton
            className="compact tertiary"
            href={buildProductListHref({
              affiliateProfileId,
              filter,
              page: pagination.page + 1,
              search,
              showAllWorkspaces,
              uploadFilter,
            })}
          >
            Berikutnya
            <ArrowRight size={15} aria-hidden="true" />
          </NativeLinkButton>
        ) : (
          <NativeButton className="compact tertiary" type="button" disabled>
            Berikutnya
            <ArrowRight size={15} aria-hidden="true" />
          </NativeButton>
        )}
      </div>
    </nav>
  );
}

function deriveInitialMobilePagination(totalCount: number) {
  return createPaginationState({
    page: 1,
    pageSize: PRODUCT_LIST_MOBILE_PAGE_SIZE,
    totalCount,
  });
}

export function ProductList({
  activeProductId,
  affiliateProfileId,
  filter,
  pagination,
  products,
  search,
  showAllWorkspaces,
  uploadFilter,
}: ProductListProps) {
  const isDetailMode = Boolean(activeProductId);
  const [activeStatusProductId, setActiveStatusProductId] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileRows, setMobileRows] = useState<ProductListRow[]>(() => products.slice(0, PRODUCT_LIST_MOBILE_PAGE_SIZE));
  const [mobilePagination, setMobilePagination] = useState<PaginationState>(() => deriveInitialMobilePagination(pagination.totalCount));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const desktopColumnCount = isDetailMode ? 3 : 5;

  useEffect(() => {
    setMobileRows(products.slice(0, PRODUCT_LIST_MOBILE_PAGE_SIZE));
    setMobilePagination(deriveInitialMobilePagination(pagination.totalCount));
    setLoadMoreError(null);
  }, [filter, pagination.totalCount, products, search, uploadFilter]);

  useEffect(() => {
    if (activeStatusProductId && !products.some((product) => product.id === activeStatusProductId)) {
      setActiveStatusProductId(null);
    }
  }, [activeStatusProductId, products]);

  useEffect(() => {
    if (!window.matchMedia) {
      setIsMobileViewport(false);
      return;
    }

    const media = window.matchMedia(PRODUCT_LIST_MOBILE_MEDIA_QUERY);
    const updateViewportState = () => setIsMobileViewport(media.matches);

    updateViewportState();
    media.addEventListener("change", updateViewportState);

    return () => media.removeEventListener("change", updateViewportState);
  }, []);

  const selectedStatusProduct = useMemo(
    () => products.find((product) => product.id === activeStatusProductId) ?? mobileRows.find((product) => product.id === activeStatusProductId) ?? null,
    [activeStatusProductId, mobileRows, products],
  );

  const loadMoreProducts = useCallback(async () => {
    if (isLoadingMore || !mobilePagination.hasNextPage) {
      return;
    }

    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const params = new URLSearchParams();

      if (showAllWorkspaces) {
        params.set("workspace", "all");
      }

      if (affiliateProfileId) {
        params.set("affiliate_profile_id", affiliateProfileId);
      }

      if (search) {
        params.set("q", search);
      }

      if (filter !== "all") {
        params.set("filter", filter);
      }

      if (uploadFilter) {
        params.set("upload", uploadFilter);
      }

      params.set("page", String(mobilePagination.page + 1));
      params.set("page_size", String(PRODUCT_LIST_MOBILE_PAGE_SIZE));

      const response = await fetch(`/api/products/list?${params.toString()}`, {
        headers: {
          accept: "application/json",
        },
      });

      const payload = (await response.json()) as {
        error?: string;
        pagination?: PaginationState;
        rows?: ProductListRow[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Produk gagal dimuat.");
      }

      setMobileRows((current) => {
        const existingIds = new Set(current.map((row) => row.id));
        const nextRows = (payload.rows ?? []).filter((row) => !existingIds.has(row.id));
        return [...current, ...nextRows];
      });
      setMobilePagination(payload.pagination ?? mobilePagination);
    } catch (error) {
      setLoadMoreError(error instanceof Error ? error.message : "Produk gagal dimuat.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    affiliateProfileId,
    filter,
    isLoadingMore,
    mobilePagination,
    search,
    showAllWorkspaces,
    uploadFilter,
  ]);

  useEffect(() => {
    if (!isMobileViewport || !mobilePagination.hasNextPage || !loadMoreRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreProducts();
        }
      },
      {
        rootMargin: "240px 0px",
      },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [isMobileViewport, loadMoreProducts, mobilePagination.hasNextPage]);

  return (
    <section className="product-master" aria-label="Daftar produk" data-has-detail={isDetailMode ? "true" : undefined}>
      <div className="product-master__list stack">
        <ActionToolbar
          action="/products"
          method="get"
          controlsClassName="product-list-toolbar"
          search={
            <SearchInput
              id="product-search"
              name="q"
              label="Cari produk"
              placeholder="Cari produk"
              defaultValue={search}
              clearHref={buildProductListHref({
                affiliateProfileId,
                filter,
                showAllWorkspaces,
                uploadFilter,
              })}
            />
          }
          actions={
            <>
              <NativeButton className="compact primary" type="submit">
                <Search size={15} aria-hidden="true" />
                Cari
              </NativeButton>
            </>
          }
          summary={`${pagination.totalCount} hasil`}
          primaryAction={
            <NativeLinkButton className="compact primary" href="/products/new">
              <Plus size={15} aria-hidden="true" />
              Intake baru
            </NativeLinkButton>
          }
        >
          {showAllWorkspaces ? <input type="hidden" name="workspace" value="all" /> : null}
          {affiliateProfileId ? <input type="hidden" name="affiliate_profile_id" value={affiliateProfileId} /> : null}
          {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
          {uploadFilter ? <input type="hidden" name="upload" value={uploadFilter} /> : null}
          <input type="hidden" name="page" value="1" />
        </ActionToolbar>

        <div className="product-filter-stack">
          <FilterChips
            label="Filter produk"
            items={PRODUCT_LIST_FILTERS.map((targetFilter) => ({
              active: filter === targetFilter.key,
              href: buildProductListHref({
                affiliateProfileId,
                filter: targetFilter.key,
                page: 1,
                search,
                showAllWorkspaces,
                uploadFilter: targetFilter.key === "upload" ? uploadFilter : null,
              }),
              key: targetFilter.key,
              label: targetFilter.label,
            }))}
          />

          {filter === "upload" ? (
            <FilterChips
              className="content-filter-tabs--sub"
              label="Filter upload"
              items={PRODUCT_UPLOAD_FILTERS.map((targetFilter) => ({
                active: uploadFilter === targetFilter.key,
                href: buildProductListHref({
                  affiliateProfileId,
                  filter,
                  page: 1,
                  search,
                  showAllWorkspaces,
                  uploadFilter: uploadFilter === targetFilter.key ? null : targetFilter.key,
                }),
                key: targetFilter.key,
                label: targetFilter.label,
              }))}
            />
          ) : null}
        </div>

        <div className="table-wrap products-table-desktop">
          <table className="data-table dense-table product-table" aria-label="Produk">
            <colgroup>
              <col className="product-table__col-product" />
              {isDetailMode ? null : <col className="product-table__col-keyword" />}
              <col className="product-table__col-status" />
              {isDetailMode ? null : <col className="product-table__col-update" />}
              <col className="product-table__col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Produk</th>
                {isDetailMode ? null : <th>Keyword</th>}
                <th>Status</th>
                {isDetailMode ? null : <th>Update</th>}
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr data-active={activeProductId === product.id ? "true" : undefined} key={product.id}>
                  <td>
                    <div className="product-table-product-cell">
                      <ProductThumbnail
                        alt={product.product_name}
                        className="product-table-thumb"
                        fallbackSize={18}
                        src={product.thumbnail_url}
                      />
                      <div className="stack-tight">
                        <strong title={product.product_name}>{product.product_name}</strong>
                        <span className="product-table-meta-line">
                          {[product.marketplace, product.created_at_label].filter(Boolean).join(" / ")}
                        </span>
                      </div>
                    </div>
                  </td>
                  {isDetailMode ? null : (
                    <td>
                      <span className="product-table-text" title={fieldValue(product.keyword)}>
                        {fieldValue(product.keyword)}
                      </span>
                    </td>
                  )}
                  <td>
                    <div className="product-status-cell">
                      <StatusBadge status={product.primary_status_label} size="sm" />
                      {product.status_context_label ? <span>{product.status_context_label}</span> : null}
                    </div>
                  </td>
                  {isDetailMode ? null : (
                    <td>
                      <span className="product-table-text" title={product.latest_activity_label}>
                        {product.latest_activity_label}
                      </span>
                    </td>
                  )}
                  <td>
                    <div className="product-row-actions product-row-actions--desktop">
                      <NativeLinkButton className={`compact ${product.continue_href ? "primary" : ""}`.trim()} href={product.continue_href ?? product.href}>
                        <ArrowRight size={15} aria-hidden="true" />
                        {product.continue_href ? "Lanjutkan" : "Detail"}
                      </NativeLinkButton>
                      <OverflowActionMenu label="Aksi produk">
                        {product.prompt_href ? (
                          <NativeLinkButton className="compact" href={product.prompt_href}>
                            <FileText size={15} aria-hidden="true" />
                            Prompt
                          </NativeLinkButton>
                        ) : null}
                        {product.continue_href ? (
                          <NativeLinkButton className="compact" href={product.href}>
                            <ArrowRight size={15} aria-hidden="true" />
                            Detail
                          </NativeLinkButton>
                        ) : null}
                        <NativeButton
                          className="compact"
                          type="button"
                          onClick={() => {
                            setActiveStatusProductId(product.id);
                          }}
                        >
                          <Edit3 size={15} aria-hidden="true" />
                          Ubah status
                        </NativeButton>
                        <form action={saveProduct}>
                          <input type="hidden" name="intent" value="archive" />
                          <input type="hidden" name="id" value={product.id} />
                          <DeleteActionButton confirmMessage={`Hapus produk "${product.product_name}"?`} />
                        </form>
                      </OverflowActionMenu>
                    </div>
                  </td>
                </tr>
              ))}
              {!products.length ? (
                <tr>
                  <td colSpan={desktopColumnCount}>
                    <EmptyState icon={Package} title="Produk tidak ditemukan." description="Ubah filter atau cari produk lain." />
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={desktopColumnCount}>
                  <ProductPaginationStepper
                    affiliateProfileId={affiliateProfileId}
                    filter={filter}
                    pagination={pagination}
                    search={search}
                    showAllWorkspaces={showAllWorkspaces}
                    uploadFilter={uploadFilter}
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="products-cards-mobile">
          {mobileRows.map((product) => (
            <article className="visual-list-card" data-active={activeProductId === product.id ? "true" : undefined} key={product.id}>
              <ProductThumbnail alt={product.product_name} className="visual-list-card__thumb" fallbackSize={28} src={product.thumbnail_url} />
              <div className="visual-list-card__body">
                <div className="visual-list-card__header">
                  <div className="visual-list-card__copy">
                    <strong title={product.product_name}>{product.product_name}</strong>
                    <span>{fieldValue(product.keyword)}</span>
                  </div>
                  <div className="visual-list-card__status" aria-label="Status produk">
                    <StatusBadge status={product.primary_status_label} size="sm" />
                  </div>
                </div>
                <div className="visual-list-card__footer">
                  <span>{product.latest_activity_label}</span>
                  {product.marketplace ? <span>{product.marketplace}</span> : null}
                  {product.status_context_label ? <span>{product.status_context_label}</span> : null}
                </div>
                <div className="mobile-card-actions">
                  <NativeLinkButton className="compact primary" href={product.continue_href ?? product.href}>
                    <ArrowRight size={15} aria-hidden="true" />
                    {product.continue_href ? "Lanjutkan" : "Detail"}
                  </NativeLinkButton>
                  <OverflowActionMenu label="Aksi produk">
                    {product.prompt_href ? (
                      <NativeLinkButton className="compact" href={product.prompt_href}>
                        <FileText size={15} aria-hidden="true" />
                        Prompt
                      </NativeLinkButton>
                    ) : null}
                    {product.continue_href ? (
                      <NativeLinkButton className="compact" href={product.href}>
                        <ArrowRight size={15} aria-hidden="true" />
                        Detail
                      </NativeLinkButton>
                    ) : null}
                    <NativeButton
                      className="compact"
                      type="button"
                      onClick={() => {
                        setActiveStatusProductId(product.id);
                      }}
                    >
                      <Edit3 size={15} aria-hidden="true" />
                      Ubah status
                    </NativeButton>
                    <form action={saveProduct}>
                      <input type="hidden" name="intent" value="archive" />
                      <input type="hidden" name="id" value={product.id} />
                      <DeleteActionButton confirmMessage={`Hapus produk "${product.product_name}"?`} />
                    </form>
                  </OverflowActionMenu>
                </div>
              </div>
            </article>
          ))}
          {!mobileRows.length ? <EmptyState icon={Package} title="Produk tidak ditemukan." description="Ubah filter atau cari produk lain." /> : null}
          {loadMoreError ? <section className="muted-box">{loadMoreError}</section> : null}
          <div ref={loadMoreRef} aria-hidden="true" />
          {mobilePagination.hasNextPage ? (
            <NativeButton className="compact tertiary product-mobile-load-more" type="button" onClick={() => void loadMoreProducts()} disabled={isLoadingMore}>
              {isLoadingMore ? "Memuat" : "Muat lagi"}
            </NativeButton>
          ) : null}
        </div>
      </div>

      <ProductStatusSheet
        open={Boolean(selectedStatusProduct)}
        product={selectedStatusProduct}
        onClose={() => setActiveStatusProductId(null)}
      />
    </section>
  );
}
