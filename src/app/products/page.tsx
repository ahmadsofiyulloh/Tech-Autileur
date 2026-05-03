import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { ProductList, type ProductListRow } from "./product-list";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { listIntakeSessions } from "@/lib/server/intake";
import { listProducts } from "@/lib/server/products";
import { getCurrentWorkspace, listWorkspaces } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{ workspace?: string | string[] }>;
};

function fieldValue(value: string | number | null | undefined) {
  return value ? String(value) : "";
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
    return "Tanpa workspace";
  }

  const workspace = workspaceMap.get(workspaceId);
  return workspace ? `${workspace.workspace_code} - ${workspace.workspace_name}` : "Workspace tidak tersedia";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function metadataText(record: unknown, key: string, fallbackKey?: string) {
  if (!isRecord(record)) {
    return "";
  }

  return readJsonText(record[key]) || (fallbackKey ? readJsonText(record[fallbackKey]) : "");
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
  let intakeSessions;

  try {
    [currentWorkspace, workspaces] = await Promise.all([getCurrentWorkspace(), listWorkspaces({ limit: 200 })]);
    const workspaceId = currentWorkspace && !showAllWorkspaces ? currentWorkspace.id : undefined;

    [products, intakeSessions] = await Promise.all([
      listProducts({
        limit: 200,
        workspaceId,
      }),
      listIntakeSessions({
        limit: 200,
        workspaceId,
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load products.";

    return (
      <SectionCard icon={Package} title="Produk tidak bisa dimuat." description={message}>
        <EmptyState icon={Package} title="Produk tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  const workspaceMap = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const scopeLabel = currentWorkspace && !showAllWorkspaces ? currentWorkspace.workspace_name : "Semua workspace";
  const latestIntakeByProductId = new Map<string, (typeof intakeSessions)[number]>();

  for (const session of intakeSessions) {
    if (!session.product_id || latestIntakeByProductId.has(session.product_id)) {
      continue;
    }

    latestIntakeByProductId.set(session.product_id, session);
  }

  const productRows: ProductListRow[] = products.map((product) => {
    const latestIntake = latestIntakeByProductId.get(product.id) ?? null;
    const metadata = latestIntake?.reviewed_metadata_json ?? latestIntake?.parsed_metadata_json ?? null;
    const keyword = metadataText(metadata, "keyword_cari_etalase", "category") || fieldValue(product.niche);

    return {
      id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      workspace_label: workspaceLabel(product.workspace_id, workspaceMap),
      marketplace: fieldValue(product.marketplace),
      keyword,
      product_status: product.status,
      intake_status: latestIntake?.status ?? "",
      created_at_label: formatDate(product.created_at),
      href: `/products/${product.id}`,
    };
  });

  return (
    <div className="stack">
      <div className="surface-toolbar">
        <span className="surface-context">Lingkup: {scopeLabel}</span>
        <div className="surface-toolbar__actions">
          {currentWorkspace ? (
            <Link className="button compact" href={showAllWorkspaces ? "/products" : "/products?workspace=all"}>
              {showAllWorkspaces ? "Workspace aktif" : "Semua workspace"}
            </Link>
          ) : null}
          <Link className="button compact primary" href="/products/new">
            <Plus size={16} aria-hidden="true" />
            Intake baru
          </Link>
        </div>
      </div>

      {products.length ? (
        <ProductList products={productRows} />
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
