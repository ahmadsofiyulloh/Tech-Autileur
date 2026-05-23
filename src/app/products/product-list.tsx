"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowLeft, ArrowRight, Check, Edit3, FileText, Package, Plus, Search, Square, Trash2 } from "lucide-react";
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
import { bulkArchiveProductsAction, saveProduct } from "./actions";
import { ProductStatusSheet } from "./product-metadata-sheet";

const PRODUCT_LIST_MOBILE_MEDIA_QUERY = "(max-width: 860px)";
const LONG_PRESS_DELAY_MS = 420;
const LONG_PRESS_MOVE_TOLERANCE_PX = 12;

function isTextInputTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;

  if (!element) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || element.isContentEditable;
}

function isModifierSelectAll(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a";
}

function isInteractiveChild(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.closest("a, button, input, select, textarea, form, [role='button']"));
}

function SelectionToggleButton({
  pressed,
  label,
  onClick,
  disabled = false,
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <NativeButton
      className={`compact ${pressed ? "primary" : "tertiary"}`.trim()}
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {pressed ? <Check size={15} aria-hidden="true" /> : <Square size={15} aria-hidden="true" />}
      {pressed ? "Dipilih" : "Pilih"}
    </NativeButton>
  );
}

function BulkArchiveSubmitButton({ disabled, iconOnly = false }: { disabled: boolean; iconOnly?: boolean }) {
  return (
    <NativeButton className={`compact danger${iconOnly ? " icon-only" : ""}`.trim()} type="submit" disabled={disabled} aria-label={iconOnly ? "Arsipkan" : undefined}>
      <Archive size={15} aria-hidden="true" />
      {iconOnly ? null : "Arsipkan"}
    </NativeButton>
  );
}

