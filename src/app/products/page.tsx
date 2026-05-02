import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Package, Plus } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { listProducts } from "@/lib/server/products";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function fieldValue(value: string | number | null | undefined) {
  return value ?? "Not set";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function ProductsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let products;

  try {
    products = await listProducts({ limit: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load products.";

    return (
      <SectionCard icon={Package} badge="Error" title="Unable to load products." description={message}>
        <EmptyState icon={Package} title="Products unavailable." description="Try again." />
      </SectionCard>
    );
  }

  const activeCount = products.filter((product) => product.status !== "ARCHIVED").length;
  const draftCount = products.filter((product) => product.status === "DRAFT").length;

  return (
    <div className="stack">
      <PageHeader
        icon={Package}
        badge="Products"
        title="Products"
        description="Product list only. Open a product row for metadata, prompts, outputs, and history."
        actions={
          <Link className="button primary" href="/products/new">
            <Plus size={16} aria-hidden="true" />
            New intake
          </Link>
        }
        stats={[
          { label: "Total", value: products.length },
          { label: "Active", value: activeCount },
          { label: "Draft", value: draftCount },
        ]}
      />

      {products.length ? (
        <section className="stack" aria-label="Product list">
          {products.map((product) => (
            <SectionCard
              actions={
                <>
                  <StatusBadge status={product.status} />
                  <Link className="button compact primary" href={`/products/${product.id}`}>
                    <ArrowRight size={15} aria-hidden="true" />
                    Open
                  </Link>
                </>
              }
              badge={product.product_code}
              icon={Package}
              key={product.id}
              title={product.product_name}
              description={[product.marketplace, product.niche].filter(Boolean).join(" - ") || "No marketplace set."}
            >
              <div className="metric-grid">
                <div className="metric">
                  <span>Marketplace</span>
                  <strong>{fieldValue(product.marketplace)}</strong>
                </div>
                <div className="metric">
                  <span>Niche</span>
                  <strong>{fieldValue(product.niche)}</strong>
                </div>
                <div className="metric">
                  <span>Created</span>
                  <strong>{formatDate(product.created_at)}</strong>
                </div>
              </div>
              {product.marketplace_product_link ? (
                <p className="subtle">
                  Source link saved. Open the detail page to review metadata and source history.
                </p>
              ) : (
                <p className="subtle">No marketplace link saved yet.</p>
              )}
            </SectionCard>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={Package}
          title="No products yet."
          description="Start from the intake form."
          action={
            <Link className="button primary" href="/products/new">
              <Plus size={16} aria-hidden="true" />
              New intake
            </Link>
          }
        />
      )}
    </div>
  );
}
