"use client";

import { useMemo } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Share2 } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SearchInput } from "@/components/operator/search-input";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeAnchorButton, NativeLinkButton } from "@/components/ui/native-button";
import {
  buildShareListHref,
  type PaginationState,
  type ShareListRow,
} from "@/lib/share/share-list-contract";
import {
  SHARE_PLATFORM_LABELS,
  type SharePlatform,
} from "@/lib/share/share-platform";

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
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const numbers = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  return Array.from(numbers)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
}

export function ShareProductList({
  activeProductId,
  pagination,
  platform,
  rows,
  search,
}: ShareProductListProps) {
  const pageNumbers = useMemo(
    () => buildCompactPageNumbers(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages],
  );

  if (!rows.length) {
    return (
      <div className="stack-lg">
        <section className="connected-section connected-section--flush">
          <div className="connected-section__header connected-section__header--stack connected-section__header--flush">
            <div>
              <h1>Share {SHARE_PLATFORM_LABELS[platform]}</h1>
              <p>Pilih produk untuk mulai generate caption.</p>
            </div>
          </div>
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
          description={search ? "Ubah kata kunci pencarian." : "Tambahkan produk dari intake terlebih dahulu."}
        />
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <section className="connected-section connected-section--flush">
        <div className="connected-section__header connected-section__header--stack connected-section__header--flush">
          <div>
            <h1>Share {SHARE_PLATFORM_LABELS[platform]}</h1>
            <p>Pilih produk untuk mulai generate caption manual.</p>
          </div>
        </div>
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

          <div className="share-list-table-wrap">
            <table className="share-list-table">
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
                {rows.map((row) => {
                  const rowHref = row.href;
                  const isActive = row.id === activeProductId;

                  return (
                    <tr key={row.id} data-active={isActive ? "true" : undefined}>
                      <td>
                        <NativeLinkButton className="compact tertiary" href={rowHref}>
                          {row.product_name}
                        </NativeLinkButton>
                      </td>
                      <td>{row.marketplace ?? "-"}</td>
                      <td>{row.affiliate_url ? "Sudah ada" : "Belum ada"}</td>
                      <td>
                        <StatusBadge
                          status={getStatusLabel(row.share_status)}
                          tone={getStatusTone(row.share_status)}
                        />
                      </td>
                      <td>{formatDateTime(row.latest_generation_at)}</td>
                      <td>
                        <div className="share-list-actions">
                          <NativeLinkButton className="compact primary" href={rowHref}>
                            Buka
                          </NativeLinkButton>
                          {row.product_url ? (
                            <NativeAnchorButton
                              className="compact tertiary"
                              href={row.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink size={14} aria-hidden="true" />
                              Produk
                            </NativeAnchorButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="share-list-mobile-cards">
            {rows.map((row) => {
              const isActive = row.id === activeProductId;

              return (
                <article key={row.id} className="share-list-mobile-card" data-active={isActive ? "true" : undefined}>
                  <div className="share-list-mobile-card__header">
                    <NativeLinkButton className="compact tertiary" href={row.href}>
                      {row.product_name}
                    </NativeLinkButton>
                    <StatusBadge
                      status={getStatusLabel(row.share_status)}
                      tone={getStatusTone(row.share_status)}
                    />
                  </div>
                  <div className="share-list-mobile-card__meta">
                    <span>{row.marketplace ?? "Marketplace belum ada"}</span>
                    <span>{row.affiliate_url ? "Affiliate URL sudah ada" : "Affiliate URL belum ada"}</span>
                    <span>{formatDateTime(row.latest_generation_at)}</span>
                  </div>
                  <div className="share-list-actions">
                    <NativeLinkButton className="compact primary" href={row.href}>
                      Buka detail
                    </NativeLinkButton>
                    {row.product_url ? (
                      <NativeAnchorButton
                        className="compact tertiary"
                        href={row.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={14} aria-hidden="true" />
                        Buka produk
                      </NativeAnchorButton>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          {pagination.totalPages > 1 ? (
            <nav className="share-list-pagination" aria-label="Paginasi share products">
              {pagination.hasPreviousPage ? (
                <NativeLinkButton
                  className="compact tertiary"
                  href={buildShareListHref({
                    platform,
                    page: pagination.page - 1,
                    search,
                  })}
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  Sebelumnya
                </NativeLinkButton>
              ) : (
                <span className="share-list-pagination__spacer" />
              )}

              <div className="share-list-pagination__pages">
                {pageNumbers.map((pageNumber, index) => {
                  const previous = pageNumbers[index - 1];
                  const shouldShowGap = previous && pageNumber - previous > 1;

                  return (
                    <div key={pageNumber} className="share-list-pagination__page-group">
                      {shouldShowGap ? <span className="share-list-pagination__gap">…</span> : null}
                      <NativeLinkButton
                        className={`compact ${pageNumber === pagination.page ? "primary" : "tertiary"}`}
                        href={buildShareListHref({
                          platform,
                          page: pageNumber,
                          search,
                        })}
                      >
                        {pageNumber}
                      </NativeLinkButton>
                    </div>
                  );
                })}
              </div>

              {pagination.hasNextPage ? (
                <NativeLinkButton
                  className="compact tertiary"
                  href={buildShareListHref({
                    platform,
                    page: pagination.page + 1,
                    search,
                  })}
                >
                  Berikutnya
                  <ArrowRight size={14} aria-hidden="true" />
                </NativeLinkButton>
              ) : (
                <span className="share-list-pagination__spacer" />
              )}
            </nav>
          ) : null}
        </div>
      </section>
    </div>
  );
}
