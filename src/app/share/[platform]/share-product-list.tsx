"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Package, Share2 } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { MediaThumbnailFrame } from "@/components/operator/media-thumbnail-frame";
import { SearchInput } from "@/components/operator/search-input";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton, NativeLinkButton } from "@/components/ui/native-button";
import {
  buildShareListHref,
  createPaginationState,
  type PaginationState,
  type ShareListRow,
  SHARE_LIST_MOBILE_PAGE_SIZE,
  SHARE_LIST_DESKTOP_PAGE_SIZE,
} from "@/lib/share/share-list-contract";
import { type SharePlatform } from "@/lib/share/share-platform";

const SHARE_LIST_MOBILE_MEDIA_QUERY = "(max-width: 860px)";

type ShareProductListProps = {
  activeProductId: string | null;
  pagination: PaginationState;
  platform: SharePlatform;
  rows: ShareListRow[];
  search: string;
};

function getStatusLabel(status: ShareListRow["share_status"]) {
  switch (status) {
    case "needs_link":
      return "Perlu Link Affiliate";
    case "ready":
      return "Siap Generate";
    case "generated":
      return "Selesai";
    case "error":
      return "Error";
    default:
      return status;
  }
}

function getStatusTone(status: ShareListRow["share_status"]) {
  switch (status) {
    case "needs_link":
      return "warning" as const;
    case "generated":
      return "success" as const;
    case "error":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Belum ada history";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildCompactPageNumbers(page: number, totalPages: number) {
  const pages = new Set(
    [1, totalPages, page - 1, page, page + 1].filter((v) => v >= 1 && v <= totalPages),
  );
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];

  for (const p of sorted) {
    const prev = items[items.length - 1];
    if (typeof prev === "number" && p - prev > 1) {
      items.push("ellipsis");
    }
    items.push(p);
  }

  return items;
}

