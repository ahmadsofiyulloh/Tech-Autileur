import { redirect } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { NativeLinkButton } from "@/components/ui/native-button";
import { listClipJobs, type ClipJobRecord } from "@/lib/server/clip-jobs";
import { listContents, type ContentRecord } from "@/lib/server/contents";
import { listDriveItems } from "@/lib/server/drive-items";
import { listIntakeSessions } from "@/lib/server/intake";
import { listProductImages, listProducts } from "@/lib/server/products";
import { listPromptPacks } from "@/lib/server/prompt-packs";
import { resolveDriveImagePreviewUrl } from "@/lib/server/drive-image-previews";
import { getCurrentWorkspace, listWorkspaces } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductList } from "./product-list";
import type { ProductListRow, ProductUploadScope, ProductWorkflowStage, ProductWorkflowStatusJson } from "./types";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{ affiliate_profile_id?: string | string[]; workspace?: string | string[] }>;
};

type PromptPackRecord = Awaited<ReturnType<typeof listPromptPacks>>[number];

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

function readWorkflowStatusJson(value: unknown): ProductWorkflowStatusJson {
  if (!isRecord(value)) {
    return {
      video_generated: false,
      uploaded_shopee: false,
      uploaded_tiktok: false,
    };
  }

  return {
    video_generated: value.video_generated === true,
    uploaded_shopee: value.uploaded_shopee === true,
    uploaded_tiktok: value.uploaded_tiktok === true,
  };
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

function hasVerifiedIntakeMetadata(session: { reviewed_metadata_json: unknown; status: string }) {
  return Boolean(session.reviewed_metadata_json) || session.status === "REVIEWED" || session.status === "ANCHOR_READY";
}

function isDraftPromptPack(status: string) {
  const normalized = status.toUpperCase();
  return normalized === "DRAFT" || normalized === "QUEUED" || normalized === "GENERATING" || normalized === "NEEDS_REVIEW" || normalized === "ERROR";
}

function buildContinueHref(params: {
  affiliateProfileId: string | null;
  latestIntake: { id: string } | null;
  latestPromptPack: { id: string; status: string } | null;
  showAllWorkspaces: boolean;
}) {
  if (params.latestPromptPack && isDraftPromptPack(params.latestPromptPack.status)) {
    return `/prompts/${params.latestPromptPack.id}`;
  }

  if (!params.latestIntake) {
    return null;
  }

  const searchParams = new URLSearchParams({
    intake_id: params.latestIntake.id,
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

function normalizeStatusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function normalizeCompactStatusLabel(value: string) {
  const normalized = value.toUpperCase();

  if (normalized === "DRAFT") {
    return "Draf";
  }

  if (normalized === "IMAGE_ATTACHED") {
    return "Foto";
  }

  if (normalized === "IMAGE_ANALYZED") {
    return "Analisis";
  }

  if (normalized === "PROMPT_READY") {
    return "Prompt";
  }

  if (normalized === "READY_FOR_UPLOAD" || normalized === "IN_PRODUCTION") {
    return "Video";
  }

  if (normalized === "UPLOADED") {
    return "Keduanya";
  }

  if (normalized === "ARCHIVED") {
    return "Arsip";
  }

  return normalizeStatusLabel(value);
}

function isCompletedPromptPack(status: string) {
  const normalized = status.toUpperCase();
  return normalized === "GENERATED" || normalized === "APPROVED";
}

function isGeneratedClipJob(clipJob: ClipJobRecord | null) {
  if (!clipJob) {
    return false;
  }

  if (clipJob.generated_drive_item_id) {
    return true;
  }

  const normalized = clipJob.status.toUpperCase();
  return normalized === "APPROVED" || normalized === "IMPORTED" || normalized === "NEEDS_REVIEW";
}

function resolveUploadScope(workflowStatus: ProductWorkflowStatusJson, productStatus: string): ProductUploadScope {
  if (workflowStatus.uploaded_shopee && workflowStatus.uploaded_tiktok) {
    return "both";
  }

  if (workflowStatus.uploaded_shopee) {
    return "shopee";
  }

  if (workflowStatus.uploaded_tiktok) {
    return "tiktok";
  }

  if (productStatus.toUpperCase() === "UPLOADED") {
    return "both";
  }

  return "none";
}

function resolveWorkflowStage(
  productStatus: string,
  hasVerifiedIntake: boolean,
  hasDraftPromptPack: boolean,
  promptReady: boolean,
  clipGenerated: boolean,
  uploadScope: ProductUploadScope,
): ProductWorkflowStage {
  const normalized = productStatus.toUpperCase();

  if (uploadScope !== "none" || normalized === "UPLOADED") {
    return "upload";
  }

  if (clipGenerated || normalized === "IN_PRODUCTION" || normalized === "READY_FOR_UPLOAD") {
    return "video";
  }

  if (promptReady || normalized === "PROMPT_READY") {
    return "prompt";
  }

  if (!hasVerifiedIntake || hasDraftPromptPack || normalized === "DRAFT") {
    return "draft";
  }

  return "analysis";
}

function resolvePrimaryStatusLabel(productStatus: string, workflowStage: ProductWorkflowStage, uploadScope: ProductUploadScope) {
  if (workflowStage === "draft") {
    return "Draf";
  }

  if (uploadScope === "both") {
    return "Keduanya";
  }

  if (uploadScope === "shopee") {
    return "Shopee";
  }

  if (uploadScope === "tiktok") {
    return "TikTok";
  }

  if (workflowStage === "video") {
    return "Video";
  }

  if (workflowStage === "prompt") {
    return "Prompt";
  }

  if (workflowStage === "analysis") {
    return "Analisis";
  }

  return normalizeCompactStatusLabel(productStatus);
}

function resolveStatusContextLabel(params: {
  hasDraftPromptPack: boolean;
  hasVerifiedIntake: boolean;
  promptReady: boolean;
  workflowStage: ProductWorkflowStage;
}) {
  if (params.workflowStage === "draft") {
    return params.hasDraftPromptPack ? "Draft" : "Verif";
  }

  if (params.workflowStage === "analysis") {
    return params.hasVerifiedIntake ? "Prompt" : "Verif";
  }

  if (params.workflowStage === "prompt") {
    return "Jadi";
  }

  if (params.workflowStage === "video") {
    return params.promptReady ? "Jadi" : "Prompt";
  }

  if (params.workflowStage === "upload") {
    return "Upload";
  }

  return null;
}

function buildSearchText(parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function stageRank(stage: ProductWorkflowStage) {
  if (stage === "draft") {
    return 5;
  }

  if (stage === "analysis") {
    return 4;
  }

  if (stage === "prompt") {
    return 3;
  }

  if (stage === "video") {
    return 2;
  }

  return 1;
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
  let promptPacks: PromptPackRecord[] = [];
  let contents: ContentRecord[] = [];
  let clipJobs: ClipJobRecord[] = [];

  try {
    [currentWorkspace, workspaces] = await Promise.all([getCurrentWorkspace(), listWorkspaces({ limit: 200 })]);
    const workspaceId = currentWorkspace && !showAllWorkspaces ? currentWorkspace.id : undefined;

    [products, intakeSessions, productImages, driveItems, promptPacks, contents, clipJobs] = await Promise.all([
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
      listPromptPacks({
        limit: 200,
        workspaceId,
      }),
      listContents({ limit: 200 }),
      listClipJobs({ limit: 200 }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load products.";

    return (
      <SectionCard icon={Package} title="Produk tidak bisa dimuat." description={message}>
        <EmptyState icon={Package} title="Produk tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  const visibleProducts = products.filter((product) => product.status !== "ARCHIVED");
  const visibleDriveItems = driveItems.filter((item) => item.status !== "ARCHIVED");
  const workspaceMap = new Map(workspaces.filter((workspace) => workspace.status !== "ARCHIVED").map((workspace) => [workspace.id, workspace]));
  const driveItemMap = new Map(visibleDriveItems.map((item) => [item.id, item]));
  const previewUrlCache = new Map<string, string | null>();
  const latestIntakeByProductId = new Map<string, (typeof intakeSessions)[number]>();
  const latestVerifiedIntakeByProductId = new Map<string, (typeof intakeSessions)[number]>();
  const latestPromptPackByProductId = new Map<string, PromptPackRecord>();
  const latestContentByProductId = new Map<string, ContentRecord[]>();
  const latestGeneratedClipJobByProductId = new Map<string, ClipJobRecord>();
  const contentProductMap = new Map<string, string>();

  for (const session of intakeSessions) {
    if (!session.product_id) {
      continue;
    }

    if (!latestIntakeByProductId.has(session.product_id)) {
      latestIntakeByProductId.set(session.product_id, session);
    }

    if (hasVerifiedIntakeMetadata(session) && !latestVerifiedIntakeByProductId.has(session.product_id)) {
      latestVerifiedIntakeByProductId.set(session.product_id, session);
    }
  }

  for (const promptPack of promptPacks) {
    if (!latestPromptPackByProductId.has(promptPack.product_id)) {
      latestPromptPackByProductId.set(promptPack.product_id, promptPack);
    }
  }

  for (const content of contents) {
    contentProductMap.set(content.id, content.product_id);
    const productContents = latestContentByProductId.get(content.product_id) ?? [];
    productContents.push(content);

    if (!latestContentByProductId.has(content.product_id)) {
      latestContentByProductId.set(content.product_id, productContents);
    }
  }

  for (const clipJob of clipJobs) {
    const productId = contentProductMap.get(clipJob.content_id);

    if (!productId || latestGeneratedClipJobByProductId.has(productId) || !isGeneratedClipJob(clipJob)) {
      continue;
    }

    latestGeneratedClipJobByProductId.set(productId, clipJob);
  }

  const productRows: ProductListRow[] = visibleProducts.map((product) => {
    const latestIntake = latestIntakeByProductId.get(product.id) ?? null;
    const latestVerifiedIntake = latestVerifiedIntakeByProductId.get(product.id) ?? null;
    const latestPromptPack = latestPromptPackByProductId.get(product.id) ?? null;
    const latestGeneratedClipJob = latestGeneratedClipJobByProductId.get(product.id) ?? null;
    const productWorkflowStatus = readWorkflowStatusJson(product.workflow_status_json);
    const promptReady = Boolean(latestPromptPack && isCompletedPromptPack(latestPromptPack.status));
    const hasDraftPromptPack = Boolean(latestPromptPack && isDraftPromptPack(latestPromptPack.status));
    const hasVerifiedIntake = Boolean(latestVerifiedIntake);
    const clipGenerated = Boolean(productWorkflowStatus.video_generated || latestGeneratedClipJob);
    const uploadScope = resolveUploadScope(productWorkflowStatus, product.status);
    const workflowStage = resolveWorkflowStage(product.status, hasVerifiedIntake, hasDraftPromptPack, promptReady, clipGenerated, uploadScope);
    const continueHref =
      workflowStage === "draft"
        ? buildContinueHref({
            affiliateProfileId: requestedAffiliateProfileId,
            latestIntake: hasDraftPromptPack ? null : latestIntake,
            latestPromptPack,
            showAllWorkspaces,
          })
        : null;
    const primaryStatusLabel = resolvePrimaryStatusLabel(product.status, workflowStage, uploadScope);
    const statusContextLabel = resolveStatusContextLabel({
      hasDraftPromptPack,
      hasVerifiedIntake,
      promptReady,
      workflowStage,
    });
    const keyword =
      metadataText(
        latestVerifiedIntake?.reviewed_metadata_json ?? latestIntake?.parsed_metadata_json ?? latestIntake?.reviewed_metadata_json ?? null,
        "keyword_cari_etalase",
        "category",
      ) || fieldValue(product.niche);
    const primaryImage =
      productImages.find((image) => image.product_id === product.id && image.is_primary) ??
      productImages.find((image) => image.product_id === product.id) ??
      null;
    const primaryDriveItem = primaryImage ? driveItemMap.get(primaryImage.drive_item_ref_id) ?? null : null;
    const thumbnailUrl = resolveDriveImagePreviewUrl(primaryDriveItem, previewUrlCache);
    const contentSummary = (latestContentByProductId.get(product.id) ?? []).map((content) =>
      [content.content_code, content.platform, content.status, content.hook_type].filter(Boolean).join(" "),
    );
    const searchText = buildSearchText([
      product.product_code,
      product.product_name,
      product.niche,
      product.marketplace,
      product.marketplace_product_link,
      workspaceLabel(product.workspace_id, workspaceMap),
      keyword,
      product.status,
      primaryStatusLabel,
      statusContextLabel,
      workflowStage,
      latestPromptPack?.status,
      latestPromptPack?.prompt_code,
      latestGeneratedClipJob?.status,
      latestGeneratedClipJob?.clip_code,
      uploadScope,
      ...contentSummary,
    ]);

    return {
      id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      niche: product.niche,
      workspace_label: workspaceLabel(product.workspace_id, workspaceMap),
      marketplace: product.marketplace,
      marketplace_product_link: product.marketplace_product_link,
      keyword,
      product_status: product.status,
      intake_status: latestIntake?.status ?? "",
      created_at: product.created_at,
      created_at_label: formatDate(product.created_at),
      thumbnail_url: thumbnailUrl,
      href: `/products/${product.id}`,
      continue_href: continueHref,
      primary_status_label: primaryStatusLabel,
      status_context_label: statusContextLabel,
      workflow_stage: workflowStage,
      upload_scope: uploadScope,
      workflow_status_json: productWorkflowStatus,
      search_text: searchText,
    };
  });

  productRows.sort((left, right) => {
    const stageDiff = stageRank(right.workflow_stage) - stageRank(left.workflow_stage);

    if (stageDiff !== 0) {
      return stageDiff;
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });

  return (
    <div className="stack">
      {visibleProducts.length ? (
        <ProductList products={productRows} />
      ) : (
        <EmptyState
          icon={Package}
          title={currentWorkspace && !showAllWorkspaces ? "Belum ada produk di workspace ini." : "Belum ada produk."}
          description="Mulai dari intake."
          action={
            <NativeLinkButton className="primary" href="/products/new">
              <Plus size={16} aria-hidden="true" />
              Intake baru
            </NativeLinkButton>
          }
        />
      )}
    </div>
  );
}
