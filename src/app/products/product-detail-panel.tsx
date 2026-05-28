import Link from "next/link";
import { Suspense } from "react";
import { Clock3, ExternalLink, FileText, Package, RefreshCcw } from "lucide-react";
import { CopyableReadOnlyField } from "@/components/operator/copyable-readonly-field";
import { EmptyState } from "@/components/operator/empty-state";
import { ErrorState } from "@/components/operator/error-state";
import { SkeletonButton, SkeletonLine } from "@/components/operator/loading-skeleton";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeAnchorButton, NativeLinkButton } from "@/components/ui/native-button";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { ProductOutputFields } from "./product-output-fields";
import { regenerateProductPrompt } from "./actions";
import { listContents } from "@/lib/server/contents";
import { listClipJobs, listGeneratedFiles } from "@/lib/server/clip-jobs";
import { listDriveItems } from "@/lib/server/drive-items";
import { listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { listFlowBatches } from "@/lib/server/flow-batches";
import { listIntakeSessions } from "@/lib/server/intake";
import { listProductAnchors } from "@/lib/server/product-anchors";
import { listProductMarketplaceSources } from "@/lib/server/product-marketplace-sources";
import { getProductById, listProductImages } from "@/lib/server/products";
import { listPromptPacks } from "@/lib/server/prompt-packs";
import { readPromptPackEditorPromptSet } from "@/lib/prompts/prompt-pack-contract";
import { formatAppDateTime } from "@/lib/app-time";

type ProductRecord = NonNullable<Awaited<ReturnType<typeof getProductById>>>;
type ProductImageRecord = Awaited<ReturnType<typeof listProductImages>>[number];
type IntakeSessionRecord = Awaited<ReturnType<typeof listIntakeSessions>>[number];
type PromptPackRecord = Awaited<ReturnType<typeof listPromptPacks>>[number];
type FlowBatchRecord = Awaited<ReturnType<typeof listFlowBatches>>[number];
type ContentRecord = Awaited<ReturnType<typeof listContents>>[number];
type ClipJobRecord = Awaited<ReturnType<typeof listClipJobs>>[number];
type GeneratedFileRecord = Awaited<ReturnType<typeof listGeneratedFiles>>[number];
type DriveItemRecord = Awaited<ReturnType<typeof listDriveItems>>[number];
type AffiliateProfileRecord = Awaited<ReturnType<typeof listAffiliateProfiles>>[number];
type MarketplaceSourceRecord = Awaited<ReturnType<typeof listProductMarketplaceSources>>[number];
type ProductAnchorRecord = Awaited<ReturnType<typeof listProductAnchors>>[number];

export const productDetailTabs = [
  { key: "output", label: "Output" },
  { key: "metadata", label: "Metadata" },
  { key: "history", label: "History" },
] as const;

export type ProductDetailTab = (typeof productDetailTabs)[number]["key"];

type ProductDetailPanelProps = {
  activeTab: ProductDetailTab;
  detailHrefBase: string;
  productId: string;
};

function formatDate(value: string) {
  return formatAppDateTime(value, "-");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => readString(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

type OcrEvidenceView = {
  visibleTextLines: string[];
  extractedFields: {
    productTitle: string;
    category: string;
    ratingText: string;
    soldCountText: string;
    priceText: string;
    shopName: string;
  };
};

function readOcrEvidenceBlock(value: unknown): OcrEvidenceView | null {
  const block = readRecord(value);

  if (!block) {
    return null;
  }

  const qualityFlags = readStringArray(block.quality_flags);

  if (qualityFlags.includes("missing_source_image")) {
    return null;
  }

  const fields = readRecord(block.extracted_fields) ?? {};
  const evidence = {
    visibleTextLines: readStringArray(block.visible_text_lines),
    extractedFields: {
      productTitle: readString(fields.product_title),
      category: readString(fields.category),
      ratingText: readString(fields.rating_text),
      soldCountText: readString(fields.sold_count_text),
      priceText: readString(fields.price_text),
      shopName: readString(fields.shop_name),
    },
  };

  return hasOcrEvidenceContent(evidence) ? evidence : null;
}

function hasOcrEvidenceContent(evidence: OcrEvidenceView) {
  return Boolean(evidence.visibleTextLines.length || Object.values(evidence.extractedFields).some(Boolean));
}

function readMetadataOcrEvidence(metadata: Record<string, unknown> | null, key: "shopee_screenshot" | "tiktok_screenshot") {
  const ocrEvidence = readRecord(metadata?.ocr_evidence);
  return readOcrEvidenceBlock(ocrEvidence?.[key]);
}

function readMarketplaceSourceOcrEvidence(sources: MarketplaceSourceRecord[], platform: "SHOPEE" | "TIKTOK") {
  const source = sources.find((item) => item.platform === platform && item.status !== "ARCHIVED");
  const metadata = readRecord(source?.parsed_metadata_json);
  return readOcrEvidenceBlock(metadata?.ocr_evidence);
}

function ocrLinesValue(evidence: OcrEvidenceView) {
  return evidence.visibleTextLines.join("\n");
}

function OcrCopyFields({ evidence, platform }: { evidence: OcrEvidenceView; platform: "Shopee" | "TikTok" }) {
  return (
    <details className="prompt-output-section" open>
      <summary>OCR {platform}</summary>
      <div className="prompt-output-section__body">
        <CopyableReadOnlyField label="Title" value={evidence.extractedFields.productTitle} />
        <CopyableReadOnlyField label="Kategori" value={evidence.extractedFields.category} />
        <CopyableReadOnlyField label="Rating" value={evidence.extractedFields.ratingText} />
        <CopyableReadOnlyField label="Terjual" value={evidence.extractedFields.soldCountText} />
        <CopyableReadOnlyField label="Harga" value={evidence.extractedFields.priceText} />
        <CopyableReadOnlyField label="Toko" value={evidence.extractedFields.shopName} />
        <CopyableReadOnlyField label="Teks OCR" value={ocrLinesValue(evidence)} />
      </div>
    </details>
  );
}

export function resolveProductDetailTab(value: string | string[] | undefined): ProductDetailTab {
  const tab = Array.isArray(value) ? value[0] : value;
  if (tab === "prompt_pack") {
    return "history";
  }

  return productDetailTabs.some((item) => item.key === tab) ? (tab as ProductDetailTab) : "output";
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

function resolveOutputSummaryStatus(input: {
  hasMetadata: boolean;
  hasPromptOutput: boolean;
  hasFolderDrive: boolean;
}) {
  if (!input.hasMetadata && !input.hasPromptOutput && !input.hasFolderDrive) {
    return "Belum Ada";
  }

  if (input.hasMetadata && !input.hasPromptOutput && !input.hasFolderDrive) {
    return "Metadata Siap";
  }

  if (input.hasMetadata && input.hasPromptOutput && input.hasFolderDrive) {
    return "Output Siap";
  }

  return "Output Parsial";
}

type ProductDetailTabContentProps = {
  activeTab: ProductDetailTab;
  productId: string;
};

function ProductDetailErrorState() {
  return (
    <div className="stack">
      <ErrorState icon={Package} title="Detail produk tidak bisa dimuat." description="Coba lagi." />
    </div>
  );
}

function ProductDetailUnavailableState() {
  return (
    <SectionCard icon={Package} title="Produk tidak tersedia.">
      <EmptyState icon={Package} title="Produk tidak tersedia." description="Data ini mungkin sudah dihapus atau tidak tersedia di workspace aktif." />
    </SectionCard>
  );
}

function ProductDetailReadonlyFieldSkeleton() {
  return (
    <div className="prompt-readonly-field">
      <div className="prompt-readonly-field__header">
        <SkeletonLine size="short" />
        <SkeletonButton />
      </div>
      <div className="prompt-readonly-field__body">
        <SkeletonLine size="long" />
        <SkeletonLine size="medium" />
      </div>
    </div>
  );
}

function ProductDetailOutputLoadingState() {
  return (
    <section className="stack product-detail-tab-content loading-skeleton-static" aria-hidden="true">
      <SectionCard icon={FileText} title="Output Siap Copy">
        <section className="prompt-output-grid loading-skeleton-static">
          <div className="prompt-output-section">
            <ProductDetailReadonlyFieldSkeleton />
            <ProductDetailReadonlyFieldSkeleton />
          </div>
          <div className="prompt-output-section">
            <div className="prompt-output-section__body">
              <ProductDetailReadonlyFieldSkeleton />
              <ProductDetailReadonlyFieldSkeleton />
              <ProductDetailReadonlyFieldSkeleton />
            </div>
          </div>
        </section>
      </SectionCard>
    </section>
  );
}

function ProductDetailMetadataLoadingState() {
  return (
    <section className="stack product-detail-tab-content loading-skeleton-static" aria-hidden="true">
      <section className="prompt-output-grid metadata-ocr-fields" aria-label="OCR screenshot">
        <div className="prompt-output-section">
          <div className="prompt-output-section__body">
            <ProductDetailReadonlyFieldSkeleton />
            <ProductDetailReadonlyFieldSkeleton />
          </div>
        </div>
        <div className="prompt-output-section">
          <div className="prompt-output-section__body">
            <ProductDetailReadonlyFieldSkeleton />
            <ProductDetailReadonlyFieldSkeleton />
          </div>
        </div>
      </section>
    </section>
  );
}

function ProductDetailHistoryLoadingState() {
  return (
    <section className="stack product-detail-tab-content loading-skeleton-static" aria-hidden="true">
      <SectionCard icon={Clock3} title="History">
        <ol className="timeline">
          {Array.from({ length: 4 }).map((_, index) => (
            <li className="timeline-item" key={index}>
              <div className="timeline-item__body">
                <SkeletonLine size="medium" />
                <SkeletonLine size="long" />
                <SkeletonLine size="short" />
              </div>
              <span className="skeleton-pill" />
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard icon={RefreshCcw} title="Generate Ulang Prompt">
        <div className="stack-tight">
          <SkeletonLine size="medium" />
          <SkeletonLine size="long" />
        </div>
        <div className="button-row">
          <SkeletonButton />
        </div>
        <SkeletonLine size="short" />
      </SectionCard>

      <SectionCard icon={FileText} title="Versi Paket Prompt">
        <ul className="list">
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={index}>
              <div className="stack-tight">
                <SkeletonLine size="medium" />
                <SkeletonLine size="long" />
                <SkeletonLine size="short" />
              </div>
              <div className="section-card__actions">
                <span className="skeleton-pill" />
                <SkeletonButton />
                <SkeletonButton />
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>
    </section>
  );
}

function ProductDetailTabLoadingState({ activeTab }: { activeTab: ProductDetailTab }) {
  switch (activeTab) {
    case "metadata":
      return <ProductDetailMetadataLoadingState />;
    case "history":
      return <ProductDetailHistoryLoadingState />;
    default:
      return <ProductDetailOutputLoadingState />;
  }
}

function ProductDetailTabContent({ activeTab, productId }: ProductDetailTabContentProps) {
  switch (activeTab) {
    case "metadata":
      return <ProductDetailMetadataTab productId={productId} />;
    case "history":
      return <ProductDetailHistoryTab productId={productId} />;
    default:
      return <ProductDetailOutputTab productId={productId} />;
  }
}

async function ProductDetailOutputTab({ productId }: { productId: string }) {
  let product: ProductRecord | null = null;
  let driveItems: DriveItemRecord[] = [];
  let intakeSessions: IntakeSessionRecord[] = [];
  let promptPacks: PromptPackRecord[] = [];
  let flowBatches: FlowBatchRecord[] = [];
  let contents: ContentRecord[] = [];
  let clipJobs: ClipJobRecord[] = [];
  let generatedFiles: GeneratedFileRecord[] = [];

  try {
    [product, driveItems, intakeSessions, promptPacks, flowBatches, contents, clipJobs, generatedFiles] = await Promise.all([
      getProductById(productId),
      listDriveItems({ limit: 200 }),
      listIntakeSessions({ productId, limit: 200 }),
      listPromptPacks({ productId, limit: 200 }),
      listFlowBatches({ productId, limit: 200 }),
      listContents({ productId, limit: 200 }),
      listClipJobs({ limit: 200 }),
      listGeneratedFiles({ limit: 200 }),
    ]);
  } catch {
    return <ProductDetailErrorState />;
  }

  if (!product || product.status === "ARCHIVED") {
    return <ProductDetailUnavailableState />;
  }

  const visibleDriveItems = driveItems.filter((item) => item.status !== "ARCHIVED");
  const visiblePromptPacks = promptPacks.filter((pack) => pack.status !== "ARCHIVED");
  const marketplaceProductLink = product.marketplace_product_link?.trim() ?? "";
  const driveItemMap = new Map(visibleDriveItems.map((item) => [item.id, item]));
  const latestPromptPack = visiblePromptPacks[0] ?? null;
  const orderedFlowBatches = [...flowBatches].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const latestFlowBatch =
    orderedFlowBatches.find((batch) => Boolean(batch.drive_output_folder_url?.trim() || batch.drive_output_folder_id?.trim())) ??
    orderedFlowBatches[0] ??
    null;

  const latestIntakeSession = intakeSessions.find((session) => session.reviewed_metadata_json || session.parsed_metadata_json) ?? null;
  const reviewedMetadata = (latestIntakeSession?.reviewed_metadata_json ?? latestIntakeSession?.parsed_metadata_json ?? null) as
    | Record<string, unknown>
    | null;
  const orderedContents = [...contents].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
  const outputContents = orderedContents.slice(0, 2);
  const promptOutputSet = readPromptPackEditorPromptSet(latestPromptPack ?? {});
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

  const legacyClipRows = [0, 1].map((slotIndex) => {
    const content = outputContents[slotIndex] ?? null;

    if (!content) {
      return {
        label: `Clip ${slotIndex + 1}`,
        status: "Belum Ada",
        driveItemName: null,
        driveItemUrl: null,
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
    const generatedDriveItem = generatedFile ? driveItemMap.get(generatedFile.drive_item_id) ?? null : null;

    return {
      label: `Clip ${slotIndex + 1}`,
      status: resolveOutputClipStatus(latestClipJob, generatedFile),
      driveItemName: generatedDriveItem?.name ?? null,
      driveItemUrl: generatedDriveItem?.drive_url ?? null,
    } as const;
  });

  const outputProductName =
    readJsonFieldText(reviewedMetadata, "nama_produk") || readJsonFieldText(reviewedMetadata, "product_title") || product.product_name;
  const outputKeyword = readJsonFieldText(reviewedMetadata, "keyword_cari_etalase") || readJsonFieldText(reviewedMetadata, "category");
  const outputCaption = promptOutputSet.caption.trim();
  const outputTags = promptOutputSet.tags.trim();
  const outputFolderDrive = latestFlowBatch?.drive_output_folder_url?.trim() || latestFlowBatch?.drive_output_folder_id?.trim() || "";
  const outputSummaryStatus = resolveOutputSummaryStatus({
    hasMetadata: Boolean(outputProductName || outputKeyword),
    hasPromptOutput: Boolean(outputCaption || outputTags),
    hasFolderDrive: Boolean(outputFolderDrive),
  });
  const hasLegacyClipData = outputContents.length > 0;

  return (
    <section className="stack product-detail-tab-content">
      <SectionCard
        actions={
          marketplaceProductLink ? (
            <NativeAnchorButton className="compact" href={marketplaceProductLink} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              Buka link
            </NativeAnchorButton>
          ) : null
        }
        icon={FileText}
        title="Output Siap Copy"
      >
        <ProductOutputFields
          caption={outputCaption}
          folderDrive={outputFolderDrive}
          keyword={outputKeyword}
          legacyClipRows={hasLegacyClipData ? legacyClipRows : []}
          productName={outputProductName}
          status={outputSummaryStatus}
          tags={outputTags}
        />
      </SectionCard>
    </section>
  );
}

async function ProductDetailMetadataTab({ productId }: { productId: string }) {
  let product: ProductRecord | null = null;
  let intakeSessions: IntakeSessionRecord[] = [];
  let marketplaceSources: MarketplaceSourceRecord[] = [];

  try {
    [product, intakeSessions, marketplaceSources] = await Promise.all([
      getProductById(productId),
      listIntakeSessions({ productId, limit: 200 }),
      listProductMarketplaceSources({ productId, limit: 200 }),
    ]);
  } catch {
    return <ProductDetailErrorState />;
  }

  if (!product || product.status === "ARCHIVED") {
    return <ProductDetailUnavailableState />;
  }

  const latestIntakeSession = intakeSessions.find((session) => session.reviewed_metadata_json || session.parsed_metadata_json) ?? null;
  const reviewedMetadata = (latestIntakeSession?.reviewed_metadata_json ?? latestIntakeSession?.parsed_metadata_json ?? null) as
    | Record<string, unknown>
    | null;
  const shopeeOcrEvidence =
    readMetadataOcrEvidence(reviewedMetadata, "shopee_screenshot") ?? readMarketplaceSourceOcrEvidence(marketplaceSources, "SHOPEE");
  const tiktokOcrEvidence =
    readMetadataOcrEvidence(reviewedMetadata, "tiktok_screenshot") ?? readMarketplaceSourceOcrEvidence(marketplaceSources, "TIKTOK");
  const hasMetadataOcrEvidence = Boolean(shopeeOcrEvidence || tiktokOcrEvidence);

  return (
    <section className="stack product-detail-tab-content">
      {hasMetadataOcrEvidence ? (
        <section className="prompt-output-grid metadata-ocr-fields" aria-label="OCR screenshot">
          {shopeeOcrEvidence ? <OcrCopyFields evidence={shopeeOcrEvidence} platform="Shopee" /> : null}
          {tiktokOcrEvidence ? <OcrCopyFields evidence={tiktokOcrEvidence} platform="TikTok" /> : null}
        </section>
      ) : (
        <EmptyState icon={Package} title="OCR screenshot belum ada." description="Jalankan Analisis Metadata." />
      )}
    </section>
  );
}

async function ProductDetailHistoryTab({ productId }: { productId: string }) {
  let product: ProductRecord | null = null;
  let productImages: ProductImageRecord[] = [];
  let driveItems: DriveItemRecord[] = [];
  let intakeSessions: IntakeSessionRecord[] = [];
  let promptPacks: PromptPackRecord[] = [];
  let affiliateProfiles: AffiliateProfileRecord[] = [];
  let contents: ContentRecord[] = [];
  let clipJobs: ClipJobRecord[] = [];
  let generatedFiles: GeneratedFileRecord[] = [];
  let anchors: ProductAnchorRecord[] = [];

  try {
    [product, productImages, driveItems, intakeSessions, promptPacks, affiliateProfiles, contents, clipJobs, generatedFiles, anchors] =
      await Promise.all([
        getProductById(productId),
        listProductImages({ productId, limit: 200 }),
        listDriveItems({ limit: 200 }),
        listIntakeSessions({ productId, limit: 200 }),
        listPromptPacks({ productId, limit: 200 }),
        listAffiliateProfiles({ limit: 200 }),
        listContents({ productId, limit: 200 }),
        listClipJobs({ limit: 200 }),
        listGeneratedFiles({ limit: 200 }),
        listProductAnchors({ productId, limit: 200 }),
      ]);
  } catch {
    return <ProductDetailErrorState />;
  }

  if (!product || product.status === "ARCHIVED") {
    return <ProductDetailUnavailableState />;
  }

  const visibleDriveItems = driveItems.filter((item) => item.status !== "ARCHIVED");
  const visiblePromptPacks = promptPacks.filter((pack) => pack.status !== "ARCHIVED");
  const visibleAffiliateProfiles = affiliateProfiles.filter((profile) => profile.status !== "ARCHIVED");
  const productWorkspaceId = product.workspace_id;
  const scopedAffiliateProfiles = productWorkspaceId
    ? visibleAffiliateProfiles.filter((profile) => profile.workspace_ids.includes(productWorkspaceId))
    : visibleAffiliateProfiles;
  const affiliateProfileMap = new Map(scopedAffiliateProfiles.map((profile) => [profile.id, profile]));
  const driveItemMap = new Map(visibleDriveItems.map((item) => [item.id, item]));
  const latestPromptPack = visiblePromptPacks[0] ?? null;
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
  const timelineItems = [
    {
      at: product.created_at,
      title: "Produk dibuat",
      description: product.product_name,
      status: product.status,
    },
    ...(product.updated_at !== product.created_at
      ? [
          {
            at: product.updated_at,
            title: "Produk diperbarui",
            description: "Metadata produk berubah.",
            status: product.status,
          },
        ]
      : []),
    ...intakeSessions.map((session) => ({
      at: session.created_at,
      title: "Intake disimpan",
      description: session.product_title ?? "Intake",
      status: session.status,
    })),
    ...visiblePromptPacks.map((pack) => ({
      at: pack.created_at,
      title: "Paket Prompt",
      description: `Versi ${pack.version}`,
      status: pack.status,
    })),
    ...relevantClipJobs.map((clipJob) => ({
      at: clipJob.created_at,
      title: "Clip diproses",
      description: `Versi ${clipJob.version}`,
      status: clipJob.status,
    })),
    ...relevantGeneratedFiles.map((generatedFile) => ({
      at: generatedFile.imported_at ?? generatedFile.created_at,
      title: "File output",
      description: generatedFile.file_name,
      status: generatedFile.match_status,
    })),
    ...anchors.map((anchor) => ({
      at: anchor.created_at,
      title: "Acuan produk",
      description: `Versi ${anchor.version}`,
      status: anchor.status,
    })),
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());

  return (
    <section className="stack product-detail-tab-content">
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

      {latestPromptPack ? (
        <SectionCard icon={RefreshCcw} title="Generate Ulang Prompt">
          <form action={regenerateProductPrompt} className="stack">
            <input type="hidden" name="product_id" value={product.id} />

            <label className="stack auth-field" htmlFor="revision_instruction">
              <span>Catatan Perubahan</span>
              <textarea
                id="revision_instruction"
                name="revision_instruction"
                rows={3}
                placeholder="Opsional. Jelaskan perubahan yang ingin diterapkan."
                maxLength={500}
              />
            </label>

            <div className="button-row">
              <PendingActionButton
                className="primary"
                pendingLabel="Membuat versi baru..."
                disabled={latestPromptPack.status === "QUEUED" || latestPromptPack.status === "GENERATING"}
              >
                Generate Ulang
              </PendingActionButton>
            </div>

            {latestPromptPack.status === "QUEUED" || latestPromptPack.status === "GENERATING" ? (
              <p className="helper-text">Prompt sedang diproses. Tunggu hingga selesai.</p>
            ) : null}
          </form>
        </SectionCard>
      ) : null}

      <SectionCard icon={FileText} title="Versi Paket Prompt">
        {visiblePromptPacks.length ? (
          <ul className="list">
            {visiblePromptPacks.map((pack) => {
              const intakeSession = pack.intake_session_id ? intakeSessions.find((session) => session.id === pack.intake_session_id) ?? null : null;
              const affiliateProfile = pack.affiliate_profile_id ? affiliateProfileMap.get(pack.affiliate_profile_id) ?? null : null;
              const sourceImage = pack.source_product_image_id ? productImages.find((image) => image.id === pack.source_product_image_id) ?? null : null;
              const sourceDriveItem = sourceImage ? driveItemMap.get(sourceImage.drive_item_ref_id) ?? null : null;
              const description =
                [intakeSession ? "Intake reviewed" : null, affiliateProfile ? affiliateProfile.profile_name : null, sourceDriveItem?.name ?? null]
                  .filter(Boolean)
                  .join(" - ") || "Gambar sumber belum dipilih.";

              return (
                <li key={pack.id}>
                  <div className="stack-tight">
                    <strong>{`Versi ${pack.version}`}</strong>
                    <span className="subtle">{description}</span>
                    {pack.error_message ? <span className="error-box">{pack.error_message}</span> : null}
                  </div>
                  <div className="section-card__actions">
                    <StatusBadge status={pack.status} />
                    <NativeLinkButton className="compact primary" href={`/prompts?detail=${pack.id}`}>
                      Buka
                    </NativeLinkButton>
                    <NativeLinkButton className="compact tertiary" href={`/prompts/${pack.id}/history`}>
                      History
                    </NativeLinkButton>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={FileText} title="Belum ada paket prompt." description="Buat prompt dari produk ini." />
        )}
      </SectionCard>
    </section>
  );
}

export function ProductDetailPanel({ activeTab, detailHrefBase, productId }: ProductDetailPanelProps) {
  const [detailHrefPathname, detailHrefQuery = ""] = detailHrefBase.split("?");

  return (
    <div className="stack operator-detail-panel operator-detail-panel--flush">
      <nav className="tab-nav tab-nav--flush" aria-label="Tab detail produk">
        {productDetailTabs.map((tab) => {
          const tabSearchParams = new URLSearchParams(detailHrefQuery);
          tabSearchParams.set("tab", tab.key);

          return (
            <Link
              aria-current={activeTab === tab.key ? "page" : undefined}
              className="tab-link"
              data-active={activeTab === tab.key ? "true" : undefined}
              href={`${detailHrefPathname || "/products"}?${tabSearchParams.toString()}`}
              key={tab.key}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Suspense fallback={<ProductDetailTabLoadingState activeTab={activeTab} />}>
        <ProductDetailTabContent activeTab={activeTab} productId={productId} />
      </Suspense>
    </div>
  );
}