function ShareThumbnail({
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

function fieldValue(value: string | null | undefined) {
  return value && value.length > 0 ? value : "-";
}

function deriveInitialMobilePagination(totalCount: number): PaginationState {
  return createPaginationState({
    page: 1,
    pageSize: SHARE_LIST_MOBILE_PAGE_SIZE,
    totalCount,
  });
}

function SharePaginationStepper({
  pagination,
  platform,
  search,
}: {
  pagination: PaginationState;
  platform: SharePlatform;
  search: string;
}) {
  const pageItems = buildCompactPageNumbers(pagination.page, pagination.totalPages);

  return (
    <nav className="list-pagination-stepper" aria-label="Navigasi halaman share">
      <div className="list-pagination-stepper__status">
        <StatusBadge
          status={`Halaman ${pagination.page}/${pagination.totalPages}`}
          tone="neutral"
        />
      </div>
      <div className="list-pagination-stepper__controls">
        {pagination.hasPreviousPage ? (
          <NativeLinkButton
            className="compact tertiary"
            href={buildShareListHref({ platform, page: pagination.page - 1, search })}
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
            <span
              className="list-pagination-stepper__ellipsis"
              aria-hidden="true"
              key={`ellipsis-${index}`}
            >
              ...
            </span>
          ) : item === pagination.page ? (
            <NativeButton
              className="compact primary"
              type="button"
              aria-current="page"
              disabled
              key={item}
            >
              {item}
            </NativeButton>
          ) : (
            <NativeLinkButton
              className="compact tertiary"
              href={buildShareListHref({ platform, page: item, search })}
              key={item}
            >
              {item}
            </NativeLinkButton>
          ),
        )}

        {pagination.hasNextPage ? (
          <NativeLinkButton
            className="compact tertiary"
            href={buildShareListHref({ platform, page: pagination.page + 1, search })}
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

export function ShareProductList({
  activeProductId,
  pagination,
  platform,
  rows,
  search,
}: ShareProductListProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileRows, setMobileRows] = useState<ShareListRow[]>(() =>
    rows.slice(0, SHARE_LIST_MOBILE_PAGE_SIZE),
  );
  const [mobilePagination, setMobilePagination] = useState<PaginationState>(() =>
    deriveInitialMobilePagination(pagination.totalCount),
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMobileRows(rows.slice(0, SHARE_LIST_MOBILE_PAGE_SIZE));
    setMobilePagination(deriveInitialMobilePagination(pagination.totalCount));
    setLoadMoreError(null);
  }, [pagination.totalCount, rows, search]);

  useEffect(() => {
    if (!window.matchMedia) {
      setIsMobileViewport(false);
      return;
    }

    const media = window.matchMedia(SHARE_LIST_MOBILE_MEDIA_QUERY);
    const update = () => setIsMobileViewport(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const loadMoreShare = useCallback(async () => {
    if (isLoadingMore || !mobilePagination.hasNextPage) {
      return;
    }

    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const params = new URLSearchParams();
      params.set("platform", platform);
      params.set("page", String(mobilePagination.page + 1));
      params.set("page_size", String(SHARE_LIST_MOBILE_PAGE_SIZE));

      if (search) {
        params.set("q", search);
      }

      const response = await fetch(`/api/share/list?${params.toString()}`, {
        headers: { accept: "application/json" },
      });

      const payload = (await response.json()) as {
        error?: string;
        pagination?: PaginationState;
        rows?: ShareListRow[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Share list gagal dimuat.");
      }

      setMobileRows((current) => {
        const existingIds = new Set(current.map((row) => row.id));
        const nextRows = (payload.rows ?? []).filter((row) => !existingIds.has(row.id));
        return [...current, ...nextRows];
      });
      setMobilePagination(payload.pagination ?? mobilePagination);
    } catch (error) {
      setLoadMoreError(error instanceof Error ? error.message : "Share list gagal dimuat.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, mobilePagination, platform, search]);

  useEffect(() => {
    if (!isMobileViewport || !mobilePagination.hasNextPage || !loadMoreRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreShare();
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [isMobileViewport, loadMoreShare, mobilePagination.hasNextPage]);

  const visibleDesktopRows = rows;
  const visibleMobileRows = mobileRows;

  if (!rows.length && !mobileRows.length) {
    return (
      <div className="stack-lg">
        <section className="connected-section connected-section--flush">
          <div className="connected-section__body connected-section__body--flush">
            <form method="get" className="share-list-toolbar">
              <SearchInput
                id="share-list-search"
                name="q"
                label="Cari produk"
                placeholder="Cari nama produk"
                defaultValue={search}
                clearHref={buildShareListHref({ platform })}
              />
            </form>
          </div>
        </section>

        <EmptyState
          icon={Share2}
          title={search ? "Produk tidak ditemukan." : "Belum ada produk untuk di-share."}
          description={
            search
              ? "Ubah kata kunci pencarian."
              : "Tambahkan produk dari intake terlebih dahulu."
          }
        />
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <section className="connected-section connected-section--flush">
        <div className="connected-section__body connected-section__body--flush">
          <form method="get" className="share-list-toolbar">
            <SearchInput
              id="share-list-search"
              name="q"
              label="Cari produk"
              placeholder="Cari nama produk"
              defaultValue={search}
              clearHref={buildShareListHref({ platform })}
            />
          </form>

          <div className="table-wrap share-list-table-desktop">
            <table className="data-table dense-table share-list-table">
              <colgroup>
                <col className="share-list-table__col-product" />
                <col className="share-list-table__col-marketplace" />
                <col className="share-list-table__col-affiliate" />
                <col className="share-list-table__col-status" />
                <col className="share-list-table__col-update" />
                <col className="share-list-table__col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Marketplace</th>
                  <th>Affiliate URL</th>
                  <th>Status</th>
                  <th>Generate terakhir</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {visibleDesktopRows.map((row) => {
                  const isActive = row.id === activeProductId;

                  return (
                    <tr key={row.id} data-active={isActive ? "true" : undefined}>
                      <td>
                        <div className="share-list-product-cell">
                          <ShareThumbnail
                            alt={row.product_name}
                            className="share-list-thumb"
                            fallbackSize={20}
                            src={row.thumbnail_url}
                          />
                          <div className="stack-tight">
                            <strong title={row.product_name}>{row.product_name}</strong>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="share-list-text" title={fieldValue(row.marketplace)}>
                          {fieldValue(row.marketplace)}
                        </span>
                      </td>
                      <td>
                        <span className="share-list-text">
                          {row.affiliate_url ? "Sudah ada" : "Belum ada"}
                        </span>
                      </td>
                      <td>
                        <StatusBadge
                          status={getStatusLabel(row.share_status)}
                          tone={getStatusTone(row.share_status)}
                          size="sm"
                        />
                      </td>
                      <td>
                        <span
                          className="share-list-text"
                          title={formatDateTime(row.latest_generation_at)}
                        >
                          {formatDateTime(row.latest_generation_at)}
                        </span>
                      </td>
                      <td>
                        <div className="share-list-row-actions">
                          <NativeLinkButton className="compact primary" href={row.href}>
                            <ArrowRight size={15} aria-hidden="true" />
                            Buka
                          </NativeLinkButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6}>
                    <SharePaginationStepper
                      pagination={pagination}
                      platform={platform}
                      search={search}
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="share-list-cards-mobile">
            {visibleMobileRows.map((row) => {
              const isActive = row.id === activeProductId;

              return (
                <article
                  key={row.id}
                  className="visual-list-card"
                  data-active={isActive ? "true" : undefined}
                >
                  <ShareThumbnail
                    alt={row.product_name}
                    className="visual-list-card__thumb"
                    fallbackSize={28}
                    src={row.thumbnail_url}
                  />
                  <div className="visual-list-card__body">
                    <div className="visual-list-card__header">
                      <div className="visual-list-card__copy">
                        <strong title={row.product_name}>{row.product_name}</strong>
                        <span>{fieldValue(row.marketplace)}</span>
                      </div>
                      <div className="visual-list-card__status" aria-label="Status share">
                        <StatusBadge
                          status={getStatusLabel(row.share_status)}
                          tone={getStatusTone(row.share_status)}
                          size="sm"
                        />
                      </div>
                    </div>
                    <div className="visual-list-card__footer">
                      <span>{formatDateTime(row.latest_generation_at)}</span>
                      <span>
                        {row.affiliate_url ? "Affiliate URL ada" : "Affiliate URL belum ada"}
                      </span>
                    </div>
                    <div className="mobile-card-actions">
                      <NativeLinkButton className="compact primary" href={row.href}>
                        <ArrowRight size={15} aria-hidden="true" />
                        Buka
                      </NativeLinkButton>
                    </div>
                  </div>
                </article>
              );
            })}
            {loadMoreError ? (
              <section className="muted-box">{loadMoreError}</section>
            ) : null}
            <div ref={loadMoreRef} aria-hidden="true" />
            {mobilePagination.hasNextPage ? (
              <NativeButton
                className="compact tertiary product-mobile-load-more"
                type="button"
                onClick={() => void loadMoreShare()}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Memuat" : "Muat lagi"}
              </NativeButton>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
