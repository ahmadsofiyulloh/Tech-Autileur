import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Package, Plus } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { listProducts } from "@/lib/server/products";
import { getCurrentWorkspace, listWorkspaces } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{ workspace?: string | string[] }>;
};

function fieldValue(value: string | number | null | undefined) {
  return value ?? "Not set";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function workspaceLabel(workspaceId: string | null, workspaceMap: Map<string, { workspace_code: string; workspace_name: string }>) {
  if (!workspaceId) {
    return "Unassigned";
  }

  const workspace = workspaceMap.get(workspaceId);
  return workspace ? `${workspace.workspace_code} - ${workspace.workspace_name}` : "Workspace unavailable";
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const query = await searchParams;
  const showAllWorkspaces = firstParam(query.workspace) === "all";
  let products;
  let currentWorkspace;
  let workspaces;

  try {
    [currentWorkspace, workspaces] = await Promise.all([getCurrentWorkspace(), listWorkspaces({ limit: 200 })]);
    products = await listProducts({
      limit: 200,
      workspaceId: currentWorkspace && !showAllWorkspaces ? currentWorkspace.id : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load products.";

    return (
      <SectionCard icon={Package} badge="Error" title="Unable to load products." description={message}>
        <EmptyState icon={Package} title="Products unavailable." description="Try again." />
      </SectionCard>
    );
  }

  const workspaceMap = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const scopeLabel = currentWorkspace && !showAllWorkspaces ? currentWorkspace.workspace_name : "Semua workspace";
  const activeCount = products.filter((product) => product.status !== "ARCHIVED").length;
  const draftCount = products.filter((product) => product.status === "DRAFT").length;

  return (
    <div className="stack">
      <PageHeader
        icon={Package}
        badge="Produk"
        title="Produk"
        description={`Lingkup: ${scopeLabel}.`}
        actions={
          <>
            {currentWorkspace ? (
              <Link className="button" href={showAllWorkspaces ? "/products" : "/products?workspace=all"}>
                {showAllWorkspaces ? "Workspace aktif" : "Semua workspace"}
              </Link>
            ) : null}
            <Link className="button primary" href="/products/new">
              <Plus size={16} aria-hidden="true" />
              Intake baru
            </Link>
          </>
        }
        stats={[
          { label: "Scope", value: scopeLabel },
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
                    Buka
                  </Link>
                </>
              }
              badge={product.product_code}
              icon={Package}
              key={product.id}
              title={product.product_name}
              description={[product.marketplace, product.niche].filter(Boolean).join(" - ") || "Marketplace kosong."}
            >
              <div className="metric-grid">
                <div className="metric">
                  <span>Workspace</span>
                  <strong>{workspaceLabel(product.workspace_id, workspaceMap)}</strong>
                </div>
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
              <p className="subtle">{product.marketplace_product_link ? "Source link tersimpan." : "Link marketplace kosong."}</p>
            </SectionCard>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={Package}
          title={currentWorkspace && !showAllWorkspaces ? "Belum ada produk di workspace ini." : "Belum ada produk."}
          description={currentWorkspace && !showAllWorkspaces ? "Cek semua workspace." : "Mulai dari intake."}
          action={
            currentWorkspace && !showAllWorkspaces ? (
              <Link className="button" href="/products?workspace=all">
                Semua workspace
              </Link>
            ) : (
              <Link className="button primary" href="/products/new">
                <Plus size={16} aria-hidden="true" />
                Intake baru
              </Link>
            )
          }
        />
      )}
    </div>
  );
}
