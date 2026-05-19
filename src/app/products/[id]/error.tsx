"use client";

import { ArrowLeft, Package } from "lucide-react";
import { ErrorState } from "@/components/operator/error-state";
import { NativeButton, NativeLinkButton } from "@/components/ui/native-button";

export default function ProductDetailError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="product-detail-route stack">
      <section className="product-detail-route__surface" aria-label="Detail produk">
        <header className="product-detail-route__header">
          <div className="product-detail-route__heading">
            <span>Produk</span>
            <h1>Detail produk</h1>
          </div>
          <NativeLinkButton className="compact tertiary" href="/products">
            <ArrowLeft size={16} aria-hidden="true" />
            Produk
          </NativeLinkButton>
        </header>
        <div className="product-detail-route__body">
          <ErrorState
            icon={Package}
            title="Detail produk tidak bisa dimuat."
            description="Coba lagi."
            action={
              <NativeButton className="primary" type="button" onClick={reset}>
                Coba lagi
              </NativeButton>
            }
          />
        </div>
      </section>
    </div>
  );
}
