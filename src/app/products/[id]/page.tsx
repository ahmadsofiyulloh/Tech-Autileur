import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NativeLinkButton } from "@/components/ui/native-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductDetailPanel, resolveProductDetailTab } from "../product-detail-panel";

export const revalidate = 60;

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductDetailPage({ params, searchParams }: ProductDetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activeTab = resolveProductDetailTab(firstParam(query.tab));
  const detailHrefBase = `/products/${encodeURIComponent(id)}`;

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
          <ProductDetailPanel activeTab={activeTab} detailHrefBase={detailHrefBase} productId={id} />
        </div>
      </section>
    </div>
  );
}
