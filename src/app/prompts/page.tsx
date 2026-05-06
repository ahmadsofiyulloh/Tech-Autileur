import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, Edit3, FileText, Package, Plus } from "lucide-react";
import { savePromptPack } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { getDefaultAffiliateProfileForWorkspace, listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { listDriveItems } from "@/lib/server/drive-items";
import { listIntakeSessions } from "@/lib/server/intake";
import { listProductImages, listProducts } from "@/lib/server/products";
import { listPromptPacks } from "@/lib/server/prompt-packs";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    intake_id?: string | string[];
    product_id?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function ruleLines(value: string | null | undefined) {
  return typeof value === "string"
    ? value
        .split(/\r?\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
}

function isAffiliateProfilePromptReady(profile: AffiliateProfileRecord | null) {
  if (!profile || profile.status !== "ACTIVE") {
    return false;
  }

  const rulesReady =
    ruleLines(profile.i2i_prompt_rules).length > 0 &&
    ruleLines(profile.i2v_prompt_rules).length > 0 &&
    ruleLines(profile.caption_rules).length > 0 &&
    ruleLines(profile.hashtag_rules).length > 0 &&
    ruleLines(profile.negative_prompt_rules).length > 0 &&
    ruleLines(profile.product_positioning_notes).length > 0;

  const characterReady =
    !profile.lock_seed_character || (Boolean(profile.seed_character_drive_item_ref_id) && Boolean(profile.seed_character_analysis_json));
  const environmentReady =
    !profile.lock_environment || (Boolean(profile.environment_drive_item_ref_id) && Boolean(profile.environment_analysis_json));

  return rulesReady && characterReady && environmentReady && profile.workspace_ids.length > 0;
}

function PromptPackCreateForm({
  product,
  intakeSession,
  affiliateProfile,
  sourceImage,
}: {
  product: ProductRecord;
  intakeSession: IntakeSessionRecord | null;
  affiliateProfile: AffiliateProfileRecord | null;
  sourceImage: ProductImageRecord | null;
}) {
  const canCreate = Boolean(
    (intakeSession?.reviewed_metadata_json || intakeSession?.status === "REVIEWED") &&
      sourceImage?.drive_item_ref_id &&
      isAffiliateProfilePromptReady(affiliateProfile),
  );

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
        activityDescription="Menunggu Gemini membuat paket prompt."
        activityKind="prompt-create"
        activityTitle="Membuat paket prompt"
        className="button compact primary"
        estimatedDurationMs={20000}
        pendingLabel="Membuat"
        disabled={!canCreate}
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
}) {
  const statusLabel = promptPack ? promptPack.status : intakeSession?.status ?? "DRAFT";
  const affiliateProfileName = affiliateProfile?.profile_name ?? defaultAffiliateProfileName;
  const sourceImageLabel = sourceImageDriveItem?.name ?? sourceImage?.id ?? "Foto belum ada";

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

      <div
        className={`prompt-list-card__actions desktop-action-set action-rail action-rail--${promptPack ? "triple" : intakeSession ? "pair" : "single"}`.trim()}
      >
        {promptPack ? (
          <>
            <Link className="button compact primary" href={`/prompts/${promptPack.id}`}>
              <Edit3 size={15} aria-hidden="true" />
              Buka
            </Link>
            <Link className="button compact tertiary" href={`/prompts/${promptPack.id}/history`}>
              <Clock3 size={15} aria-hidden="true" />
              History
            </Link>
            <form action={savePromptPack}>
              <input type="hidden" name="intent" value="archive" />
              <input type="hidden" name="return_to" value="/prompts" />
              <input type="hidden" name="id" value={promptPack.id} />
              <input type="hidden" name="product_id" value={promptPack.product_id} />
              <DeleteActionButton confirmMessage={`Hapus prompt untuk "${product.product_name}"?`} variant="iconOnly" />
            </form>
          </>
        ) : (
          <>
            <Link className="button compact tertiary" href={`/products/${product.id}?tab=metadata`}>
              Produk
            </Link>
            {intakeSession ? (
              <PromptPackCreateForm
                affiliateProfile={affiliateProfile}
                intakeSession={intakeSession}
                product={product}
                sourceImage={sourceImage}
              />
            ) : null}
          </>
        )}
      </div>

      <div className="mobile-card-actions prompt-list-card__mobile-actions">
        {promptPack ? (
          <>
            <Link className="button compact primary" href={`/prompts/${promptPack.id}`}>
              <Edit3 size={15} aria-hidden="true" />
              Buka
            </Link>
            <OverflowActionMenu>
              <Link className="button compact" href={`/prompts/${promptPack.id}/history`}>
                <Clock3 size={15} aria-hidden="true" />
                History
              </Link>
              <form action={savePromptPack}>
                <input type="hidden" name="intent" value="archive" />
                <input type="hidden" name="return_to" value="/prompts" />
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
                sourceImage={sourceImage}
              />
            ) : (
              <Link className="button compact primary" href={`/products/${product.id}?tab=metadata`}>
                Produk
              </Link>
            )}
            {intakeSession ? (
              <OverflowActionMenu>
                <Link className="button compact" href={`/products/${product.id}?tab=metadata`}>
                  Produk
                </Link>
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
  const selectedProductId =
    (requestedProductId && productMap.has(requestedProductId) ? requestedProductId : null) ??
    (requestedIntakeId && intakeSessions.find((session) => session.id === requestedIntakeId)?.product_id) ??
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
    <div className="stack prompt-page-stack">
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

              return (
                <PromptRowCard
                  affiliateProfile={affiliateProfile}
                  defaultAffiliateProfileName={currentAffiliateProfileLabel}
                  generationTask={generationTask}
                  intakeSession={intakeSession}
                  isSelected={selectedProductId === product.id}
                  key={product.id}
                  promptPack={promptPack}
                  product={product}
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
              <Link className="button primary" href="/products/new">
                <Plus size={16} aria-hidden="true" />
                Produk Baru
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
