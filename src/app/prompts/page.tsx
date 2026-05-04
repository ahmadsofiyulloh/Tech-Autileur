import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, ArrowRight, Edit3, FileText, Package, Plus, Play, RefreshCcw, Save } from "lucide-react";
import { savePromptPack } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { getDefaultAffiliateProfileForWorkspace, listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { listIntakeSessions } from "@/lib/server/intake";
import { listDriveItems } from "@/lib/server/drive-items";
import { listProductImages, listProducts } from "@/lib/server/products";
import { listPromptPacks } from "@/lib/server/prompt-packs";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readPromptPackEditorPromptSet } from "@/lib/prompts/prompt-pack-contract";
import {
  PROMPT_CLIP_KEYS,
  PROMPT_CLIP_LABELS,
  PROMPT_TARGET_MARKETPLACE,
  type PromptClipKey,
} from "@/lib/prompts/validation";

export const dynamic = "force-dynamic";

type PromptPackRecord = Awaited<ReturnType<typeof listPromptPacks>>[number];
type ProductRecord = Awaited<ReturnType<typeof listProducts>>[number];
type IntakeSessionRecord = Awaited<ReturnType<typeof listIntakeSessions>>[number];
type ProductImageRecord = Awaited<ReturnType<typeof listProductImages>>[number];
type DriveItemRecord = Awaited<ReturnType<typeof listDriveItems>>[number];
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

function promptEditorHref(params: { affiliateProfileId?: string | null; intakeId?: string | null; productId: string }) {
  const searchParams = new URLSearchParams({ product_id: params.productId });

  if (params.intakeId) {
    searchParams.set("intake_id", params.intakeId);
  }

  if (params.affiliateProfileId) {
    searchParams.set("affiliate_profile_id", params.affiliateProfileId);
  }

  return `/prompts?${searchParams.toString()}`;
}

function clipFieldName(clipKey: PromptClipKey, field: "i2i_first_frame" | "i2i_last_frame" | "i2v_prompt") {
  return `${clipKey}_${field}`;
}

function PromptClipFields({
  clipKey,
  idPrefix,
  values,
}: {
  clipKey: PromptClipKey;
  idPrefix: string;
  values: {
    i2i_first_frame: string;
    i2i_last_frame: string;
    i2v_prompt: string;
  };
}) {
  return (
    <div className="muted-box stack">
      <div className="section-card__actions">
        <strong>{PROMPT_CLIP_LABELS[clipKey]}</strong>
      </div>
      <label className="stack auth-field" htmlFor={`${idPrefix}-${clipKey}-first-frame`}>
        <span>I2I First Frame</span>
        <textarea
          id={`${idPrefix}-${clipKey}-first-frame`}
          name={clipFieldName(clipKey, "i2i_first_frame")}
          rows={4}
          defaultValue={values.i2i_first_frame}
        />
      </label>
      <label className="stack auth-field" htmlFor={`${idPrefix}-${clipKey}-last-frame`}>
        <span>I2I Last Frame</span>
        <textarea
          id={`${idPrefix}-${clipKey}-last-frame`}
          name={clipFieldName(clipKey, "i2i_last_frame")}
          rows={4}
          defaultValue={values.i2i_last_frame}
        />
      </label>
      <label className="stack auth-field" htmlFor={`${idPrefix}-${clipKey}-i2v`}>
        <span>I2V Prompt</span>
        <textarea
          id={`${idPrefix}-${clipKey}-i2v`}
          name={clipFieldName(clipKey, "i2v_prompt")}
          rows={5}
          defaultValue={values.i2v_prompt}
        />
      </label>
    </div>
  );
}

function SharedPromptFields({
  idPrefix,
  caption,
  tags,
}: {
  idPrefix: string;
  caption: string;
  tags: string;
}) {
  return (
    <div className="stack">
      <div className="grid two-up">
        <label className="stack auth-field" htmlFor={`${idPrefix}-caption`}>
          <span>Caption</span>
          <textarea id={`${idPrefix}-caption`} name="caption" rows={4} defaultValue={caption} />
        </label>
        <div className="stack">
          <label className="stack auth-field" htmlFor={`${idPrefix}-tags`}>
            <span>Tags</span>
            <textarea id={`${idPrefix}-tags`} name="tags" rows={3} defaultValue={tags} />
          </label>
        </div>
      </div>
      <div className="section-card__actions">
        <span className="subtle">Target Marketplace</span>
        <StatusBadge status={PROMPT_TARGET_MARKETPLACE} tone="info" />
      </div>
    </div>
  );
}

