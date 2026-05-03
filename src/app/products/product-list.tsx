"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, PanelRightOpen, Search, X } from "lucide-react";
import { StatusBadge } from "@/components/operator/status-badge";

export type ProductListRow = {
  id: string;
  product_name: string;
  workspace_label: string;
  marketplace: string;
  keyword: string;
  product_status: string;
  intake_status: string;
  created_at_label: string;
  href: string;
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

export function ProductList({ products }: ProductListProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? "");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const filteredProducts = useMemo(() => products.filter((product) => matchesQuery(product, query)), [products, query]);
  const selectedProduct =
    filteredProducts.find((product) => product.id === selectedId) ?? filteredProducts[0] ?? products.find((product) => product.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedProduct) {
      setSelectedId(filteredProducts[0]?.id ?? products[0]?.id ?? "");
    }
  }, [filteredProducts, products, selectedProduct]);

  function openDrawer(productId: string) {
    setSelectedId(productId);
    setDrawerOpen(true);
  }

  return (
    <section className="product-master" aria-label="Daftar produk">
      <div className="product-master__list stack">
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
                <tr data-active={selectedProduct?.id === product.id ? "true" : undefined} key={product.id}>
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
                    <div className="product-row-actions">
                      <button className="button compact" type="button" onClick={() => openDrawer(product.id)}>
                        <PanelRightOpen size={15} aria-hidden="true" />
                        Detail
                      </button>
                      <Link className="button compact primary" href={product.href}>
                        <ArrowRight size={15} aria-hidden="true" />
                        Buka
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="products-cards-mobile">
          {filteredProducts.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="section-card__actions">
                <div className="stack-tight">
                  <strong>{product.product_name}</strong>
                </div>
                <StatusBadge status={product.product_status} />
              </div>
              <dl className="product-card__meta">
                <div>
                  <dt>Workspace</dt>
                  <dd>{product.workspace_label}</dd>
                </div>
                <div>
                  <dt>Keyword</dt>
                  <dd>{fieldValue(product.keyword)}</dd>
                </div>
                <div>
                  <dt>Intake</dt>
                  <dd>{fieldValue(product.intake_status)}</dd>
                </div>
              </dl>
              <div className="product-row-actions">
                <button className="button compact" type="button" onClick={() => openDrawer(product.id)}>
                  <PanelRightOpen size={15} aria-hidden="true" />
                  Detail
                </button>
                <Link className="button compact primary" href={product.href}>
                  <ArrowRight size={15} aria-hidden="true" />
                  Buka
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="product-drawer-backdrop" data-open={drawerOpen ? "true" : "false"} onClick={() => setDrawerOpen(false)} />
      <aside className="product-drawer stack" data-open={drawerOpen ? "true" : "false"} aria-label="Detail produk">
        <div className="section-card__actions product-drawer__header">
          <div className="stack-tight">
            <span className="subtle">Detail</span>
            <strong>{selectedProduct?.product_name ?? "Pilih produk"}</strong>
          </div>
          <button className="button compact product-drawer__close" type="button" onClick={() => setDrawerOpen(false)} aria-label="Tutup detail">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {selectedProduct ? (
          <>
            <dl className="product-drawer__meta">
              <div>
                <dt>Workspace</dt>
                <dd>{selectedProduct.workspace_label}</dd>
              </div>
              <div>
                <dt>Marketplace</dt>
                <dd>{fieldValue(selectedProduct.marketplace)}</dd>
              </div>
              <div>
                <dt>Keyword</dt>
                <dd>{fieldValue(selectedProduct.keyword)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={selectedProduct.product_status} />
                </dd>
              </div>
              <div>
                <dt>Intake</dt>
                <dd>{selectedProduct.intake_status ? <StatusBadge status={selectedProduct.intake_status} tone="info" /> : "Belum ada"}</dd>
              </div>
              <div>
                <dt>Dibuat</dt>
                <dd>{selectedProduct.created_at_label}</dd>
              </div>
            </dl>
            <Link className="button primary" href={selectedProduct.href}>
              <ArrowRight size={16} aria-hidden="true" />
              Buka detail
            </Link>
          </>
        ) : null}
      </aside>
    </section>
  );
}
