import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { ProductList, type ProductListRow } from "./product-list";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { listDriveItems } from "@/lib/server/drive-items";
import { listIntakeSessions } from "@/lib/server/intake";
import { listProductImages, listProducts } from "@/lib/server/products";
import { getCurrentWorkspace, listWorkspaces } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{ affiliate_profile_id?: string | string[]; workspace?: string | string[] }>;
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
  return workspace ? workspace.workspace_name : "Workspace tidak tersedia";
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

function hasGeminiReviewMetadata(session: { parsed_metadata_json: unknown; reviewed_metadata_json: unknown }) {
  return Boolean(session.reviewed_metadata_json || session.parsed_metadata_json);
}

function productReviewHref(params: { affiliateProfileId: string | null; intakeId: string; showAllWorkspaces: boolean }) {
  const searchParams = new URLSearchParams({
    intake_id: params.intakeId,
    step: "prompt",
  });

  if (params.showAllWorkspaces) {
    searchParams.set("workspace", "all");
  }

  if (params.affiliateProfileId) {
    searchParams.set("affiliate_profile_id", params.affiliateProfileId);
  }

  return `/products/new?${searchParams.toString()}`;
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
  const requestedAffiliateProfileId = firstParam(query.affiliate_profile_id) ?? null;
  const showAllWorkspaces = firstParam(query.workspace) === "all";
  let products;
  let currentWorkspace;
  let workspaces;
  let intakeSessions;
  let productImages;
  let driveItems;

  try {
    [currentWorkspace, workspaces] = await Promise.all([getCurrentWorkspace(), listWorkspaces({ limit: 200 })]);
    const workspaceId = currentWorkspace && !showAllWorkspaces ? currentWorkspace.id : undefined;

    [products, intakeSessions, productImages, driveItems] = await Promise.all([
      listProducts({
        limit: 200,
        workspaceId,
      }),
      listIntakeSessions({
        limit: 200,
        workspaceId,
      }),
      listProductImages({ limit: 200 }),
      listDriveItems({ limit: 200 }),
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
  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));
  const latestIntakeByProductId = new Map<string, (typeof intakeSessions)[number]>();
  const latestReviewIntakeByProductId = new Map<string, (typeof intakeSessions)[number]>();

  for (const session of intakeSessions) {
    if (!session.product_id) {
      continue;
    }

    if (!latestIntakeByProductId.has(session.product_id)) {
      latestIntakeByProductId.set(session.product_id, session);
    }

    if (hasGeminiReviewMetadata(session) && !latestReviewIntakeByProductId.has(session.product_id)) {
      latestReviewIntakeByProductId.set(session.product_id, session);
    }
  }

  const productRows: ProductListRow[] = products.map((product) => {
    const latestIntake = latestIntakeByProductId.get(product.id) ?? null;
    const latestReviewIntake = latestReviewIntakeByProductId.get(product.id) ?? null;
    const metadata =
      latestReviewIntake?.reviewed_metadata_json ??
      latestReviewIntake?.parsed_metadata_json ??
      latestIntake?.reviewed_metadata_json ??
      latestIntake?.parsed_metadata_json ??
      null;
    const keyword = metadataText(metadata, "keyword_cari_etalase", "category") || fieldValue(product.niche);
    const primaryImage =
      productImages.find((image) => image.product_id === product.id && image.is_primary) ??
      productImages.find((image) => image.product_id === product.id) ??
      null;
    const primaryDriveItem = primaryImage ? driveItemMap.get(primaryImage.drive_item_ref_id) ?? null : null;

    return {
      id: product.id,
      product_name: product.product_name,
      workspace_label: workspaceLabel(product.workspace_id, workspaceMap),
      marketplace: fieldValue(product.marketplace),
      keyword,
      product_status: product.status,
      intake_status: latestIntake?.status ?? "",
      created_at_label: formatDate(product.created_at),
      thumbnail_url: primaryDriveItem?.mime_type?.startsWith("image/") ? primaryDriveItem.drive_url : null,
      href: `/products/${product.id}`,
      review_href: latestReviewIntake
        ? productReviewHref({
            affiliateProfileId: requestedAffiliateProfileId,
            intakeId: latestReviewIntake.id,
            showAllWorkspaces,
          })
        : null,
    };
  });

  return (
    <div className="stack">
      {products.length ? (
        <ProductList products={productRows} />
      ) : (
        <EmptyState
          icon={Package}
          title={currentWorkspace && !showAllWorkspaces ? "Belum ada produk di workspace ini." : "Belum ada produk."}
          description="Mulai dari intake."
          action={
            <Link className="button primary" href="/products/new">
              <Plus size={16} aria-hidden="true" />
              Intake baru
            </Link>
          }
        />
      )}
    </div>
  );
}
