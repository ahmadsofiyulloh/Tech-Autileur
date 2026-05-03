import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, CheckCircle, FileText, Package, Plus, Play, RefreshCcw, Save } from "lucide-react";
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
    intake_id?: string | string[];
    product_id?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

function promptSetFromPack(pack: PromptPackRecord) {
  return readPromptPackEditorPromptSet(pack);
}

function PromptPackEditorForm({
  pack,
  product,
  intakeSession,
  affiliateProfile,
  sourceImage,
  sourceImageDriveItem,
  generationTask,
  defaultAffiliateProfileName,
}: {
  pack: PromptPackRecord;
  product: ProductRecord | undefined;
  intakeSession: IntakeSessionRecord | null;
  affiliateProfile: { id: string; profile_name: string } | null;
  sourceImage: ProductImageRecord | null;
  sourceImageDriveItem: DriveItemRecord | null;
  generationTask: PromptTaskRecord | null;
  defaultAffiliateProfileName: string;
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

      <div className="metric-grid">
        <div className="metric">
          <span>Produk</span>
          <strong>{product?.product_name ?? "Produk tidak tersedia"}</strong>
        </div>
        <div className="metric">
          <span>Intake</span>
          <strong>{intakeSession ? "Sudah direview" : "Intake terbaru"}</strong>
        </div>
        <div className="metric">
          <span>Akun Affiliate</span>
          <strong>{affiliateProfile?.profile_name ?? defaultAffiliateProfileName}</strong>
        </div>
        <div className="metric">
          <span>Foto Produk Utama</span>
          <strong>{sourceImageDriveItem?.name ?? sourceImage?.id ?? "Belum ada"}</strong>
        </div>
        {generationTask ? (
          <div className="metric">
            <span>Task</span>
            <strong>
              <StatusBadge status={generationTask.status} />
            </strong>
          </div>
        ) : null}
      </div>

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
        <Link className="button compact" href={`/products/${pack.product_id}`}>
          Produk
        </Link>
      </div>

      <FormActions>
        <button className="button" name="intent" type="submit" value="update">
          <Save size={16} aria-hidden="true" />
          Simpan
        </button>
        <button className="button primary" name="intent" type="submit" value="regenerate">
          <RefreshCcw size={16} aria-hidden="true" />
          Buat Ulang
        </button>
        <button className="button" name="intent" type="submit" value="mark_ready">
          <CheckCircle size={16} aria-hidden="true" />
          Tandai Siap Flow
        </button>
        <button className="button" name="intent" type="submit" value="archive">
          <Archive size={16} aria-hidden="true" />
          Arsipkan
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
  sourceImageDriveItem,
  defaultAffiliateProfileName,
}: {
  product: ProductRecord;
  intakeSession: IntakeSessionRecord | null;
  affiliateProfile: { id: string; profile_name: string } | null;
  sourceImage: ProductImageRecord | null;
  sourceImageDriveItem: DriveItemRecord | null;
  defaultAffiliateProfileName: string;
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

      <div className="metric-grid">
        <div className="metric">
          <span>Produk</span>
          <strong>{product.product_name}</strong>
        </div>
        <div className="metric">
          <span>Intake</span>
          <strong>{intakeSession ? "Sudah direview" : "Belum ada intake direview"}</strong>
        </div>
        <div className="metric">
          <span>Akun Affiliate</span>
          <strong>{affiliateProfile?.profile_name ?? defaultAffiliateProfileName}</strong>
        </div>
        <div className="metric">
          <span>Foto Produk Utama</span>
          <strong>{sourceImageDriveItem?.name ?? sourceImage?.id ?? "Belum ada"}</strong>
        </div>
      </div>

      {canCreate ? null : <section className="error-box">Review Gemini dulu.</section>}

      <FormActions>
        <button className="button primary" type="submit" disabled={!canCreate}>
          <Play size={16} aria-hidden="true" />
          Buat Prompt
        </button>
        <Link className="button" href={`/products/${product.id}`}>
          Produk
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

  return (
    <details className="muted-box stack" open={isOpen}>
      <summary>
        <span className="section-card__actions">
          <strong>{product.product_name}</strong>
        </span>
        <span className="section-card__actions">
          <StatusBadge status={statusLabel} />
          <span className="subtle">{workspaceName}</span>
        </span>
      </summary>

      <div className="stack">
        <div className="metric-grid">
          <div className="metric">
            <span>Workspace</span>
            <strong>{workspaceName}</strong>
          </div>
          <div className="metric">
            <span>Intake</span>
            <strong>{intakeSession ? "Sudah direview" : "Belum direview"}</strong>
          </div>
          <div className="metric">
            <span>Akun Affiliate</span>
            <strong>{affiliateProfile?.profile_name ?? defaultAffiliateProfileName}</strong>
          </div>
          <div className="metric">
            <span>Foto Produk Utama</span>
            <strong>{sourceImageDriveItem?.name ?? sourceImage?.id ?? "Belum ada"}</strong>
          </div>
          <div className="metric">
            <span>Prompt pack</span>
            <strong>{promptPack ? `Versi ${promptPack.version}` : "Belum ada"}</strong>
          </div>
        </div>

        {promptPack ? (
          <PromptPackEditorForm
            affiliateProfile={affiliateProfile}
            defaultAffiliateProfileName={defaultAffiliateProfileName}
            generationTask={generationTask}
            intakeSession={intakeSession}
            pack={promptPack}
            product={product}
            sourceImage={sourceImage}
            sourceImageDriveItem={sourceImageDriveItem}
          />
        ) : (
          <PromptPackCreateForm
            affiliateProfile={affiliateProfile}
            defaultAffiliateProfileName={defaultAffiliateProfileName}
            intakeSession={intakeSession}
            product={product}
            sourceImage={sourceImage}
            sourceImageDriveItem={sourceImageDriveItem}
          />
        )}
      </div>
    </details>
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
    products.find((product) => latestPromptPackByProductId.has(product.id) || latestReviewedIntakeByProductId.has(product.id))?.id ??
    products[0]?.id ??
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
    <div className="stack">
      <SectionCard
        icon={FileText}
        title="Paket Prompt"
        actions={<StatusBadge status={currentAffiliateProfileLabel} tone={currentAffiliateProfile ? "success" : "warning"} />}
      >
        {products.length ? (
          <section className="stack">
            {products.map((product) => {
              const promptPack = latestPromptPackByProductId.get(product.id) ?? null;
              const intakeSession = latestReviewedIntakeByProductId.get(product.id) ?? null;
              const affiliateProfile = promptPack?.affiliate_profile_id
                ? affiliateProfileMap.get(promptPack.affiliate_profile_id) ?? null
                : currentAffiliateProfile;
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
      </SectionCard>

      <SectionCard icon={Archive} title="Prompt siap Flow">
        {promptPacks.length ? (
          <ul className="list">
            {promptPacks.map((pack) => {
              const product = productMap.get(pack.product_id);
              return (
                <li key={pack.id}>
                  <div className="stack-tight">
                    <strong>{product?.product_name ?? "Produk tidak tersedia"}</strong>
                    <span className="subtle">
                      {[product?.product_name ?? "Produk tidak tersedia", `v${pack.version}`].filter(Boolean).join(" - ")}
                    </span>
                    <StatusBadge status={pack.status} />
                  </div>
                  <Link className="button compact" href={`/products/${pack.product_id}?tab=prompt_pack`}>
                    Buka produk
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={Archive} title="Belum ada prompt siap Flow." description="Buat prompt dulu." />
        )}
      </SectionCard>
    </div>
  );
}
