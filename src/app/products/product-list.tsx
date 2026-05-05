"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Edit3, Package, Plus, Search } from "lucide-react";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { MediaThumbnailFrame } from "@/components/operator/media-thumbnail-frame";
import { StatusBadge } from "@/components/operator/status-badge";
import { saveProduct } from "./actions";

export type ProductListRow = {
  id: string;
  product_name: string;
  workspace_label: string;
  marketplace: string;
  keyword: string;
  product_status: string;
  intake_status: string;
  created_at_label: string;
  thumbnail_url: string | null;
  href: string;
  review_href: string | null;
};

type ProductListProps = {
  products: ProductListRow[];
};

function fieldValue(value: string) {
  return value || "Belum ada";
}

function matchesQuery(product: ProductListRow, query: string) {
  const value = query.trim().toLowerCase();

  if (!value) {
    return true;
  }

  return [
    product.product_name,
    product.workspace_label,
    product.marketplace,
    product.keyword,
    product.product_status,
    product.intake_status,
  ]
    .join(" ")
    .toLowerCase()
    .includes(value);
}

type ProductFilter = "all" | "active" | "draft";

const productFilters: Array<{ key: ProductFilter; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "active", label: "Aktif" },
  { key: "draft", label: "Draft" },
];

function matchesFilter(product: ProductListRow, filter: ProductFilter) {
  const status = product.product_status.toUpperCase();

  if (status === "ARCHIVED") {
    return false;
  }

  if (filter === "draft") {
    return status === "DRAFT";
  }

  if (filter === "active") {
    return status !== "DRAFT" && status !== "ARCHIVED";
  }

  return true;
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

export function ProductList({ products }: ProductListProps) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ProductFilter>("all");
  const filteredProducts = useMemo(
    () => products.filter((product) => matchesQuery(product, query) && matchesFilter(product, activeFilter)),
    [activeFilter, products, query],
  );

  return (
    <section className="product-master" aria-label="Daftar produk">
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
          <Link className="button compact primary" href="/products/new">
            <Plus size={15} aria-hidden="true" />
            Intake baru
          </Link>
        </div>

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
                <tr key={product.id}>
                  <td>
                    <div className="stack-tight">
                      <strong>{product.product_name}</strong>
                    </div>
                  </td>
                  <td>{product.workspace_label}</td>
                  <td>{fieldValue(product.keyword)}</td>
                  <td>
                    <div className="product-status-stack">
                      <StatusBadge status={product.product_status} />
                      {product.intake_status ? <StatusBadge status={product.intake_status} tone="info" /> : null}
                    </div>
                  </td>
                  <td>{product.created_at_label}</td>
                  <td>
                    <div className="product-row-controls">
                      <div className="product-row-actions">
                        <Link className="button compact" href={product.href}>
                          <ArrowRight size={15} aria-hidden="true" />
                          Detail
                        </Link>
                        {product.review_href ? (
                          <Link className="button compact primary" href={product.review_href}>
                            <Edit3 size={15} aria-hidden="true" />
                            Edit
                          </Link>
                        ) : null}
                        <form action={saveProduct}>
                          <input type="hidden" name="intent" value="archive" />
                          <input type="hidden" name="id" value={product.id} />
                          <DeleteActionButton confirmMessage={`Hapus produk "${product.product_name}"?`} />
                        </form>
                      </div>
                      <ProductThumbnail
                        alt={product.product_name}
                        className="product-row-preview"
                        fallbackSize={22}
                        src={product.thumbnail_url}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="products-cards-mobile">
          {filteredProducts.map((product) => (
            <article className="visual-list-card" key={product.id}>
              <ProductThumbnail alt={product.product_name} className="visual-list-card__thumb" fallbackSize={28} src={product.thumbnail_url} />
              <div className="visual-list-card__body">
                <div className="visual-list-card__header">
                  <div className="visual-list-card__copy">
                    <strong title={product.product_name}>{product.product_name}</strong>
                    <span>{fieldValue(product.keyword)}</span>
                    <small>{product.workspace_label}</small>
                  </div>
                  <div className="visual-list-card__status" aria-label="Status produk">
                    <StatusBadge status={product.product_status} />
                  </div>
                </div>
                <div className="visual-list-card__footer">
                  <span>{product.created_at_label}</span>
                  {product.marketplace ? <span>{product.marketplace}</span> : null}
                </div>
                <div className="mobile-card-actions">
                  <Link className="button compact primary" href={product.href}>
                    <ArrowRight size={15} aria-hidden="true" />
                    Detail
                  </Link>
                  <OverflowActionMenu>
                    {product.review_href ? (
                      <Link className="button compact" href={product.review_href}>
                        <Edit3 size={15} aria-hidden="true" />
                        Edit
                      </Link>
                    ) : null}
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
    </section>
  );
}