function promptSetFromPack(pack: PromptPackRecord) {
  return readPromptPackEditorPromptSet(pack);
}

function PromptPackEditorForm({
  pack,
  intakeSession,
  affiliateProfile,
  sourceImage,
  generationTask,
}: {
  pack: PromptPackRecord;
  intakeSession: IntakeSessionRecord | null;
  affiliateProfile: { id: string; profile_name: string } | null;
  sourceImage: ProductImageRecord | null;
  generationTask: PromptTaskRecord | null;
}) {
  const promptSet = promptSetFromPack(pack);

  return (
    <form className="stack" action={savePromptPack}>
      <input type="hidden" name="id" value={pack.id} />
      <input type="hidden" name="product_id" value={pack.product_id} />
      <input type="hidden" name="version" value={pack.version} />
      <input type="hidden" name="intake_session_id" value={pack.intake_session_id ?? intakeSession?.id ?? ""} />
      <input type="hidden" name="affiliate_profile_id" value={pack.affiliate_profile_id ?? affiliateProfile?.id ?? ""} />
      <input type="hidden" name="source_product_image_id" value={pack.source_product_image_id ?? sourceImage?.id ?? ""} />

      {generationTask?.error_message ? <section className="error-box">{generationTask.error_message}</section> : null}
      {pack.error_message ? <section className="error-box">{pack.error_message}</section> : null}

      <div className="grid two-up">
        {PROMPT_CLIP_KEYS.map((clipKey) => (
          <PromptClipFields clipKey={clipKey} idPrefix={pack.id} key={clipKey} values={promptSet.clips[clipKey]} />
        ))}
      </div>

      <SharedPromptFields idPrefix={pack.id} caption={promptSet.caption} tags={promptSet.tags} />

      <label className="stack auth-field" htmlFor={`revision-${pack.id}`}>
        <span>Instruksi Revisi</span>
        <textarea id={`revision-${pack.id}`} name="revision_instruction" rows={3} />
      </label>

      <div className="section-card__actions">
        <Link className="button compact tertiary" href={`/products/${pack.product_id}?tab=prompt_pack`}>
          Detail
        </Link>
      </div>

      <FormActions layout="quad">
        <button className="button tertiary" name="intent" type="submit" value="update">
          <Save size={16} aria-hidden="true" />
          Simpan
        </button>
        <button className="button primary" name="intent" type="submit" value="regenerate">
          <RefreshCcw size={16} aria-hidden="true" />
          Buat Ulang
        </button>
        <button className="button destructive" name="intent" type="submit" value="archive">
          <Archive size={16} aria-hidden="true" />
          Arsipkan
        </button>
        <button className="button primary" name="intent" type="submit" value="mark_ready">
          <Play size={16} aria-hidden="true" />
          Tandai Siap Flow
        </button>
      </FormActions>
    </form>
  );
}

