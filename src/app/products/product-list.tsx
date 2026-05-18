"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Edit3, FileText, Package, Plus, Search, X } from "lucide-react";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { NativeButton, NativeLinkButton } from "@/components/ui/native-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { MediaThumbnailFrame } from "@/components/operator/media-thumbnail-frame";
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

function resolveIntakeStatusBadge(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "DRAFT") {
    return { status: "Draft", tone: "info" as const };
  }

  if (normalized === "SUBMITTED") {
    return { status: "Masuk", tone: "info" as const };
  }

  if (normalized === "NEEDS_REVIEW") {
    return { status: "Verif", tone: "warning" as const };
  }

  if (normalized === "REVIEWED") {
    return { status: "Cek", tone: "success" as const };
  }

  if (normalized === "ANCHOR_READY") {
    return { status: "Siap", tone: "success" as const };
  }

  if (normalized === "ARCHIVED") {
    return { status: "Arsip", tone: "neutral" as const };
  }

  if (normalized === "ERROR") {
    return { status: "Error", tone: "danger" as const };
  }

  return { status: status.replaceAll("_", " "), tone: "info" as const };
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
  const [activeStatusProductId, setActiveStatusProductId] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileRows, setMobileRows] = useState<ProductListRow[]>(() => products.slice(0, PRODUCT_LIST_MOBILE_PAGE_SIZE));
  const [mobilePagination, setMobilePagination] = useState<PaginationState>(() => deriveInitialMobilePagination(pagination.totalCount));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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
    <section className="product-master" aria-label="Daftar produk" data-has-detail={activeProductId ? "true" : undefined}>
      <div className="product-master__list stack">
        <form className="settings-list-toolbar product-list-toolbar" action="/products" method="get">
          {showAllWorkspaces ? <input type="hidden" name="workspace" value="all" /> : null}
          {affiliateProfileId ? <input type="hidden" name="affiliate_profile_id" value={affiliateProfileId} /> : null}
          {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
          {uploadFilter ? <input type="hidden" name="upload" value={uploadFilter} /> : null}
          <input type="hidden" name="page" value="1" />
          <label className="product-search" htmlFor="product-search">
            <Search size={16} aria-hidden="true" />
            <input id="product-search" name="q" aria-label="Cari produk" placeholder="Cari produk" defaultValue={search} />
          </label>
          <NativeButton className="compact primary" type="submit">
            <Search size={15} aria-hidden="true" />
            Cari
          </NativeButton>
          {search ? (
            <NativeLinkButton
              className="compact tertiary"
              href={buildProductListHref({
                affiliateProfileId,
                filter,
                showAllWorkspaces,
                uploadFilter,
              })}
            >
              <X size={15} aria-hidden="true" />
              Bersihkan
            </NativeLinkButton>
          ) : null}
        </form>

        <div className="settings-inline-summary">
          <span>{pagination.totalCount} hasil</span>
          <NativeLinkButton className="compact primary" href="/products/new">
            <Plus size={15} aria-hidden="true" />
            Intake baru
          </NativeLinkButton>
        </div>

        <div className="product-filter-stack">
          <div className="content-filter-tabs" role="tablist" aria-label="Filter produk">
            {PRODUCT_LIST_FILTERS.map((targetFilter) => (
              <NativeLinkButton
                aria-selected={filter === targetFilter.key}
                className="content-filter-tab"
                data-active={filter === targetFilter.key ? "true" : undefined}
                href={buildProductListHref({
                  affiliateProfileId,
                  filter: targetFilter.key,
                  page: 1,
                  search,
                  showAllWorkspaces,
                  uploadFilter: targetFilter.key === "upload" ? uploadFilter : null,
                })}
                key={targetFilter.key}
                role="tab"
              >
                {targetFilter.label}
              </NativeLinkButton>
            ))}
          </div>

          {filter === "upload" ? (
            <div className="content-filter-tabs content-filter-tabs--sub" role="tablist" aria-label="Filter upload">
              {PRODUCT_UPLOAD_FILTERS.map((targetFilter) => (
                <NativeLinkButton
                  aria-selected={uploadFilter === targetFilter.key}
                  className="content-filter-tab"
                  data-active={uploadFilter === targetFilter.key ? "true" : undefined}
                  href={buildProductListHref({
                    affiliateProfileId,
                    filter,
                    page: 1,
                    search,
                    showAllWorkspaces,
                    uploadFilter: uploadFilter === targetFilter.key ? null : targetFilter.key,
                  })}
                  key={targetFilter.key}
                  role="tab"
                >
                  {targetFilter.label}
                </NativeLinkButton>
              ))}
            </div>
          ) : null}
        </div>

        <div className="table-wrap products-table-desktop">
          <table className="data-table product-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Keyword</th>
                <th>Status</th>
                <th>Dibuat</th>
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
                        {product.marketplace ? <span className="settings-card-meta-line">{product.marketplace}</span> : null}
                      </div>
                    </div>
                  </td>
                  <td>{fieldValue(product.keyword)}</td>
                  <td>
                    <div className="stack-tight">
                      <div className="product-status-stack">
                        <StatusBadge status={product.primary_status_label} />
                        {product.intake_status ? (
                          <StatusBadge {...resolveIntakeStatusBadge(product.intake_status)} />
                        ) : null}
                      </div>
                      {product.status_context_label ? (
                        <span className="settings-card-meta-line product-card-status-line" title={product.status_context_label}>
                          {product.status_context_label}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>{product.created_at_label}</td>
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
                  <td colSpan={5}>
                    <section className="muted-box">Tidak ada produk.</section>
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>
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
                    <StatusBadge status={product.primary_status_label} />
                    {product.status_context_label ? (
                      <span className="settings-card-meta-line product-card-status-line" title={product.status_context_label}>
                        {product.status_context_label}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="visual-list-card__footer">
                  <span>{product.created_at_label}</span>
                  {product.marketplace ? <span>{product.marketplace}</span> : null}
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
          {!mobileRows.length ? <section className="muted-box">Tidak ada produk.</section> : null}
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