function createLongPressHandlers({
  enabled,
  onLongPress,
}: {
  enabled: boolean;
  onLongPress: () => void;
}) {
  const state = {
    timer: null as number | null,
    startX: 0,
    startY: 0,
    triggered: false,
  };

  const clearTimer = () => {
    if (state.timer) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
  };

  return {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || event.pointerType === "mouse" || isInteractiveChild(event.target)) {
        return;
      }

      state.startX = event.clientX;
      state.startY = event.clientY;
      state.triggered = false;
      clearTimer();
      state.timer = window.setTimeout(() => {
        state.triggered = true;
        onLongPress();
      }, LONG_PRESS_DELAY_MS);
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      if (!state.timer) {
        return;
      }

      const deltaX = Math.abs(event.clientX - state.startX);
      const deltaY = Math.abs(event.clientY - state.startY);

      if (deltaX > LONG_PRESS_MOVE_TOLERANCE_PX || deltaY > LONG_PRESS_MOVE_TOLERANCE_PX) {
        clearTimer();
      }
    },
    onPointerUp: () => {
      clearTimer();
    },
    onPointerCancel: () => {
      clearTimer();
    },
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
      if (state.triggered) {
        event.preventDefault();
      }
      state.triggered = false;
    },
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
      if (state.triggered) {
        event.preventDefault();
        event.stopPropagation();
        state.triggered = false;
      }
    },
  };
}


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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const desktopColumnCount = isDetailMode ? 3 : 5;

  const visibleRows = isMobileViewport ? mobileRows : products;
  const archivableRowIds = useMemo(() => {
    return new Set(visibleRows.map((row) => row.id));
  }, [visibleRows]);
  const selectedCount = selectedIds.size;
  const archivableCount = archivableRowIds.size;
  const allArchivableSelected = archivableCount > 0 && Array.from(archivableRowIds).every((id) => selectedIds.has(id));

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((current) => {
      const next = !current;
      if (!next) {
        setSelectedIds(new Set());
      }
      return next;
    });
  }, []);

  const toggleSelectedId = useCallback((productId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }, []);

  const beginSelectionAt = useCallback((productId: string) => {
    setSelectionMode(true);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.add(productId);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const everyVisibleSelected = Array.from(archivableRowIds).every((id) => next.has(id));

      if (everyVisibleSelected) {
        for (const id of archivableRowIds) {
          next.delete(id);
        }
      } else {
        for (const id of archivableRowIds) {
          next.add(id);
        }
      }

      return next;
    });
  }, [archivableRowIds]);


  useEffect(() => {
    setMobileRows(products.slice(0, PRODUCT_LIST_MOBILE_PAGE_SIZE));
    setMobilePagination(deriveInitialMobilePagination(pagination.totalCount));
    setLoadMoreError(null);
    exitSelectionMode();
  }, [exitSelectionMode, filter, pagination.totalCount, products, search, uploadFilter]);

  // Keyboard shortcuts — only active when selection mode is on, desktop only
  useEffect(() => {
    if (!selectionMode || isMobileViewport) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextInputTarget(event.target)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (selectedCount > 0) {
          clearSelection();
        } else {
          exitSelectionMode();
        }
        return;
      }

      if (isModifierSelectAll(event)) {
        event.preventDefault();
        toggleSelectAllVisible();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, exitSelectionMode, isMobileViewport, selectedCount, selectionMode, toggleSelectAllVisible]);

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
    <section className="product-master" aria-label="Daftar produk" data-has-detail={isDetailMode ? "true" : undefined} data-has-status-panel={selectedStatusProduct && !isMobileViewport ? "true" : undefined}>
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
          {selectionMode && selectedCount > 0 ? (
            <div className="product-selection-summary desktop-action-set">
              <div className="product-selection-summary__copy">
                <StatusBadge status={`${selectedCount} dipilih`} tone="neutral" />
              </div>
              <div className="product-selection-summary__actions">
                <NativeButton className="compact tertiary" type="button" onClick={clearSelection}>
                  Bersihkan
                </NativeButton>
                <form
                  action={bulkArchiveProductsAction}
                  onSubmit={(event) => {
                    if (!window.confirm(`Arsipkan ${selectedCount} produk terpilih?`)) {
                      event.preventDefault();
                    }
                  }}
                >
                  {Array.from(selectedIds).map((id) => (
                    <input type="hidden" name="product_ids" value={id} key={id} />
                  ))}
                  <BulkArchiveSubmitButton disabled={selectedCount === 0} />
                </form>
              </div>
            </div>
          ) : null}
          <table className={`data-table dense-table product-table${selectionMode ? " product-table--selection-mode" : ""}`} aria-label="Produk">
            <colgroup>
              {selectionMode ? <col className="product-table__col-select" /> : null}
              <col className="product-table__col-product" />
              {isDetailMode ? null : <col className="product-table__col-keyword" />}
              <col className="product-table__col-status" />
              {isDetailMode ? null : <col className="product-table__col-update" />}
              <col className="product-table__col-actions" />
            </colgroup>
            <thead>
              <tr>
                {selectionMode ? (
                  <th>
                    <SelectionToggleButton
                      pressed={allArchivableSelected}
                      label={allArchivableSelected ? "Batal pilih semua" : "Pilih semua"}
                      onClick={toggleSelectAllVisible}
                    />
                  </th>
                ) : null}
                <th>Produk</th>
                {isDetailMode ? null : <th>Keyword</th>}
                <th>Status</th>
                {isDetailMode ? null : <th>Update</th>}
                <th>
                  {selectionMode ? (
                    <NativeButton className="compact tertiary" type="button" onClick={exitSelectionMode}>
                      Batal
                    </NativeButton>
                  ) : (
                    <NativeButton className="compact tertiary" type="button" onClick={toggleSelectionMode}>
                      Pilih
                    </NativeButton>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr data-active={activeProductId === product.id ? "true" : undefined} data-selected={selectedIds.has(product.id) ? "true" : undefined} key={product.id}>
                  {selectionMode ? (
                    <td>
                      <SelectionToggleButton
                        pressed={selectedIds.has(product.id)}
                        label={selectedIds.has(product.id) ? `Batal pilih ${product.product_name}` : `Pilih ${product.product_name}`}
                        onClick={() => toggleSelectedId(product.id)}
                      />
                    </td>
                  ) : null}
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
                    {selectionMode ? null : (
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
                    )}
                  </td>
                </tr>
              ))}
              {!products.length ? (
                <tr>
                  <td colSpan={desktopColumnCount + (selectionMode ? 1 : 0)}>
                    <EmptyState icon={Package} title="Produk tidak ditemukan." description="Ubah filter atau cari produk lain." />
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={desktopColumnCount + (selectionMode ? 1 : 0)}>
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
          {selectionMode ? (
            <div className="product-selection-summary product-selection-summary--mobile">
              <div className="product-selection-summary__copy">
                <span>{selectedCount} dipilih</span>
              </div>
              <div className="product-selection-summary__actions">
                <NativeButton className="compact tertiary icon-only" type="button" onClick={selectedCount > 0 ? clearSelection : exitSelectionMode} aria-label={selectedCount > 0 ? "Bersihkan pilihan" : "Keluar mode seleksi"}>
                  <Trash2 size={15} aria-hidden="true" />
                </NativeButton>
                <form
                  action={bulkArchiveProductsAction}
                  onSubmit={(event) => {
                    if (!window.confirm(`Arsipkan ${selectedCount} produk terpilih?`)) {
                      event.preventDefault();
                    }
                  }}
                >
                  {Array.from(selectedIds).map((id) => (
                    <input type="hidden" name="product_ids" value={id} key={id} />
                  ))}
                  <BulkArchiveSubmitButton disabled={selectedCount === 0} iconOnly />
                </form>
              </div>
            </div>
          ) : null}
          {mobileRows.map((product) => {
            const selected = selectedIds.has(product.id);
            const longPressHandlers = createLongPressHandlers({
              enabled: !selectionMode,
              onLongPress: () => beginSelectionAt(product.id),
            });

            return (
              <article
                className="visual-list-card"
                data-active={activeProductId === product.id ? "true" : undefined}
                data-selected={selected ? "true" : undefined}
                key={product.id}
                {...longPressHandlers}
                onClick={(event) => {
                  longPressHandlers.onClickCapture(event);
                  if (selectionMode && !isInteractiveChild(event.target)) {
                    toggleSelectedId(product.id);
                  }
                }}
              >
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
                    {selectionMode ? (
                      <SelectionToggleButton
                        pressed={selected}
                        label={selected ? `Batal pilih ${product.product_name}` : `Pilih ${product.product_name}`}
                        onClick={() => toggleSelectedId(product.id)}
                      />
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
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
        isMobile={isMobileViewport}
        onClose={() => setActiveStatusProductId(null)}
      />
    </section>
  );
}
