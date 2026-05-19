import Link from "next/link";
import { Clock3, ExternalLink, FileText, Package } from "lucide-react";
import { CopyableReadOnlyField } from "@/components/operator/copyable-readonly-field";
import { EmptyState } from "@/components/operator/empty-state";
import { ErrorState } from "@/components/operator/error-state";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeAnchorButton, NativeLinkButton } from "@/components/ui/native-button";
import { ProductOutputFields } from "./product-output-fields";
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

export async function ProductDetailPanel({ activeTab, detailHrefBase, productId }: ProductDetailPanelProps) {
  const id = productId;
  let product: ProductRecord | null = null;
  let productImages: ProductImageRecord[] = [];
  let driveItems: DriveItemRecord[] = [];
  let intakeSessions: IntakeSessionRecord[] = [];
  let marketplaceSources: MarketplaceSourceRecord[] = [];
  let anchors: ProductAnchorRecord[] = [];
  let promptPacks: PromptPackRecord[] = [];
  let flowBatches: FlowBatchRecord[] = [];
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
      flowBatches,
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
      listFlowBatches({ productId: id, limit: 200 }),
      listAffiliateProfiles({ limit: 200 }),
      listContents({ productId: id, limit: 200 }),
      listClipJobs({ limit: 200 }),
      listGeneratedFiles({ limit: 200 }),
    ]);
  } catch {
    return (
      <div className="stack">
        <ErrorState icon={Package} title="Detail produk tidak bisa dimuat." description="Coba lagi." />
      </div>
    );
  }

  if (!product || product.status === "ARCHIVED") {
    return (
      <SectionCard icon={Package} title="Produk tidak tersedia.">
        <EmptyState icon={Package} title="Produk tidak tersedia." description="Data ini mungkin sudah dihapus atau tidak tersedia di workspace aktif." />
      </SectionCard>
    );
  }

  const visibleDriveItems = driveItems.filter((item) => item.status !== "ARCHIVED");
  const visiblePromptPacks = promptPacks.filter((pack) => pack.status !== "ARCHIVED");
  const visibleAffiliateProfiles = affiliateProfiles.filter((profile) => profile.status !== "ARCHIVED");
  const productWorkspaceId = product.workspace_id;
  const scopedAffiliateProfiles = productWorkspaceId
    ? visibleAffiliateProfiles.filter((profile) => profile.workspace_ids.includes(productWorkspaceId))
    : visibleAffiliateProfiles;
  const affiliateProfileMap = new Map(scopedAffiliateProfiles.map((profile) => [profile.id, profile]));
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
  const shopeeOcrEvidence =
    readMetadataOcrEvidence(reviewedMetadata, "shopee_screenshot") ?? readMarketplaceSourceOcrEvidence(marketplaceSources, "SHOPEE");
  const tiktokOcrEvidence =
    readMetadataOcrEvidence(reviewedMetadata, "tiktok_screenshot") ?? readMarketplaceSourceOcrEvidence(marketplaceSources, "TIKTOK");
  const hasMetadataOcrEvidence = Boolean(shopeeOcrEvidence || tiktokOcrEvidence);
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

  const relevantGeneratedFiles = generatedFiles.filter((generatedFile) => generatedFile.clip_job_id && clipJobMap.has(generatedFile.clip_job_id));

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
    <div className="stack operator-detail-panel">
      <nav className="tab-nav tab-nav--flush" aria-label="Tab detail produk">
        {productDetailTabs.map((tab) => {
          const tabSearchParams = new URLSearchParams(detailHrefBase.split("?")[1] ?? "");
          const pathname = detailHrefBase.split("?")[0] || "/products";
          tabSearchParams.set("tab", tab.key);

          return (
            <Link
              aria-current={activeTab === tab.key ? "page" : undefined}
              className="tab-link"
              data-active={activeTab === tab.key ? "true" : undefined}
              href={`${pathname}?${tabSearchParams.toString()}`}
              key={tab.key}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {activeTab === "output" ? (
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
      ) : null}

      {activeTab === "metadata" ? (
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
      ) : null}

      {activeTab === "history" ? (
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

          <SectionCard icon={FileText} title="Versi Paket Prompt">
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
      ) : null}
    </div>
  );
}
