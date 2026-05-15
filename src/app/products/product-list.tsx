"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Edit3, Package, Plus, Search } from "lucide-react";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { NativeButton, NativeLinkButton } from "@/components/ui/native-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { MediaThumbnailFrame } from "@/components/operator/media-thumbnail-frame";
import { StatusBadge } from "@/components/operator/status-badge";
import { saveProduct } from "./actions";
import { ProductStatusSheet } from "./product-metadata-sheet";
import type { ProductListRow, ProductUploadScope } from "./types";

type ProductListProps = {
  activeProductId?: string | null;
  products: ProductListRow[];
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

function matchesQuery(product: ProductListRow, query: string) {
  const value = query.trim().toLowerCase();

  if (!value) {
    return true;
  }

  return product.search_text.includes(value);
}

type ProductFilter = "all" | "draft" | "analysis" | "prompt" | "video" | "upload";

const productFilters: Array<{ key: ProductFilter; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "draft", label: "Draf" },
  { key: "analysis", label: "Analisis" },
  { key: "prompt", label: "Prompt" },
  { key: "video", label: "Video" },
  { key: "upload", label: "Upload" },
];

const uploadFilters: Array<{ key: ProductUploadScope; label: string }> = [
  { key: "shopee", label: "Shopee" },
  { key: "tiktok", label: "TikTok" },
  { key: "both", label: "Keduanya" },
];

function matchesFilter(product: ProductListRow, filter: ProductFilter) {
  if (product.product_status.toUpperCase() === "ARCHIVED") {
    return false;
  }

  if (filter === "analysis") {
    return product.workflow_stage === "analysis";
  }

  if (filter === "draft") {
    return product.workflow_stage === "draft";
  }

  if (filter === "prompt") {
    return product.workflow_stage === "prompt";
  }

  if (filter === "video") {
    return product.workflow_stage === "video";
  }

  if (filter === "upload") {
    return product.workflow_stage === "upload";
  }

  return true;
}

function matchesUploadFilter(product: ProductListRow, filter: ProductUploadScope | null) {
  if (filter === null) {
    return true;
  }

  return product.workflow_stage === "upload" && product.upload_scope === filter;
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

export function ProductList({ activeProductId, products }: ProductListProps) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ProductFilter>("all");
  const [activeUploadFilter, setActiveUploadFilter] = useState<ProductUploadScope | null>(null);
  const [activeStatusProductId, setActiveStatusProductId] = useState<string | null>(null);

  useEffect(() => {
    if (activeStatusProductId && !products.some((product) => product.id === activeStatusProductId)) {
      setActiveStatusProductId(null);
    }
  }, [activeStatusProductId, products]);

  const selectedStatusProduct = useMemo(
    () => products.find((product) => product.id === activeStatusProductId) ?? null,
    [activeStatusProductId, products],
  );

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          matchesQuery(product, query) &&
          matchesFilter(product, activeFilter) &&
          (activeFilter !== "upload" || matchesUploadFilter(product, activeUploadFilter)),
      ),
    [activeFilter, activeUploadFilter, products, query],
  );

  return (
    <section className="product-master" aria-label="Daftar produk" data-has-detail={activeProductId ? "true" : undefined}>
      <div className="product-master__list stack">
        <div className="settings-list-toolbar product-list-toolbar">
          <label className="product-search" htmlFor="product-search">
            <Search size={16} aria-hidden="true" />
            <input
              id="product-search"
              name="product-search"
              placeholder="Cari produk"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="settings-inline-summary">
          <span>{filteredProducts.length} produk</span>
          <NativeLinkButton className="compact primary" href="/products/new">
            <Plus size={15} aria-hidden="true" />
            Intake baru
          </NativeLinkButton>
        </div>

        <div className="product-filter-stack">
          <div className="content-filter-tabs" role="tablist" aria-label="Filter produk">
            {productFilters.map((filter) => (
              <button
                aria-selected={activeFilter === filter.key}
                className="content-filter-tab"
                data-active={activeFilter === filter.key ? "true" : undefined}
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                role="tab"
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>

          {activeFilter === "upload" ? (
            <div className="content-filter-tabs content-filter-tabs--sub" role="tablist" aria-label="Filter upload">
              {uploadFilters.map((filter) => (
                <button
                  aria-selected={activeUploadFilter === filter.key}
                  className="content-filter-tab"
                  data-active={activeUploadFilter === filter.key ? "true" : undefined}
                  key={filter.key}
                  onClick={() => setActiveUploadFilter((current) => (current === filter.key ? null : filter.key))}
                  role="tab"
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="table-wrap products-table-desktop">
          <table className="data-table product-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Workspace</th>
                <th>Keyword</th>
                <th>Status</th>
                <th>Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
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
                  <td>{product.workspace_label}</td>
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
            </tbody>
          </table>
        </div>

        <div className="products-cards-mobile">
          {filteredProducts.map((product) => (
            <article className="visual-list-card" data-active={activeProductId === product.id ? "true" : undefined} key={product.id}>
              <ProductThumbnail alt={product.product_name} className="visual-list-card__thumb" fallbackSize={28} src={product.thumbnail_url} />
              <div className="visual-list-card__body">
                <div className="visual-list-card__header">
                  <div className="visual-list-card__copy">
                    <strong title={product.product_name}>{product.product_name}</strong>
                    <span>{fieldValue(product.keyword)}</span>
                    <small>{product.workspace_label}</small>
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
          {!filteredProducts.length ? <section className="muted-box">Tidak ada produk.</section> : null}
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