function PromptPackCreateForm({
  product,
  intakeSession,
  affiliateProfile,
  sourceImage,
}: {
  product: ProductRecord;
  intakeSession: IntakeSessionRecord | null;
  affiliateProfile: { id: string; profile_name: string } | null;
  sourceImage: ProductImageRecord | null;
}) {
  const canCreate = Boolean(intakeSession?.reviewed_metadata_json || intakeSession?.status === "REVIEWED");

  return (
    <form className="stack" action={savePromptPack}>
      <input type="hidden" name="intent" value="create_generate" />
      <input type="hidden" name="status" value="DRAFT" />
      <input type="hidden" name="version" value={1} />
      <input type="hidden" name="product_id" value={product.id} />
      <input type="hidden" name="intake_session_id" value={intakeSession?.id ?? ""} />
      <input type="hidden" name="affiliate_profile_id" value={affiliateProfile?.id ?? ""} />
      <input type="hidden" name="source_product_image_id" value={sourceImage?.id ?? ""} />

      {canCreate ? null : <section className="error-box">Review Gemini dulu.</section>}

      <FormActions layout="pair">
        <button className="button primary" type="submit" disabled={!canCreate}>
          <Play size={16} aria-hidden="true" />
          Buat Prompt
        </button>
        <Link className="button tertiary" href={`/products/${product.id}?tab=metadata`}>
          Detail
        </Link>
      </FormActions>
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
  isOpen,
}: {
  product: ProductRecord;
  workspaceName: string;
  promptPack: PromptPackRecord | null;
  intakeSession: IntakeSessionRecord | null;
  affiliateProfile: { id: string; profile_name: string } | null;
  sourceImage: ProductImageRecord | null;
  sourceImageDriveItem: DriveItemRecord | null;
  generationTask: PromptTaskRecord | null;
  defaultAffiliateProfileName: string;
  isOpen: boolean;
}) {
  const statusLabel = promptPack ? promptPack.status : intakeSession?.status ?? "DRAFT";
  const productDetailHref = `/products/${product.id}?tab=${promptPack ? "prompt_pack" : "metadata"}`;
  const editorHref = promptEditorHref({
    affiliateProfileId: promptPack?.affiliate_profile_id ?? affiliateProfile?.id ?? null,
    intakeId: promptPack?.intake_session_id ?? intakeSession?.id ?? null,
    productId: product.id,
  });
  const affiliateProfileName = affiliateProfile?.profile_name ?? defaultAffiliateProfileName;
  const actionLayout = promptPack || intakeSession ? "pair" : "single";

  return (
    <article className="prompt-list-card stack" data-open={isOpen ? "true" : undefined}>
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
        <span>{sourceImageDriveItem?.name ?? sourceImage?.id ?? "Foto belum ada"}</span>
        {generationTask ? <StatusBadge status={generationTask.status} /> : null}
      </div>

      <div className="prompt-list-card__divider" aria-hidden="true" />

      <div className={`prompt-list-card__actions action-rail action-rail--${actionLayout}`.trim()}>
        <Link className="button compact tertiary" href={productDetailHref}>
          <ArrowRight size={15} aria-hidden="true" />
          Detail
        </Link>
        {promptPack ? (
          <Link className="button compact primary" href={editorHref}>
            <Edit3 size={15} aria-hidden="true" />
            Edit
          </Link>
        ) : intakeSession ? (
          <Link className="button compact primary" href={editorHref}>
            <Play size={15} aria-hidden="true" />
            Buat Prompt
          </Link>
        ) : null}
      </div>

      {isOpen ? (
        <div className="stack prompt-list-card__editor">
          {promptPack ? (
            <PromptPackEditorForm
              affiliateProfile={affiliateProfile}
              generationTask={generationTask}
              intakeSession={intakeSession}
              pack={promptPack}
              sourceImage={sourceImage}
            />
          ) : (
            <PromptPackCreateForm
              affiliateProfile={affiliateProfile}
              intakeSession={intakeSession}
              product={product}
              sourceImage={sourceImage}
            />
          )}
        </div>
      ) : null}
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

  const productMap = new Map(products.map((product) => [product.id, product]));
  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));
  const affiliateProfileMap = new Map(affiliateProfiles.map((profile) => [profile.id, profile]));
  const requestedAffiliateProfile =
    requestedAffiliateProfileId && affiliateProfileMap.has(requestedAffiliateProfileId)
      ? affiliateProfileMap.get(requestedAffiliateProfileId) ?? null
      : null;
  const latestPromptPackByProductId = new Map<string, PromptPackRecord>();
  const latestReviewedIntakeByProductId = new Map<string, IntakeSessionRecord>();

  for (const pack of promptPacks) {
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
    new Set(promptPacks.map((pack) => pack.ai_task_id).filter((value): value is string => Boolean(value))),
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

  return (
    <div className="stack prompt-page-stack">
      <div className="settings-inline-summary prompt-inline-summary">
        <span>{products.length} produk</span>
        <StatusBadge status={currentAffiliateProfileLabel} tone={currentAffiliateProfile ? "success" : "warning"} />
      </div>

      <section className="stack" aria-label="Paket Prompt">
        {products.length ? (
          <section className="stack prompt-list-stack">
            {products.map((product) => {
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
                  isOpen={selectedProductId === product.id}
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

      {promptPacks.length ? (
        <details className="prompt-history-compact">
          <summary>Riwayat prompt</summary>
          <ul className="list">
            {promptPacks.map((pack) => {
              const product = productMap.get(pack.product_id);
              return (
                <li key={pack.id}>
                  <div className="stack-tight">
                    <strong>{product?.product_name ?? "Produk tidak tersedia"}</strong>
                    <span className="subtle">{`v${pack.version}`}</span>
                    <StatusBadge status={pack.status} />
                  </div>
                  <Link className="button compact" href={`/products/${pack.product_id}?tab=prompt_pack`}>
                    Detail
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
