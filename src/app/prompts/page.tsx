import { redirect } from "next/navigation";
import { Clock3, Edit3, FileText, Package, Plus } from "lucide-react";
import { savePromptPack } from "./actions";
import { OperatorDetailDrawer } from "@/components/operator/detail-drawer";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { PromptLaunchReadinessSummary } from "@/components/operator/prompt-launch-readiness-summary";
import { StatusBadge } from "@/components/operator/status-badge";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { NativeLinkButton } from "@/components/ui/native-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { getDefaultAffiliateProfileForWorkspace, listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { listDriveItems } from "@/lib/server/drive-items";
import { listIntakeSessions } from "@/lib/server/intake";
import { listProductImages, listProducts } from "@/lib/server/products";
import { listPromptPacks } from "@/lib/server/prompt-packs";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
import { getPromptLaunchReadiness, type PromptLaunchReadiness } from "@/lib/prompts/prompt-launch-readiness";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PromptDetailPanel } from "./prompt-detail-panel";

export const dynamic = "force-dynamic";

type PromptPackRecord = Awaited<ReturnType<typeof listPromptPacks>>[number];
type ProductRecord = Awaited<ReturnType<typeof listProducts>>[number];
type IntakeSessionRecord = Awaited<ReturnType<typeof listIntakeSessions>>[number];
type ProductImageRecord = Awaited<ReturnType<typeof listProductImages>>[number];
type DriveItemRecord = Awaited<ReturnType<typeof listDriveItems>>[number];
type AffiliateProfileRecord = Awaited<ReturnType<typeof listAffiliateProfiles>>[number];
type PromptTaskRecord = {
  id: string;
  status: string;
  error_message: string | null;
};

