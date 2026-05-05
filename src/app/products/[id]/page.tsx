import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Archive, Clock3, FileText, Image, Link2, Package, Workflow } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { TopbarOverride } from "@/components/operator/topbar-context";
import { listContents } from "@/lib/server/contents";
import { listClipJobs, listGeneratedFiles } from "@/lib/server/clip-jobs";
import { listDriveItems } from "@/lib/server/drive-items";
import { listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { listIntakeSessions } from "@/lib/server/intake";
import { listProductAnchors } from "@/lib/server/product-anchors";
import { listProductMarketplaceSources } from "@/lib/server/product-marketplace-sources";
import { getProductById, listProductImages } from "@/lib/server/products";
import { listPromptPacks } from "@/lib/server/prompt-packs";
import { listWorkspaces } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

type ProductRecord = NonNullable<Awaited<ReturnType<typeof getProductById>>>;
type ProductImageRecord = Awaited<ReturnType<typeof listProductImages>>[number];
type IntakeSessionRecord = Awaited<ReturnType<typeof listIntakeSessions>>[number];
type PromptPackRecord = Awaited<ReturnType<typeof listPromptPacks>>[number];
type ContentRecord = Awaited<ReturnType<typeof listContents>>[number];
type ClipJobRecord = Awaited<ReturnType<typeof listClipJobs>>[number];
type GeneratedFileRecord = Awaited<ReturnType<typeof listGeneratedFiles>>[number];
type DriveItemRecord = Awaited<ReturnType<typeof listDriveItems>>[number];
type AffiliateProfileRecord = Awaited<ReturnType<typeof listAffiliateProfiles>>[number];
type MarketplaceSourceRecord = Awaited<ReturnType<typeof listProductMarketplaceSources>>[number];
type ProductAnchorRecord = Awaited<ReturnType<typeof listProductAnchors>>[number];
type WorkspaceRecord = Awaited<ReturnType<typeof listWorkspaces>>[number];

const detailTabs = [
  { key: "metadata", label: "Metadata" },
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
  return workspace ? workspace.workspace_name : "Workspace unavailable";
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function readJsonField(record: unknown, key: string) {
  if (!isJsonRecord(record)) {
    return null;
  }

  return record[key] ?? null;
}

function readJsonFieldText(record: unknown, key: string) {
  return readJsonText(readJsonField(record, key));
}

function formatTagText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const tags = value
      .map((item) => readJsonText(item))
      .filter(Boolean)
      .map((tag) => tag.replace(/^#+/, ""))
      .map((tag) => `#${tag}`);

    return tags.length ? tags.join(" ") : "";
  }

  if (isJsonRecord(value)) {
    const arrayCandidate = value.tags ?? value.tag_list ?? value.items;

    if (Array.isArray(arrayCandidate)) {
      return formatTagText(arrayCandidate);
    }
  }

  return "";
}

function resolveCaption(content: ContentRecord | null | undefined) {
  if (!content) {
    return "";
  }

  return (
    content.caption_shopee?.trim() ||
    content.caption_tiktok?.trim() ||
    content.angle?.trim() ||
    content.hook_type?.trim() ||
    ""
  );
}

function resolveTags(content: ContentRecord | null | undefined) {
  if (!content) {
    return "";
  }

  return formatTagText(content.tags_shopee) || formatTagText(content.tags_tiktok);
}

function resolveOutputClipStatus(
  clipJob: ClipJobRecord | null | undefined,
  generatedFile: GeneratedFileRecord | null | undefined,
) {
  if (clipJob?.status === "APPROVED" || generatedFile?.match_status === "MATCHED") {
    return "Approved";
  }

  if (
    generatedFile ||
    clipJob?.status === "IMPORTED" ||
    clipJob?.status === "NEEDS_REVIEW" ||
    clipJob?.status === "RUNNING" ||
    clipJob?.status === "IMPORTING"
  ) {
    return "Imported";
  }

  return "Belum Ada";
}

function resolveOutputPackageStatus(clipStatuses: string[]) {
  if (!clipStatuses.length || clipStatuses.every((status) => status === "Belum Ada")) {
    return "Belum Ada";
  }

  if (clipStatuses.every((status) => status === "Approved")) {
    return "Approved";
  }

  return "Imported";
}

function toneForClipStatus(status: string) {
  if (status === "Approved") {
    return "success" as const;
  }

  if (status === "Imported") {
    return "info" as const;
  }

  return "neutral" as const;
}

function toneForFileStatus(status: string) {
  if (status === "MATCHED" || status === "IMPORTED") {
    return "success" as const;
  }

  if (status === "NEEDS_REVIEW") {
    return "warning" as const;
  }

  if (status === "ERROR") {
    return "danger" as const;
  }

  return "info" as const;
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
  const requestedTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const activeTab = resolveTab(requestedTab);

  let product: ProductRecord | null = null;
  let productImages: ProductImageRecord[] = [];
  let driveItems: DriveItemRecord[] = [];
  let intakeSessions: IntakeSessionRecord[] = [];
  let marketplaceSources: MarketplaceSourceRecord[] = [];
  let anchors: ProductAnchorRecord[] = [];
  let promptPacks: PromptPackRecord[] = [];
  let workspaces: WorkspaceRecord[] = [];
  let affiliateProfiles: AffiliateProfileRecord[] = [];
  let contents: ContentRecord[] = [];
  let clipJobs: ClipJobRecord[] = [];
  let generatedFiles: GeneratedFileRecord[] = [];

  try {
    [
      product,
      productImages,
      driveItems,
      intakeSessions,
      marketplaceSources,
      anchors,
      promptPacks,
      workspaces,
      affiliateProfiles,
      contents,
      clipJobs,
      generatedFiles,
    ] = await Promise.all([
      getProductById(id),
      listProductImages({ productId: id, limit: 200 }),
      listDriveItems({ limit: 200 }),
      listIntakeSessions({ productId: id, limit: 200 }),
      listProductMarketplaceSources({ productId: id, limit: 200 }),
      listProductAnchors({ productId: id, limit: 200 }),
      listPromptPacks({ productId: id, limit: 200 }),
      listWorkspaces({ limit: 200 }),
      listAffiliateProfiles({ limit: 200 }),
      listContents({ productId: id, limit: 200 }),
      listClipJobs({ limit: 200 }),
      listGeneratedFiles({ limit: 200 }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load product detail.";

    return (
      <div className="stack">
        <div className="surface-toolbar">
          <span className="surface-context">Detail produk</span>
          <div className="surface-toolbar__actions">
            <Link className="button compact" href="/products">
              <ArrowLeft size={16} aria-hidden="true" />
              Products
            </Link>
          </div>
        </div>
        <SectionCard icon={Package} title="Unable to load product detail." description={message}>
          <EmptyState icon={Package} title="Detail unavailable." description="Try again." />
        </SectionCard>
      </div>
    );
  }

  if (!product) {
    notFound();
  }

  if (product.status === "ARCHIVED") {
    redirect("/products?message=Data%20dihapus.");
  }

  const visibleDriveItems = driveItems.filter((item) => item.status !== "ARCHIVED");
  const visiblePromptPacks = promptPacks.filter((pack) => pack.status !== "ARCHIVED");
  const visibleAffiliateProfiles = affiliateProfiles.filter((profile) => profile.status !== "ARCHIVED");
  const workspaceMap = new Map(workspaces.filter((workspace) => workspace.status !== "ARCHIVED").map((workspace) => [workspace.id, workspace]));
  const productWorkspaceId = product.workspace_id;
  const scopedAffiliateProfiles = productWorkspaceId
    ? visibleAffiliateProfiles.filter((profile) => profile.workspace_ids.includes(productWorkspaceId))
    : visibleAffiliateProfiles;
  const affiliateProfileMap = new Map(scopedAffiliateProfiles.map((profile) => [profile.id, profile]));
  const productWorkspaceLabel = workspaceLabel(product.workspace_id, workspaceMap);
  const driveItemMap = new Map(visibleDriveItems.map((item) => [item.id, item]));
  const primaryImage = productImages.find((image) => image.is_primary) ?? productImages[0] ?? null;
  const primaryDriveItem = primaryImage ? driveItemMap.get(primaryImage.drive_item_ref_id) ?? null : null;
  const latestPromptPack = visiblePromptPacks[0] ?? null;

  if (requestedTab === "prompt_pack") {
    redirect(latestPromptPack ? `/prompts/${latestPromptPack.id}/history` : `/products/${product.id}?tab=metadata`);
  }

  const latestIntakeSession = intakeSessions.find((session) => session.reviewed_metadata_json || session.parsed_metadata_json) ?? null;
  const reviewedMetadata = (latestIntakeSession?.reviewed_metadata_json ?? latestIntakeSession?.parsed_metadata_json ?? null) as
    | Record<string, unknown>
    | null;
  const orderedContents = [...contents].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
  const outputContents = orderedContents.slice(0, 2);
  const relevantContentIds = new Set(contents.map((content) => content.id));
  const relevantClipJobs = clipJobs.filter((clipJob) => relevantContentIds.has(clipJob.content_id));
  const clipJobsByContentId = new Map<string, ClipJobRecord[]>();
  const clipJobMap = new Map<string, ClipJobRecord>();

  for (const clipJob of relevantClipJobs) {
    clipJobMap.set(clipJob.id, clipJob);
    const existing = clipJobsByContentId.get(clipJob.content_id) ?? [];
    existing.push(clipJob);
    clipJobsByContentId.set(clipJob.content_id, existing);
  }

  const generatedFilesByClipJobId = new Map<string, GeneratedFileRecord[]>();

  for (const generatedFile of generatedFiles) {
    if (!generatedFile.clip_job_id || !clipJobMap.has(generatedFile.clip_job_id)) {
      continue;
    }

    const existing = generatedFilesByClipJobId.get(generatedFile.clip_job_id) ?? [];
    existing.push(generatedFile);
    generatedFilesByClipJobId.set(generatedFile.clip_job_id, existing);
  }

  const relevantGeneratedFiles = generatedFiles.filter((generatedFile) => generatedFile.clip_job_id && clipJobMap.has(generatedFile.clip_job_id));

  const outputClipRows = [0, 1].map((slotIndex) => {
    const content = outputContents[slotIndex] ?? null;

    if (!content) {
      return {
        content: null,
        clipJob: null,
        generatedFile: null,
        status: "Belum Ada",
      } as const;
    }

    const relatedClipJobs = [...(clipJobsByContentId.get(content.id) ?? [])].sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );
    const latestClipJob = relatedClipJobs[0] ?? null;
    const generatedFile =
      latestClipJob && generatedFilesByClipJobId.get(latestClipJob.id)
        ? [...generatedFilesByClipJobId.get(latestClipJob.id)!].sort(
            (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
          )[0] ?? null
        : null;

    return {
      content,
      clipJob: latestClipJob,
      generatedFile,
      status: resolveOutputClipStatus(latestClipJob, generatedFile),
    } as const;
  });

  const outputPackageStatus = resolveOutputPackageStatus(outputClipRows.map((item) => item.status));
  const outputCaption = outputClipRows[0] ? resolveCaption(outputClipRows[0].content) : "";
  const outputTags = outputClipRows[0] ? resolveTags(outputClipRows[0].content) : "";
  const outputProductName =
    readJsonFieldText(reviewedMetadata, "nama_produk") || readJsonFieldText(reviewedMetadata, "product_title") || product.product_name;
  const outputKeyword =
    readJsonFieldText(reviewedMetadata, "keyword_cari_etalase") ||
    readJsonFieldText(reviewedMetadata, "category") ||
    readJsonFieldText(reviewedMetadata, "selling_angle");
  const hasReferenceDetails = Boolean(productImages.length || intakeSessions.length || marketplaceSources.length || anchors.length);
  const hasTechnicalHistoryDetails = Boolean(relevantClipJobs.length || relevantGeneratedFiles.length);

  const timelineItems = [
    {
      at: product.created_at,
      title: "Product created",
      description: product.product_name,
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
      description: session.product_title ?? "Intake",
      status: session.status,
    })),
    ...visiblePromptPacks.map((pack) => ({
      at: pack.created_at,
      title: "Prompt pack",
      description: `Version ${pack.version}`,
      status: pack.status,
    })),
    ...relevantClipJobs.map((clipJob) => ({
      at: clipJob.created_at,
      title: "Clip job",
      description: `Version ${clipJob.version}`,
      status: clipJob.status,
    })),
    ...relevantGeneratedFiles.map((generatedFile) => ({
      at: generatedFile.imported_at ?? generatedFile.created_at,
      title: "Generated file",
      description: generatedFile.file_name,
      status: generatedFile.match_status,
    })),
    ...anchors.map((anchor) => ({
      at: anchor.created_at,
      title: "Anchor",
      description: `Version ${anchor.version}`,
      status: anchor.status,
    })),
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());

  return (
    <div className="stack">
      <TopbarOverride
        title={product.product_name}
        subtitle={[productWorkspaceLabel, product.status].filter(Boolean).join(" - ")}
        hideSettingsLink
      />

      <div className="surface-toolbar">
        <span className="surface-context">Detail produk</span>
      </div>

      <nav className="tab-nav tab-nav--flush" aria-label="Product detail tabs">
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
            actions={<StatusBadge status={product.status} />}
          >
            <div className="metric-grid">
              <div className="metric">
                <span>Workspace</span>
                <strong>{productWorkspaceLabel}</strong>
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
          </SectionCard>

          {hasReferenceDetails ? (
            <details>
              <summary>Referensi audit</summary>
              <div className="stack product-detail-collection">
                {productImages.length ? (
                  <SectionCard icon={Image} title="Source images">
                    <ul className="list">
                      {productImages.map((image) => {
                        const driveItem = driveItemMap.get(image.drive_item_ref_id);

                        return (
                          <li key={image.id}>
                            <div className="stack-tight">
                              <strong>{driveItem?.name ?? image.drive_item_ref_id}</strong>
                              <span className="subtle">
                                {[driveItem?.drive_path, image.is_primary ? "Primary" : null].filter(Boolean).join(" - ")}
                              </span>
                            </div>
                            <StatusBadge status={image.status} />
                          </li>
                        );
                      })}
                    </ul>
                  </SectionCard>
                ) : null}

                {intakeSessions.length ? (
                  <SectionCard icon={Archive} title="Intake">
                    <ul className="list">
                      {intakeSessions.map((session) => (
                        <li key={session.id}>
                          <div className="stack-tight">
                            <strong>{fieldValue(session.product_title)}</strong>
                            <span className="subtle">
                              {[session.shopee_url ? "Shopee" : null, session.tiktok_url ? "TikTok" : null]
                                .filter(Boolean)
                                .join(" - ")}
                            </span>
                          </div>
                          <StatusBadge status={session.status} />
                        </li>
                      ))}
                    </ul>
                  </SectionCard>
                ) : null}

                {marketplaceSources.length ? (
                  <SectionCard icon={Link2} title="Marketplace sources">
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
                  </SectionCard>
                ) : null}

                {anchors.length ? (
                  <SectionCard icon={Workflow} title="Anchor summary">
                    <section className="stack">
                      {anchors.map((anchor) => (
                        <div className="muted-box stack-tight" key={anchor.id}>
                          <div className="section-card__actions">
                            <strong>Anchor</strong>
                            <StatusBadge status={anchor.status} />
                          </div>
                          <p>Version {anchor.version}</p>
                          <details>
                            <summary>Anchor JSON</summary>
                            <pre className="json-block">{prettyJson(anchor.anchor_json)}</pre>
                          </details>
                        </div>
                      ))}
                    </section>
                  </SectionCard>
                ) : null}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {activeTab === "output" ? (
        <section className="stack">
          <SectionCard
            icon={Archive}
            title="Output"
          >
            {outputContents.length ? (
              <div className="stack">
                <div className="metric-grid">
                  <div className="metric">
                    <span>Nama Produk</span>
                    <strong>{outputProductName}</strong>
                  </div>
                  <div className="metric">
                    <span>Keyword Etalase</span>
                    <strong>{outputKeyword || "Belum ada"}</strong>
                  </div>
                  <div className="metric">
                    <span>Caption</span>
                    <strong>{outputCaption || "Belum ada"}</strong>
                  </div>
                  <div className="metric">
                    <span>Tags</span>
                    <strong>{outputTags || "Belum ada"}</strong>
                  </div>
                  <div className="metric">
                    <span>Status</span>
                    <strong>
                      <StatusBadge status={outputPackageStatus} tone={toneForClipStatus(outputPackageStatus)} />
                    </strong>
                  </div>
                </div>
                <section className="grid two-up">
                  {outputClipRows.map(({ generatedFile, status }, index) => {
                    const generatedDriveItem = generatedFile ? driveItemMap.get(generatedFile.drive_item_id) ?? null : null;
                    const clipLabel = `Clip ${index + 1}`;

                    return (
                      <div className="muted-box stack-tight" key={clipLabel}>
                        <div className="section-card__actions">
                          <strong>{clipLabel}</strong>
                          <StatusBadge status={status} tone={toneForClipStatus(status)} />
                        </div>
                        {generatedDriveItem ? (
                          <a href={generatedDriveItem.drive_url} target="_blank" rel="noreferrer">
                            {generatedDriveItem.name}
                          </a>
                        ) : null}
                        {!generatedDriveItem ? (
                          <EmptyState
                            icon={Archive}
                            title={`${clipLabel} belum ada.`}
                            description="Drive link belum tersedia."
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </section>
              </div>
            ) : (
              <EmptyState
                icon={Archive}
                title="No output package yet."
                description="Belum ada output."
              />
            )}
          </SectionCard>
        </section>
      ) : null}

      {activeTab === "history" ? (
        <section className="stack">
          <SectionCard icon={Clock3} title="History">
            <ol className="timeline">
              {timelineItems.map((item, index) => (
                <li className="timeline-item" key={`${item.title}-${item.at}-${index}`}>
                  <div className="timeline-item__body">
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <span className="timeline-item__date">{formatDate(item.at)}</span>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard icon={FileText} title="Prompt pack versions">
            {visiblePromptPacks.length ? (
              <ul className="list">
                {visiblePromptPacks.map((pack) => {
                  const intakeSession = pack.intake_session_id
                    ? intakeSessions.find((session) => session.id === pack.intake_session_id) ?? null
                    : null;
                  const affiliateProfile = pack.affiliate_profile_id
                    ? affiliateProfileMap.get(pack.affiliate_profile_id) ?? null
                    : null;
                  const sourceImage = pack.source_product_image_id
                    ? productImages.find((image) => image.id === pack.source_product_image_id) ?? null
                    : null;
                  const sourceDriveItem = sourceImage ? driveItemMap.get(sourceImage.drive_item_ref_id) ?? null : null;
                  const description =
                    [
                      intakeSession ? "Intake reviewed" : null,
                      affiliateProfile ? affiliateProfile.profile_name : null,
                      sourceDriveItem?.name ?? null,
                    ]
                      .filter(Boolean)
                      .join(" - ") || "No source image selected.";

                  return (
                    <li key={pack.id}>
                      <div className="stack-tight">
                        <strong>{`Version ${pack.version}`}</strong>
                        <span className="subtle">{description}</span>
                        {pack.error_message ? <span className="error-box">{pack.error_message}</span> : null}
                      </div>
                      <div className="section-card__actions">
                        <StatusBadge status={pack.status} />
                        <Link className="button compact primary" href={`/prompts/${pack.id}`}>
                          Buka
                        </Link>
                        <Link className="button compact tertiary" href={`/prompts/${pack.id}/history`}>
                          History
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={FileText} title="No prompt packs yet." description="Belum ada prompt pack." />
            )}
          </SectionCard>
          {hasTechnicalHistoryDetails ? (
            <details>
              <summary>Detail teknis</summary>
              <div className="stack product-detail-collection">
                {relevantClipJobs.length ? (
                  <SectionCard icon={FileText} title="Clip jobs">
                    <ul className="list">
                      {[...relevantClipJobs]
                        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
                        .map((clipJob) => {
                          const generatedFile = generatedFilesByClipJobId.get(clipJob.id)?.[0] ?? null;
                          const generatedDriveItem = generatedFile ? driveItemMap.get(generatedFile.drive_item_id) ?? null : null;

                          return (
                            <li key={clipJob.id}>
                              <div className="stack-tight">
                                <strong>Clip job</strong>
                                <span className="subtle">{`Version ${clipJob.version}`}</span>
                                <span className="subtle">{clipJob.prompt_prefix}</span>
                                {generatedDriveItem ? (
                                  <a href={generatedDriveItem.drive_url} target="_blank" rel="noreferrer">
                                    {generatedDriveItem.name}
                                  </a>
                                ) : null}
                              </div>
                              <StatusBadge status={clipJob.status} />
                            </li>
                          );
                        })}
                    </ul>
                  </SectionCard>
                ) : null}

                {relevantGeneratedFiles.length ? (
                  <SectionCard icon={Archive} title="Generated files">
                    <ul className="list">
                      {[...relevantGeneratedFiles]
                        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
                        .map((generatedFile) => {
                          const clipJob = generatedFile.clip_job_id ? clipJobMap.get(generatedFile.clip_job_id) ?? null : null;
                          const driveItem = driveItemMap.get(generatedFile.drive_item_id) ?? null;

                          return (
                            <li key={generatedFile.id}>
                              <div className="stack-tight">
                                <strong>{generatedFile.file_name}</strong>
                                <span className="subtle">
                                  {[clipJob ? "Clip job" : null, driveItem?.drive_path].filter(Boolean).join(" - ")}
                                </span>
                                {generatedFile.imported_at ? <span className="subtle">Imported {formatDate(generatedFile.imported_at)}</span> : null}
                                {driveItem ? (
                                  <a href={driveItem.drive_url} target="_blank" rel="noreferrer">
                                    {driveItem.name}
                                  </a>
                                ) : null}
                              </div>
                              <StatusBadge status={generatedFile.match_status} tone={toneForFileStatus(generatedFile.match_status)} />
                            </li>
                          );
                        })}
                    </ul>
                  </SectionCard>
                ) : null}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
