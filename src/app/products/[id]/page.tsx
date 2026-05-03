import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Archive, Clock3, FileText, Image, Link2, Package, Plus, Workflow } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { listContents } from "@/lib/server/contents";
import { listFlowAccounts } from "@/lib/server/flow-accounts";
import { listFlowBatches } from "@/lib/server/flow-batches";
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
import { readPromptPackEditorPromptSet } from "@/lib/prompts/prompt-pack-contract";
import { PROMPT_CLIP_KEYS, PROMPT_CLIP_LABELS, PROMPT_TARGET_MARKETPLACE } from "@/lib/prompts/validation";

export const dynamic = "force-dynamic";

type ProductRecord = NonNullable<Awaited<ReturnType<typeof getProductById>>>;
type ProductImageRecord = Awaited<ReturnType<typeof listProductImages>>[number];
type IntakeSessionRecord = Awaited<ReturnType<typeof listIntakeSessions>>[number];
type PromptPackRecord = Awaited<ReturnType<typeof listPromptPacks>>[number];
type ContentRecord = Awaited<ReturnType<typeof listContents>>[number];
type FlowBatchRecord = Awaited<ReturnType<typeof listFlowBatches>>[number];
type FlowAccountRecord = Awaited<ReturnType<typeof listFlowAccounts>>[number];
type ClipJobRecord = Awaited<ReturnType<typeof listClipJobs>>[number];
type GeneratedFileRecord = Awaited<ReturnType<typeof listGeneratedFiles>>[number];
type DriveItemRecord = Awaited<ReturnType<typeof listDriveItems>>[number];
type AffiliateProfileRecord = Awaited<ReturnType<typeof listAffiliateProfiles>>[number];
type MarketplaceSourceRecord = Awaited<ReturnType<typeof listProductMarketplaceSources>>[number];
type ProductAnchorRecord = Awaited<ReturnType<typeof listProductAnchors>>[number];
type WorkspaceRecord = Awaited<ReturnType<typeof listWorkspaces>>[number];