type PromptsPageProps = {
  searchParams: Promise<{
    affiliate_profile_id?: string | string[];
    detail?: string | string[];
    intake_id?: string | string[];
    product_id?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildPromptsHref(params: {
  affiliateProfileId?: string | null;
  detailId?: string | null;
  intakeId?: string | null;
  productId?: string | null;
}) {
  const searchParams = new URLSearchParams();

  if (params.affiliateProfileId) {
    searchParams.set("affiliate_profile_id", params.affiliateProfileId);
  }

  if (params.productId) {
    searchParams.set("product_id", params.productId);
  }

  if (params.intakeId) {
    searchParams.set("intake_id", params.intakeId);
  }

  if (params.detailId) {
    searchParams.set("detail", params.detailId);
  }

  const queryString = searchParams.toString();
  return queryString ? `/prompts?${queryString}` : "/prompts";
}

function PromptPackCreateForm({
  product,
  intakeSession,
  affiliateProfile,
  sourceImage,
  readiness,
}: {
  product: ProductRecord;
  intakeSession: IntakeSessionRecord | null;
  affiliateProfile: AffiliateProfileRecord | null;
  sourceImage: ProductImageRecord | null;
  readiness: PromptLaunchReadiness;
}) {
  const readinessId = `prompt-launch-readiness-${product.id}`;

  return (
    <form className="prompt-list-card__action-form" action={savePromptPack}>
      <input type="hidden" name="intent" value="create_generate" />
      <input type="hidden" name="status" value="DRAFT" />
      <input type="hidden" name="version" value={1} />
      <input type="hidden" name="product_id" value={product.id} />
      <input type="hidden" name="intake_session_id" value={intakeSession?.id ?? ""} />
      <input type="hidden" name="affiliate_profile_id" value={affiliateProfile?.id ?? ""} />
      <input type="hidden" name="source_product_image_id" value={sourceImage?.id ?? ""} />
      <PendingActionButton
        className="compact primary"
        aria-describedby={!readiness.ready ? readinessId : undefined}
        pendingLabel="Membuat"
        disabled={!readiness.ready}
      >
        Buat Prompt
      </PendingActionButton>
    </form>
  );
}

function PromptRowCard({
  product,
  workspaceName,
  promptPack,
  intakeSession,
  affiliateProfile,
  sourceImage,
  sourceImageDriveItem,
  generationTask,
  defaultAffiliateProfileName,
  isSelected,
  productDetailHref,
  promptDetailHref,
  returnHref,
}: {
  product: ProductRecord;
  workspaceName: string;
  promptPack: PromptPackRecord | null;
  intakeSession: IntakeSessionRecord | null;
  affiliateProfile: AffiliateProfileRecord | null;
  sourceImage: ProductImageRecord | null;
  sourceImageDriveItem: DriveItemRecord | null;
  generationTask: PromptTaskRecord | null;
  defaultAffiliateProfileName: string;
  isSelected: boolean;
  productDetailHref: string;
  promptDetailHref: string | null;
  returnHref: string;
}) {
  const statusLabel = promptPack ? promptPack.status : intakeSession?.status ?? "DRAFT";
  const affiliateProfileName = affiliateProfile?.profile_name ?? defaultAffiliateProfileName;
  const sourceImageLabel = sourceImageDriveItem?.name ?? sourceImage?.id ?? "Foto belum ada";
  const promptLaunchReadiness = getPromptLaunchReadiness({
    productId: product.id,
    intakeSessionId: intakeSession?.id ?? null,
    affiliateProfileId: affiliateProfile?.id ?? null,
    hasReviewedMetadata: Boolean(intakeSession?.reviewed_metadata_json || intakeSession?.status === "REVIEWED"),
    sourceImageDriveItemRefId: sourceImage?.drive_item_ref_id ?? null,
    affiliateProfile,
  });
  const readinessId = `prompt-launch-readiness-${product.id}`;

  return (
    <article className="prompt-list-card stack" data-open={isSelected ? "true" : undefined}>
      <div className="prompt-list-card__header">
        <div className="prompt-list-card__copy">
          <span>{promptPack ? `Paket Prompt v${promptPack.version}` : "Paket Prompt"}</span>
          <strong title={product.product_name}>{product.product_name}</strong>
          <small>{`Akun: ${affiliateProfileName}`}</small>
        </div>
        <StatusBadge status={statusLabel} />
      </div>

      <div className="prompt-list-card__meta-row">
        <span>{workspaceName}</span>
        <span>{sourceImageLabel}</span>
        {generationTask ? <StatusBadge status={generationTask.status} /> : null}
        {!promptPack && !intakeSession ? <StatusBadge status="Review Gemini dulu" tone="warning" /> : null}
      </div>

      <div className="prompt-list-card__divider" aria-hidden="true" />

      <div className="prompt-list-card__actions prompt-list-card__desktop-actions desktop-action-set">
        {promptPack ? (
          <>
            <NativeLinkButton className="compact primary" href={promptDetailHref ?? `/prompts/${promptPack.id}`}>
              <Edit3 size={15} aria-hidden="true" />
              Buka
            </NativeLinkButton>
            <OverflowActionMenu label="Aksi prompt">
              <NativeLinkButton className="compact" href={`/prompts/${promptPack.id}/history`}>
                <Clock3 size={15} aria-hidden="true" />
                History
              </NativeLinkButton>
              <form action={savePromptPack}>
                <input type="hidden" name="intent" value="archive" />
                <input type="hidden" name="return_to" value={returnHref} />
                <input type="hidden" name="id" value={promptPack.id} />
                <input type="hidden" name="product_id" value={promptPack.product_id} />
                <DeleteActionButton confirmMessage={`Hapus prompt untuk "${product.product_name}"?`} />
              </form>
            </OverflowActionMenu>
          </>
        ) : (
          <>
            {intakeSession ? (
              <>
                <PromptPackCreateForm
                  affiliateProfile={affiliateProfile}
                  intakeSession={intakeSession}
                  product={product}
                  readiness={promptLaunchReadiness}
                  sourceImage={sourceImage}
                />
                <OverflowActionMenu label="Aksi prompt">
                  <NativeLinkButton className="compact" href={productDetailHref}>
                    Produk
                  </NativeLinkButton>
                </OverflowActionMenu>
              </>
            ) : (
              <NativeLinkButton className="compact primary" href={productDetailHref}>
                Produk
              </NativeLinkButton>
            )}
          </>
        )}
      </div>
      {!promptPack && intakeSession && !promptLaunchReadiness.ready ? (
        <PromptLaunchReadinessSummary id={readinessId} readiness={promptLaunchReadiness} />
      ) : null}

      <div className="mobile-card-actions prompt-list-card__mobile-actions">
        {promptPack ? (
          <>
            <NativeLinkButton className="compact primary" href={promptDetailHref ?? `/prompts/${promptPack.id}`}>
              <Edit3 size={15} aria-hidden="true" />
              Buka
            </NativeLinkButton>
            <OverflowActionMenu>
              <NativeLinkButton className="compact" href={`/prompts/${promptPack.id}/history`}>
                <Clock3 size={15} aria-hidden="true" />
                History
              </NativeLinkButton>
              <form action={savePromptPack}>
                <input type="hidden" name="intent" value="archive" />
                <input type="hidden" name="return_to" value={returnHref} />
                <input type="hidden" name="id" value={promptPack.id} />
                <input type="hidden" name="product_id" value={promptPack.product_id} />
                <DeleteActionButton confirmMessage={`Hapus prompt untuk "${product.product_name}"?`} />
              </form>
            </OverflowActionMenu>
          </>
        ) : (
          <>
            {intakeSession ? (
              <PromptPackCreateForm
                affiliateProfile={affiliateProfile}
                intakeSession={intakeSession}
                product={product}
                readiness={promptLaunchReadiness}
                sourceImage={sourceImage}
              />
            ) : (
              <NativeLinkButton className="compact primary" href={productDetailHref}>
                Produk
              </NativeLinkButton>
            )}
            {intakeSession ? (
              <OverflowActionMenu>
                <NativeLinkButton className="compact" href={productDetailHref}>
                  Produk
                </NativeLinkButton>
              </OverflowActionMenu>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

export default async function PromptsPage({ searchParams }: PromptsPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const query = await searchParams;
  const requestedAffiliateProfileId = firstParam(query.affiliate_profile_id);
  const selectedPromptDetailId = firstParam(query.detail) ?? "";
  const requestedProductId = firstParam(query.product_id);
  const requestedIntakeId = firstParam(query.intake_id);
  const currentWorkspace = await getCurrentWorkspace();
  const workspaceId = currentWorkspace?.id ?? undefined;

  let promptPacks: PromptPackRecord[] = [];
  let products: ProductRecord[] = [];
  let productImages: ProductImageRecord[] = [];
  let driveItems: DriveItemRecord[] = [];
  let intakeSessions: IntakeSessionRecord[] = [];
  let affiliateProfiles: Awaited<ReturnType<typeof listAffiliateProfiles>> = [];

  try {
    [promptPacks, products, productImages, driveItems, intakeSessions, affiliateProfiles] = await Promise.all([
      listPromptPacks({ workspaceId, limit: 200 }),
      listProducts({ workspaceId, limit: 200 }),
      listProductImages({ limit: 200 }),
      listDriveItems({ limit: 200 }),
      listIntakeSessions({ workspaceId, limit: 200 }),
      listAffiliateProfiles({ workspaceId, status: "ACTIVE", limit: 200 }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prompt tidak tersedia.";

    return (
      <SectionCard icon={FileText} title="Paket Prompt tidak tersedia." description={message}>
        <EmptyState icon={FileText} title="Prompt tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  const visibleProducts = products.filter((product) => product.status !== "ARCHIVED");
  const visiblePromptPacks = promptPacks.filter((pack) => pack.status !== "ARCHIVED");
  const visibleDriveItems = driveItems.filter((item) => item.status !== "ARCHIVED");
  const productMap = new Map(visibleProducts.map((product) => [product.id, product]));
  const driveItemMap = new Map(visibleDriveItems.map((item) => [item.id, item]));
  const affiliateProfileMap = new Map(affiliateProfiles.map((profile) => [profile.id, profile]));
  const requestedAffiliateProfile =
    requestedAffiliateProfileId && affiliateProfileMap.has(requestedAffiliateProfileId)
      ? affiliateProfileMap.get(requestedAffiliateProfileId) ?? null
      : null;
  const latestPromptPackByProductId = new Map<string, PromptPackRecord>();
  const latestReviewedIntakeByProductId = new Map<string, IntakeSessionRecord>();

  for (const pack of visiblePromptPacks) {
    if (!latestPromptPackByProductId.has(pack.product_id)) {
      latestPromptPackByProductId.set(pack.product_id, pack);
    }
  }

  for (const session of intakeSessions) {
    if (!session.product_id || latestReviewedIntakeByProductId.has(session.product_id)) {
      continue;
    }

    if (!session.reviewed_metadata_json && session.status !== "REVIEWED") {
      continue;
    }

    latestReviewedIntakeByProductId.set(session.product_id, session);
  }

  const currentAffiliateProfile = await getDefaultAffiliateProfileForWorkspace(workspaceId ?? null);
  const currentAffiliateProfileLabel = currentAffiliateProfile?.profile_name ?? "Belum ada profile aktif";
  const currentWorkspaceLabel = currentWorkspace?.workspace_name ?? "Workspace aktif";
  const selectedPromptPack = visiblePromptPacks.find((pack) => pack.id === selectedPromptDetailId) ?? null;
  const selectedProductId =
    (requestedProductId && productMap.has(requestedProductId) ? requestedProductId : null) ??
    (requestedIntakeId && intakeSessions.find((session) => session.id === requestedIntakeId)?.product_id) ??
    selectedPromptPack?.product_id ??
    "";
  const promptTaskIds = Array.from(
    new Set(visiblePromptPacks.map((pack) => pack.ai_task_id).filter((value): value is string => Boolean(value))),
  );
  const promptTaskResult = promptTaskIds.length
    ? await supabase.from("ai_tasks").select("id, status, error_message").eq("user_id", user.id).in("id", promptTaskIds)
    : { data: [], error: null };

  if (promptTaskResult.error) {
    return (
      <SectionCard icon={FileText} title="Task tidak tersedia." description={promptTaskResult.error.message}>
        <EmptyState icon={FileText} title="Task tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  const promptTaskMap = new Map((promptTaskResult.data ?? []).map((task) => [task.id, task as PromptTaskRecord]));
  const promptsCloseHref = buildPromptsHref({
    affiliateProfileId: requestedAffiliateProfileId,
    intakeId: requestedIntakeId,
    productId: requestedProductId,
  });
  const promptDetailHref = selectedPromptDetailId
    ? buildPromptsHref({
        affiliateProfileId: requestedAffiliateProfileId,
        detailId: selectedPromptDetailId,
        intakeId: requestedIntakeId,
        productId: requestedProductId,
      })
    : promptsCloseHref;
  const selectedPromptProduct = selectedPromptPack ? productMap.get(selectedPromptPack.product_id) ?? null : null;
  const selectedPromptTask = selectedPromptPack?.ai_task_id ? promptTaskMap.get(selectedPromptPack.ai_task_id) ?? null : null;
  const hasPromptDetail = Boolean(selectedPromptPack);
  const promptDetailSubtitle = selectedPromptPack
    ? [`v${selectedPromptPack.version}`, selectedPromptPack.status, selectedPromptTask?.status ?? "Task belum ada"].join(" - ")
    : null;
  const orderedProducts = [...visibleProducts].sort((left, right) => {
    if (selectedProductId) {
      if (left.id === selectedProductId) {
        return -1;
      }

      if (right.id === selectedProductId) {
        return 1;
      }
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });

  return (
    <div className="operator-detail-layout" data-has-detail={hasPromptDetail ? "true" : undefined}>
      <div className="operator-detail-layout__list stack prompt-page-stack">
        <div className="settings-inline-summary prompt-inline-summary">
          <span>{visibleProducts.length} produk</span>
          <StatusBadge status={currentAffiliateProfileLabel} tone={currentAffiliateProfile ? "success" : "warning"} />
        </div>

        <section className="stack" aria-label="Paket Prompt">
          {orderedProducts.length ? (
            <section className="stack prompt-list-stack">
              {orderedProducts.map((product) => {
              const promptPack = latestPromptPackByProductId.get(product.id) ?? null;
              const intakeSession = latestReviewedIntakeByProductId.get(product.id) ?? null;
              const affiliateProfile = promptPack?.affiliate_profile_id
                ? affiliateProfileMap.get(promptPack.affiliate_profile_id) ?? null
                : requestedAffiliateProfile ?? currentAffiliateProfile;
              const sourceImage =
                promptPack?.source_product_image_id
                  ? productImages.find((image) => image.id === promptPack.source_product_image_id) ?? null
                  : productImages.find((image) => image.product_id === product.id && image.is_primary) ??
                    productImages.find((image) => image.product_id === product.id) ??
                    null;
              const sourceImageDriveItem = sourceImage ? driveItemMap.get(sourceImage.drive_item_ref_id) ?? null : null;
              const generationTask = promptPack?.ai_task_id ? promptTaskMap.get(promptPack.ai_task_id) ?? null : null;
              const rowPromptDetailHref = promptPack
                ? buildPromptsHref({
                    affiliateProfileId: requestedAffiliateProfileId,
                    detailId: promptPack.id,
                    intakeId: requestedIntakeId,
                    productId: requestedProductId,
                  })
                : null;
              const productDetailSearchParams = new URLSearchParams({ detail: product.id, tab: "metadata" });

              if (requestedAffiliateProfileId) {
                productDetailSearchParams.set("affiliate_profile_id", requestedAffiliateProfileId);
              }

              const productDetailHref = `/products?${productDetailSearchParams.toString()}`;

                return (
                  <PromptRowCard
                    affiliateProfile={affiliateProfile}
                    defaultAffiliateProfileName={currentAffiliateProfileLabel}
                    generationTask={generationTask}
                    intakeSession={intakeSession}
                    isSelected={selectedProductId === product.id || selectedPromptDetailId === promptPack?.id}
                    key={product.id}
                    productDetailHref={productDetailHref}
                    promptDetailHref={rowPromptDetailHref}
                    promptPack={promptPack}
                    product={product}
                    returnHref={promptsCloseHref}
                    sourceImage={sourceImage}
                    sourceImageDriveItem={sourceImageDriveItem}
                    workspaceName={currentWorkspaceLabel}
                  />
                );
              })}
            </section>
          ) : (
            <EmptyState
              icon={Package}
              title="Produk belum ada."
              description="Buat produk dulu."
              action={
                <NativeLinkButton className="primary" href="/products/new">
                  <Plus size={16} aria-hidden="true" />
                  Produk Baru
                </NativeLinkButton>
              }
            />
          )}
        </section>
      </div>

      {selectedPromptPack ? (
        <OperatorDetailDrawer
          ariaLabel="Detail prompt"
          closeHref={promptsCloseHref}
          subtitle={promptDetailSubtitle}
          title={selectedPromptProduct?.product_name ?? "Detail prompt"}
        >
          <PromptDetailPanel detailHref={promptDetailHref} promptPackId={selectedPromptPack.id} />
        </OperatorDetailDrawer>
      ) : null}
    </div>
  );
}
