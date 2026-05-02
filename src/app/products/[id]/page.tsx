import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Archive, Clock3, FileText, Image, Link2, Package, Plus, Workflow } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { listDriveItems } from "@/lib/server/drive-items";
import { listIntakeSessions } from "@/lib/server/intake";
import { listProductAnchors } from "@/lib/server/product-anchors";
import { listProductMarketplaceSources } from "@/lib/server/product-marketplace-sources";
import { getProductById, listProductImages } from "@/lib/server/products";
import { listPromptPacks } from "@/lib/server/prompt-packs";
import { listWorkspaces } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const detailTabs = [
  { key: "metadata", label: "Metadata" },
  { key: "prompt", label: "Prompt" },
  { key: "output", label: "Output" },
  { key: "history", label: "History" },
] as const;

type DetailTab = (typeof detailTabs)[number]["key"];

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
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

function prettyJson(value: unknown) {
  return value ? JSON.stringify(value, null, 2) : "No output yet.";
}

function resolveTab(value: string | string[] | undefined): DetailTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return detailTabs.some((item) => item.key === tab) ? (tab as DetailTab) : "metadata";
}

function workspaceLabel(workspaceId: string | null, workspaceMap: Map<string, { workspace_code: string; workspace_name: string }>) {
  if (!workspaceId) {
    return "Unassigned";
  }

  const workspace = workspaceMap.get(workspaceId);
  return workspace ? `${workspace.workspace_code} - ${workspace.workspace_name}` : "Workspace unavailable";
}