const detailTabs = [
  { key: "metadata", label: "Metadata" },
  { key: "prompt_pack", label: "Paket Prompt" },
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
    content.content_code
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

function formatFlowAccountLabel(account: FlowAccountRecord | null | undefined) {
  return account?.account_code ?? "Akun tidak tersedia";
}

function flowBatchStatusLabel(batch: FlowBatchRecord) {
  return batch.status === "READY_TO_EXPORT"
    ? "Siap Ekspor"
    : batch.status === "EXPORTED"
      ? "Terekspor"
      : batch.status === "RUNNING"
        ? "Sedang Flow"
        : batch.status === "IMPORTING"
          ? "Mengimpor"
          : batch.status === "PARTIALLY_IMPORTED"
            ? "Sebagian Masuk"
            : batch.status === "IMPORTED"
              ? "Masuk"
              : batch.status === "NEED_MANUAL_MATCH"
                ? "Perlu Cocokkan"
                : batch.status === "CLOSED"
                  ? "Selesai"
                : batch.status;
}

function PromptPackContractPreview({ pack }: { pack: PromptPackRecord }) {
  const promptSet = readPromptPackEditorPromptSet(pack);

  return (
    <div className="stack">
      <section className="grid two-up">
        {PROMPT_CLIP_KEYS.map((clipKey) => {
          const clip = promptSet.clips[clipKey];

          return (
            <div className="muted-box stack-tight" key={clipKey}>
              <strong>{PROMPT_CLIP_LABELS[clipKey]}</strong>
              <div className="stack-tight">
                <span className="subtle">I2I First Frame</span>
                <p>{clip.i2i_first_frame || "Belum ada."}</p>
              </div>
              <div className="stack-tight">
                <span className="subtle">I2I Last Frame</span>
                <p>{clip.i2i_last_frame || "Belum ada."}</p>
              </div>
              <div className="stack-tight">
                <span className="subtle">I2V Prompt</span>
                <p>{clip.i2v_prompt || "Belum ada."}</p>
              </div>
            </div>
          );
        })}
      </section>
      <div className="metric-grid">
        <div className="metric">
          <span>Caption</span>
          <strong>{promptSet.caption || "Belum ada"}</strong>
        </div>
        <div className="metric">
          <span>Tags</span>
          <strong>{promptSet.tags || "Belum ada"}</strong>
        </div>
        <div className="metric">
          <span>Target Marketplace</span>
          <strong>
            <StatusBadge status={PROMPT_TARGET_MARKETPLACE} tone="info" />
          </strong>
        </div>
      </div>
    </div>
  );
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
  let flowBatches: FlowBatchRecord[] = [];
  let flowAccounts: FlowAccountRecord[] = [];
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
      flowBatches,
      flowAccounts,
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
      listFlowBatches({ productId: id, limit: 200 }),
      listFlowAccounts({ limit: 200 }),
      listClipJobs({ limit: 200 }),
      listGeneratedFiles({ limit: 200 }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load product detail.";

    return (
      <div className="stack">
        <PageHeader
          icon={Package}
          badge="Error"
          title="Unable to load product detail."
          description={message}
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

  if (!product) {
    notFound();
  }

  const workspaceMap = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const scopedAffiliateProfiles = product.workspace_id
    ? affiliateProfiles.filter((profile) => profile.workspace_id === product.workspace_id)
    : affiliateProfiles;
  const affiliateProfileMap = new Map(scopedAffiliateProfiles.map((profile) => [profile.id, profile]));
  const productWorkspaceLabel = workspaceLabel(product.workspace_id, workspaceMap);
  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));
  const flowAccountMap = new Map(flowAccounts.map((account) => [account.id, account]));
  const generatedPromptCount = promptPacks.filter((pack) => pack.status === "GENERATED").length;
  const primaryImage = productImages.find((image) => image.is_primary) ?? productImages[0] ?? null;
  const primaryDriveItem = primaryImage ? driveItemMap.get(primaryImage.drive_item_ref_id) ?? null : null;
  const latestPromptPack = promptPacks[0] ?? null;
  const latestIntakeSession = intakeSessions.find((session) => session.reviewed_metadata_json || session.parsed_metadata_json) ?? null;
  const reviewedMetadata = (latestIntakeSession?.reviewed_metadata_json ?? latestIntakeSession?.parsed_metadata_json ?? null) as
    | Record<string, unknown>
    | null;
  const orderedContents = [...contents].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
  const outputContents = orderedContents.slice(0, 2);
  const contentMap = new Map(contents.map((content) => [content.id, content]));
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
  const latestFlowBatch = flowBatches[0] ?? null;
  const driveFolderLink = latestFlowBatch?.drive_output_folder_url ?? latestFlowBatch?.drive_output_folder_id ?? null;
  const outputCaption = outputClipRows[0] ? resolveCaption(outputClipRows[0].content) : "";
  const outputTags = outputClipRows[0] ? resolveTags(outputClipRows[0].content) : "";
  const outputProductName =
    readJsonFieldText(reviewedMetadata, "nama_produk") || readJsonFieldText(reviewedMetadata, "product_title") || product.product_name;
  const outputKeyword =
    readJsonFieldText(reviewedMetadata, "keyword_cari_etalase") ||
    readJsonFieldText(reviewedMetadata, "category") ||
    readJsonFieldText(reviewedMetadata, "selling_angle");
  const latestPromptPackIntake = latestPromptPack?.intake_session_id
    ? intakeSessions.find((session) => session.id === latestPromptPack.intake_session_id) ?? null
    : null;
  const latestPromptPackAffiliateProfile = latestPromptPack?.affiliate_profile_id
    ? affiliateProfileMap.get(latestPromptPack.affiliate_profile_id) ?? null
    : null;
  const latestPromptPackSourceImage = latestPromptPack?.source_product_image_id
    ? productImages.find((image) => image.id === latestPromptPack.source_product_image_id) ?? null
    : null;
  const latestPromptPackSourceDriveItem = latestPromptPackSourceImage
    ? driveItemMap.get(latestPromptPackSourceImage.drive_item_ref_id) ?? null
    : null;
  const latestPromptPackPromptContextJson = prettyJson((latestPromptPack?.personalization_json as { prompt_context?: unknown } | null)?.prompt_context ?? null);

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
    ...flowBatches.map((batch) => ({
      at: batch.created_at,
      title: "Flow batch",
      description: [batch.batch_code, formatFlowAccountLabel(flowAccountMap.get(batch.flow_account_id) ?? null), batch.target_date]
        .filter(Boolean)
        .join(" - "),
      status: flowBatchStatusLabel(batch),
    })),
    ...relevantClipJobs.map((clipJob) => ({
      at: clipJob.created_at,
      title: "Clip job",
      description: [clipJob.job_code, clipJob.clip_code, clipJob.version].filter(Boolean).join(" - "),
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
        description={`Workspace: ${productWorkspaceLabel}.`}
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

          <SectionCard icon={Image} title="Source images">
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
              <EmptyState icon={Image} title="No source images." description="Belum ada gambar." />
            )}
          </SectionCard>

          <SectionCard icon={Archive} title="Intake">
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
              <EmptyState icon={Archive} title="No linked intake." description="Belum ada intake." />
            )}
          </SectionCard>

          <SectionCard icon={Link2} title="Marketplace sources">
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
              <EmptyState icon={Link2} title="No marketplace sources." description="Belum ada source." />
            )}
          </SectionCard>

          <SectionCard icon={Workflow} title="Anchor summary">
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
              <EmptyState icon={Workflow} title="No anchor yet." description="Belum ada anchor." />
            )}
          </SectionCard>
        </section>
      ) : null}

      {activeTab === "prompt_pack" ? (
        <section className="stack">
          <SectionCard
            icon={FileText}
            title="Paket Prompt"
            actions={latestPromptPack ? <StatusBadge status={latestPromptPack.status} /> : null}
          >
            {latestPromptPack ? (
              <div className="muted-box stack">
                <div className="section-card__actions">
                  <strong>{latestPromptPack.prompt_code}</strong>
                  <div className="section-card__actions">
                    <StatusBadge status={latestPromptPack.status} />
                    <StatusBadge status={`Versi ${latestPromptPack.version}`} tone="info" />
                  </div>
                </div>
                <div className="metric-grid">
                  <div className="metric">
                    <span>Intake</span>
                    <strong>{latestPromptPackIntake?.intake_code ?? "Latest workspace intake"}</strong>
                  </div>
                  <div className="metric">
                    <span>Affiliate profile</span>
                    <strong>{latestPromptPackAffiliateProfile?.profile_name ?? "Workspace default"}</strong>
                  </div>
                  <div className="metric">
                    <span>Source image</span>
                    <strong>{latestPromptPackSourceDriveItem?.name ?? "Not attached"}</strong>
                  </div>
                  <div className="metric">
                    <span>Created</span>
                    <strong>{formatDate(latestPromptPack.created_at)}</strong>
                  </div>
                </div>
                <PromptPackContractPreview pack={latestPromptPack} />
                {latestPromptPack.error_message ? <section className="error-box">{latestPromptPack.error_message}</section> : null}
                <FormActions>
                  <Link className="button primary" href="/prompts">
                    Buka editor
                  </Link>
                </FormActions>
                <details>
                  <summary>Prompt context</summary>
                  <pre className="json-block">{latestPromptPackPromptContextJson}</pre>
                </details>
              </div>
            ) : (
              <EmptyState icon={FileText} title="No prompt pack yet." description="Belum ada prompt pack." />
            )}
          </SectionCard>
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
                    <span>Folder Drive</span>
                    <strong>
                      {driveFolderLink ? (
                        driveFolderLink.startsWith("http") ? (
                          <a href={driveFolderLink} target="_blank" rel="noreferrer">
                            {driveFolderLink}
                          </a>
                        ) : (
                          driveFolderLink
                        )
                      ) : (
                        "Belum ada"
                      )}
                    </strong>
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
                    <span className="subtle">{formatDate(item.at)}</span>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ol>
          </SectionCard>
          <SectionCard icon={FileText} title="Prompt pack versions">
            {promptPacks.length ? (
              <section className="stack">
                {promptPacks.map((pack) => {
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
                  const negativeRulesJson = prettyJson(pack.negative_rules_json);
                  const personalizationJson = prettyJson(pack.personalization_json);
                  const promptContextJson = prettyJson((pack.personalization_json as { prompt_context?: unknown } | null)?.prompt_context ?? null);

                  return (
                    <SectionCard
                      actions={<StatusBadge status={pack.status} />}
                      badge={pack.prompt_code}
                      icon={FileText}
                      key={pack.id}
                      title={`Version ${pack.version}`}
                      description={[
                        intakeSession ? `Intake ${intakeSession.intake_code}` : null,
                        affiliateProfile ? `Profile ${affiliateProfile.profile_code}` : null,
                        sourceDriveItem?.name ?? null,
                      ]
                        .filter(Boolean)
                        .join(" - ") || "No source image selected."}
                    >
                      <div className="metric-grid">
                        <div className="metric">
                          <span>Status</span>
                          <strong>
                            <StatusBadge status={pack.status} />
                          </strong>
                        </div>
                        <div className="metric">
                          <span>Intake</span>
                          <strong>{intakeSession?.intake_code ?? "Latest workspace intake"}</strong>
                        </div>
                        <div className="metric">
                          <span>Affiliate profile</span>
                          <strong>{affiliateProfile?.profile_name ?? "Workspace default"}</strong>
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
                      <PromptPackContractPreview pack={pack} />
                      <details open>
                        <summary>Product analysis</summary>
                        <pre className="json-block">{prettyJson(pack.product_analysis_json)}</pre>
                      </details>
                      <details>
                        <summary>Consistency rules</summary>
                        <pre className="json-block">{prettyJson(pack.consistency_rules_json)}</pre>
                      </details>
                      <details>
                        <summary>Negative rules</summary>
                        <pre className="json-block">{negativeRulesJson}</pre>
                      </details>
                      <details>
                        <summary>Personalization</summary>
                        <pre className="json-block">{personalizationJson}</pre>
                      </details>
                      <details>
                        <summary>Prompt context</summary>
                        <pre className="json-block">{promptContextJson}</pre>
                      </details>
                    </SectionCard>
                  );
                })}
              </section>
            ) : (
              <EmptyState icon={FileText} title="No prompt packs yet." description="Belum ada prompt pack." />
            )}
          </SectionCard>
          <SectionCard icon={Workflow} title="Flow batches">
            {flowBatches.length ? (
              <ul className="list">
                {flowBatches.map((batch) => {
                  const flowAccount = flowAccountMap.get(batch.flow_account_id) ?? null;

                  return (
                    <li key={batch.id}>
                      <div className="stack-tight">
                        <strong>{batch.batch_code}</strong>
                        <span className="subtle">
                          {[flowBatchStatusLabel(batch), formatFlowAccountLabel(flowAccount), batch.target_date].filter(Boolean).join(" - ")}
                        </span>
                        {batch.drive_output_folder_url ? (
                          <a href={batch.drive_output_folder_url} target="_blank" rel="noreferrer">
                            Drive folder
                          </a>
                        ) : null}
                      </div>
                      <StatusBadge status={batch.status} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={Workflow} title="No flow batches yet." description="Belum ada batch." />
            )}
          </SectionCard>
          <SectionCard icon={FileText} title="Clip jobs">
            {relevantClipJobs.length ? (
              <ul className="list">
                {[...relevantClipJobs]
                  .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
                  .map((clipJob) => {
                    const content = contentMap.get(clipJob.content_id) ?? null;
                    const generatedFile = generatedFilesByClipJobId.get(clipJob.id)?.[0] ?? null;
                    const generatedDriveItem = generatedFile ? driveItemMap.get(generatedFile.drive_item_id) ?? null : null;

                    return (
                      <li key={clipJob.id}>
                        <div className="stack-tight">
                          <strong>{clipJob.job_code}</strong>
                          <span className="subtle">
                            {[content?.content_code, clipJob.clip_code, clipJob.version].filter(Boolean).join(" - ")}
                          </span>
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
            ) : (
              <EmptyState icon={FileText} title="No clip jobs yet." description="Belum ada clip job." />
            )}
          </SectionCard>
          <SectionCard icon={Archive} title="Generated files">
            {relevantGeneratedFiles.length ? (
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
                            {[clipJob?.job_code, clipJob?.clip_code, driveItem?.drive_path].filter(Boolean).join(" - ")}
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
            ) : (
              <EmptyState icon={Archive} title="No generated files yet." description="Belum ada file." />
            )}
          </SectionCard>
        </section>
      ) : null}
    </div>
  );
}