export default async function ProductDetailPage({ params, searchParams }: ProductDetailPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const activeTab = resolveTab(query.tab);

  let product;

  try {
    product = await getProductById(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load product.";

    return (
      <SectionCard icon={Package} badge="Error" title="Unable to load product." description={message}>
        <EmptyState icon={Package} title="Product unavailable." description="Try again." />
      </SectionCard>
    );
  }

  if (!product) {
    notFound();
  }

  let productImages;
  let driveItems;
  let intakeSessions;
  let marketplaceSources;
  let anchors;
  let promptPacks;
  let workspaces;

  try {
    [productImages, driveItems, marketplaceSources, anchors, promptPacks, intakeSessions, workspaces] = await Promise.all([
      listProductImages({ productId: product.id, limit: 200 }),
      listDriveItems({ limit: 200 }),
      listProductMarketplaceSources({ productId: product.id, limit: 200 }),
      listProductAnchors({ productId: product.id, limit: 200 }),
      listPromptPacks({ productId: product.id, limit: 200 }),
      listIntakeSessions({ productId: product.id, limit: 200 }),
      listWorkspaces({ limit: 200 }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load product detail.";

    return (
      <div className="stack">
        <PageHeader
          icon={Package}
          badge={product.product_code}
          title={product.product_name}
          description="Product detail is unavailable."
          actions={
            <Link className="button" href="/products">
              <ArrowLeft size={16} aria-hidden="true" />
              Products
            </Link>
          }
        />
        <SectionCard icon={Package} badge="Error" title="Unable to load product detail." description={message}>
          <EmptyState icon={Package} title="Detail unavailable." description="Try again." />
        </SectionCard>
      </div>
    );
  }

  const workspaceMap = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const productWorkspaceLabel = workspaceLabel(product.workspace_id, workspaceMap);
  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));
  const generatedPromptCount = promptPacks.filter((pack) => pack.status === "GENERATED").length;
  const primaryImage = productImages.find((image) => image.is_primary) ?? productImages[0] ?? null;
  const primaryDriveItem = primaryImage ? driveItemMap.get(primaryImage.drive_item_ref_id) ?? null : null;

  const timelineItems = [
    {
      at: product.created_at,
      title: "Product created",
      description: `${product.product_code} - ${product.product_name}`,
      status: product.status,
    },
    ...(product.updated_at !== product.created_at
      ? [
          {
            at: product.updated_at,
            title: "Product updated",
            description: "Product metadata changed.",
            status: product.status,
          },
        ]
      : []),
    ...intakeSessions.map((session) => ({
      at: session.created_at,
      title: "Intake saved",
      description: session.product_title ?? session.intake_code,
      status: session.status,
    })),
    ...promptPacks.map((pack) => ({
      at: pack.created_at,
      title: "Prompt pack",
      description: `${pack.prompt_code} v${pack.version}`,
      status: pack.status,
    })),
    ...anchors.map((anchor) => ({
      at: anchor.created_at,
      title: "Anchor",
      description: `${anchor.anchor_code} v${anchor.version}`,
      status: anchor.status,
    })),
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());

  return (
    <div className="stack">
      <PageHeader
        icon={Package}
        badge={product.product_code}
        title={product.product_name}
        description={`Main product surface. Workspace: ${productWorkspaceLabel}.`}
        actions={
          <>
            <Link className="button" href="/products">
              <ArrowLeft size={16} aria-hidden="true" />
              Products
            </Link>
            <Link className="button primary" href="/products/new">
              <Plus size={16} aria-hidden="true" />
              New intake
            </Link>
          </>
        }
        stats={[
          { label: "Workspace", value: productWorkspaceLabel },
          { label: "Status", value: <StatusBadge status={product.status} /> },
          { label: "Source images", value: productImages.length },
          { label: "Prompt packs", value: promptPacks.length },
          { label: "Generated", value: generatedPromptCount },
        ]}
      />

      <nav className="tab-nav" aria-label="Product detail tabs">
        {detailTabs.map((tab) => (
          <Link
            aria-current={activeTab === tab.key ? "page" : undefined}
            className="tab-link"
            data-active={activeTab === tab.key ? "true" : undefined}
            href={`/products/${product.id}?tab=${tab.key}`}
            key={tab.key}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === "metadata" ? (
        <section className="stack">
          <SectionCard
            icon={Package}
            title="Product metadata"
            description="Product record, intake source, and marketplace context."
            actions={<StatusBadge status={product.status} />}
          >
            <div className="metric-grid">
              <div className="metric">
                <span>Workspace</span>
                <strong>{productWorkspaceLabel}</strong>
              </div>
              <div className="metric">
                <span>Code</span>
                <strong>{product.product_code}</strong>
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
                <span>Primary image</span>
                <strong>{primaryDriveItem?.name ?? "Not attached"}</strong>
              </div>
              <div className="metric">
                <span>Created</span>
                <strong>{formatDate(product.created_at)}</strong>
              </div>
              <div className="metric">
                <span>Updated</span>
                <strong>{formatDate(product.updated_at)}</strong>
              </div>
            </div>
            {product.marketplace_product_link ? (
              <a className="button compact" href={product.marketplace_product_link} target="_blank" rel="noreferrer">
                <Link2 size={15} aria-hidden="true" />
                Open source link
              </a>
            ) : null}
            {product.notes ? <p>{product.notes}</p> : <p className="subtle">No product notes yet.</p>}
          </SectionCard>

          <SectionCard icon={Image} title="Source images" description="Existing Drive-backed product image references.">
            {productImages.length ? (
              <ul className="list">
                {productImages.map((image) => {
                  const driveItem = driveItemMap.get(image.drive_item_ref_id);

                  return (
                    <li key={image.id}>
                      <div className="stack-tight">
                        <strong>{driveItem?.name ?? image.drive_item_ref_id}</strong>
                        <span className="subtle">
                          {[driveItem?.drive_path, image.is_primary ? "Primary" : null, image.notes].filter(Boolean).join(" - ")}
                        </span>
                      </div>
                      <StatusBadge status={image.status} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={Image} title="No source images." description="Attach Drive references before live visual prompt work." />
            )}
          </SectionCard>

          <SectionCard icon={Archive} title="Intake" description="Intake sessions linked to this product.">
            {intakeSessions.length ? (
              <ul className="list">
                {intakeSessions.map((session) => (
                  <li key={session.id}>
                    <div className="stack-tight">
                      <strong>{fieldValue(session.product_title)}</strong>
                      <span className="subtle">
                        {[session.shopee_url ? "Shopee" : null, session.tiktok_url ? "TikTok" : null, session.intake_code]
                          .filter(Boolean)
                          .join(" - ")}
                      </span>
                    </div>
                    <StatusBadge status={session.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Archive} title="No linked intake." description="New intake sessions appear here after they are linked to a product." />
            )}
          </SectionCard>

          <SectionCard icon={Link2} title="Marketplace sources" description="Shopee and TikTok source metadata saved for this product.">
            {marketplaceSources.length ? (
              <section className="grid two-up">
                {marketplaceSources.map((source) => (
                  <div className="muted-box stack-tight" key={source.id}>
                    <div className="section-card__actions">
                      <strong>{source.platform}</strong>
                      <StatusBadge status={source.status} />
                    </div>
                    <p>{fieldValue(source.title)}</p>
                    <p className="subtle">
                      {[source.category, source.price_text, source.shop_name].filter(Boolean).join(" - ") || "No source details."}
                    </p>
                    {source.product_url ? (
                      <a href={source.product_url} target="_blank" rel="noreferrer">
                        Product URL
                      </a>
                    ) : null}
                  </div>
                ))}
              </section>
            ) : (
              <EmptyState icon={Link2} title="No marketplace sources." description="Saved source metadata appears here." />
            )}
          </SectionCard>

          <SectionCard icon={Workflow} title="Anchor summary" description="Canonical source anchor for prompt continuity.">
            {anchors.length ? (
              <section className="stack">
                {anchors.map((anchor) => (
                  <div className="muted-box stack-tight" key={anchor.id}>
                    <div className="section-card__actions">
                      <strong>{anchor.anchor_code}</strong>
                      <StatusBadge status={anchor.status} />
                    </div>
                    <p>Version {anchor.version}</p>
                    {anchor.notes ? <p className="subtle">{anchor.notes}</p> : null}
                    <details>
                      <summary>Anchor JSON</summary>
                      <pre className="json-block">{prettyJson(anchor.anchor_json)}</pre>
                    </details>
                  </div>
                ))}
              </section>
            ) : (
              <EmptyState icon={Workflow} title="No anchor yet." description="Anchor data appears here after the intake review flow creates it." />
            )}
          </SectionCard>
        </section>
      ) : null}

      {activeTab === "prompt" ? (
        <section className="stack">
          <SectionCard
            icon={FileText}
            title="Prompt pack history"
            description="Prompt packs for this product. Controller uses ready prompts for execution."
          >
            {promptPacks.length ? (
              <section className="stack">
                {promptPacks.map((pack) => {
                  const sourceImage = pack.source_product_image_id
                    ? productImages.find((image) => image.id === pack.source_product_image_id) ?? null
                    : null;
                  const sourceDriveItem = sourceImage ? driveItemMap.get(sourceImage.drive_item_ref_id) ?? null : null;

                  return (
                    <SectionCard
                      actions={<StatusBadge status={pack.status} />}
                      badge={pack.prompt_code}
                      icon={FileText}
                      key={pack.id}
                      title={`Version ${pack.version}`}
                      description={sourceDriveItem?.name ?? "No source image selected."}
                    >
                      <div className="metric-grid">
                        <div className="metric">
                          <span>Status</span>
                          <strong>
                            <StatusBadge status={pack.status} />
                          </strong>
                        </div>
                        <div className="metric">
                          <span>Created</span>
                          <strong>{formatDate(pack.created_at)}</strong>
                        </div>
                        <div className="metric">
                          <span>Source image</span>
                          <strong>{sourceDriveItem?.name ?? "Not attached"}</strong>
                        </div>
                      </div>
                      {pack.error_message ? <section className="error-box">{pack.error_message}</section> : null}
                      <details open>
                        <summary>Product analysis</summary>
                        <pre className="json-block">{prettyJson(pack.product_analysis_json)}</pre>
                      </details>
                      <details>
                        <summary>I2I prompts</summary>
                        <pre className="json-block">{prettyJson(pack.i2i_prompts_json)}</pre>
                      </details>
                      <details>
                        <summary>I2V prompts</summary>
                        <pre className="json-block">{prettyJson(pack.i2v_prompts_json)}</pre>
                      </details>
                      <details>
                        <summary>Consistency rules</summary>
                        <pre className="json-block">{prettyJson(pack.consistency_rules_json)}</pre>
                      </details>
                    </SectionCard>
                  );
                })}
              </section>
            ) : (
              <EmptyState
                icon={FileText}
                title="No prompt packs yet."
                description="Prompt packs created for this product will appear here."
                action={
                  <Link className="button" href="/prompts">
                    Compatibility prompt manager
                  </Link>
                }
              />
            )}
          </SectionCard>
        </section>
      ) : null}

      {activeTab === "output" ? (
        <section className="stack">
          <SectionCard
            icon={Archive}
            title="Output"
            description="Clips, captions, tags, links, and upload status will live on the product."
          >
            <div className="metric-grid">
              <div className="metric">
                <span>Clips</span>
                <strong>Not built</strong>
              </div>
              <div className="metric">
                <span>Caption</span>
                <strong>Not built</strong>
              </div>
              <div className="metric">
                <span>Upload status</span>
                <strong>Not built</strong>
              </div>
            </div>
            <EmptyState
              icon={Archive}
              title="Output package is not implemented in Sprint 12A."
              description="Controller will show output/import status during execution workflow scaffolding."
            />
          </SectionCard>
        </section>
      ) : null}

      {activeTab === "history" ? (
        <section className="stack">
          <SectionCard icon={Clock3} title="History" description="Simple product timeline from existing records.">
            <ol className="timeline">
              {timelineItems.map((item, index) => (
                <li className="timeline-item" key={`${item.title}-${item.at}-${index}`}>
                  <div className="timeline-item__body">
                    <span className="subtle">{formatDate(item.at)}</span>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ol>
          </SectionCard>
        </section>
      ) : null}
    </div>
  );
}
