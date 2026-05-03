import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, CheckCircle, FileText, FlaskConical, Package, Play, RefreshCcw, Save } from "lucide-react";
import { savePromptPack } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { listIntakeSessions } from "@/lib/server/intake";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listDriveItems } from "@/lib/server/drive-items";
import { listProductImages, listProducts } from "@/lib/server/products";
import { listPromptPacks } from "@/lib/server/prompt-packs";
import { readPromptPackEditorPromptSet } from "@/lib/prompts/prompt-pack-contract";
import {
  PROMPT_CLIP_KEYS,
  PROMPT_CLIP_LABELS,
  PROMPT_READY_FOR_FLOW_STATUS,
  PROMPT_TARGET_MARKETPLACE,
  type PromptClipKey,
} from "@/lib/prompts/validation";

export const dynamic = "force-dynamic";

type PromptPackRecord = Awaited<ReturnType<typeof listPromptPacks>>[number];
type PromptTaskRecord = {
  id: string;
  status: string;
  error_message: string | null;
};

function pickerOption(value: string, label: string, description?: string | null) {
  return {
    value,
    label,
    ...(description ? { description } : {}),
  };
}

function fieldValue(value: string | number | null | undefined) {
  return value ?? "";
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

function PromptEditorForm({
  pack,
  productPickerOptions,
  intakeSessionPickerOptions,
  affiliateProfilePickerOptions,
  sourceImagePickerOptions,
  productLabel,
  intakeLabel,
  affiliateProfileLabel,
  sourceImageLabel,
  generationTask,
}: {
  pack: PromptPackRecord;
  productPickerOptions: Array<{ value: string; label: string; description?: string }>;
  intakeSessionPickerOptions: Array<{ value: string; label: string; description?: string }>;
  affiliateProfilePickerOptions: Array<{ value: string; label: string; description?: string }>;
  sourceImagePickerOptions: Array<{ value: string; label: string; description?: string }>;
  productLabel: string;
  intakeLabel: string;
  affiliateProfileLabel: string;
  sourceImageLabel: string;
  generationTask: PromptTaskRecord | null;
}) {
  const promptSet = readPromptPackEditorPromptSet(pack);
  const isReady = pack.status === PROMPT_READY_FOR_FLOW_STATUS;

  return (
    <SectionCard
      icon={FileText}
      title={`${productLabel} - v${pack.version}`}
      actions={
        <div className="section-card__actions">
          <StatusBadge status={pack.status} />
          {isReady ? <StatusBadge status="Siap Flow" tone="success" /> : null}
        </div>
      }
    >
      <form className="stack" action={savePromptPack}>
        <input type="hidden" name="id" value={pack.id} />
        <input type="hidden" name="version" value={pack.version} />
        <div className="metric-grid">
          <div className="metric">
            <span>Produk</span>
            <strong>{productLabel}</strong>
          </div>
          <div className="metric">
            <span>Intake</span>
            <strong>{intakeLabel}</strong>
          </div>
          <div className="metric">
            <span>Akun Affiliate</span>
            <strong>{affiliateProfileLabel}</strong>
          </div>
          <div className="metric">
            <span>Foto Produk Utama</span>
            <strong>{sourceImageLabel}</strong>
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
          <RelationalPicker
            defaultValue={pack.product_id}
            label="Produk"
            name="product_id"
            options={productPickerOptions}
            placeholder="Pilih produk"
            searchPlaceholder="Cari produk"
            required
          />
          <label className="stack auth-field" htmlFor={`prompt-code-${pack.id}`}>
            <span>Kode Prompt</span>
            <input id={`prompt-code-${pack.id}`} name="prompt_code" type="text" defaultValue={pack.prompt_code} required />
          </label>
        </div>

        <div className="grid two-up">
          <RelationalPicker
            allowClear
            emptyLabel="Kosong"
            defaultValue={pack.intake_session_id ?? ""}
            label="Intake"
            name="intake_session_id"
            options={intakeSessionPickerOptions}
            placeholder="Pakai intake terbaru"
            searchPlaceholder="Cari intake"
          />
          <RelationalPicker
            allowClear
            emptyLabel="Kosong"
            defaultValue={pack.affiliate_profile_id ?? ""}
            label="Akun Affiliate"
            name="affiliate_profile_id"
            options={affiliateProfilePickerOptions}
            placeholder="Pakai default workspace"
            searchPlaceholder="Cari akun"
          />
        </div>

        <RelationalPicker
          allowClear
          emptyLabel="Kosong"
          defaultValue={pack.source_product_image_id ?? ""}
          label="Foto Produk Utama"
          name="source_product_image_id"
          options={sourceImagePickerOptions}
          placeholder="Pakai foto utama"
          searchPlaceholder="Cari foto"
        />

        <div className="grid two-up">
          {PROMPT_CLIP_KEYS.map((clipKey) => (
            <PromptClipFields
              clipKey={clipKey}
              idPrefix={pack.id}
              key={clipKey}
              values={promptSet.clips[clipKey]}
            />
          ))}
        </div>

        <SharedPromptFields idPrefix={pack.id} caption={promptSet.caption} tags={promptSet.tags} />

        <label className="stack auth-field" htmlFor={`revision-${pack.id}`}>
          <span>Instruksi Revisi</span>
          <textarea id={`revision-${pack.id}`} name="revision_instruction" rows={3} />
        </label>

        <label className="stack auth-field" htmlFor={`notes-${pack.id}`}>
          <span>Catatan</span>
          <textarea id={`notes-${pack.id}`} name="notes" rows={2} defaultValue={fieldValue(pack.notes)} />
        </label>

        <FormActions>
          <button className="button" name="intent" type="submit" value="update">
            <Save size={16} aria-hidden="true" />
            Simpan
          </button>
          <button className="button primary" name="intent" type="submit" value="regenerate">
            <RefreshCcw size={16} aria-hidden="true" />
            Buat Ulang
          </button>
          <button className="button" name="intent" type="submit" value="regenerate_mock">
            <FlaskConical size={16} aria-hidden="true" />
            Mock
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
    </SectionCard>
  );
}

function emptyClipValues() {
  return {
    i2i_first_frame: "",
    i2i_last_frame: "",
    i2v_prompt: "",
  };
}

export default async function PromptsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const currentWorkspace = await getCurrentWorkspace();
  const workspaceId = currentWorkspace?.id ?? undefined;

  let promptPacks;
  let products;
  let productImages;
  let driveItems;
  let intakeSessions;
  let affiliateProfiles;

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
      <SectionCard title="Prompt tidak tersedia." description={message}>
        <EmptyState icon={FileText} title="Prompt tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));
  const sourceImageMap = new Map(productImages.map((image) => [image.id, image]));
  const intakeSessionMap = new Map(intakeSessions.map((session) => [session.id, session]));
  const affiliateProfileMap = new Map(affiliateProfiles.map((profile) => [profile.id, profile]));
  const aiTaskIds = Array.from(new Set(promptPacks.map((pack) => pack.ai_task_id).filter((value): value is string => Boolean(value))));
  const promptPackTasks = aiTaskIds.length
    ? await supabase
        .from("ai_tasks")
        .select("id, status, error_message")
        .eq("user_id", user.id)
        .in("id", aiTaskIds)
    : { data: [], error: null };

  if (promptPackTasks.error) {
    return (
      <SectionCard title="Task tidak tersedia." description={promptPackTasks.error.message}>
        <EmptyState icon={FileText} title="Task tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  const promptTaskMap = new Map((promptPackTasks.data ?? []).map((task) => [task.id, task as PromptTaskRecord]));

  const productPickerOptions = products.map((product) =>
    pickerOption(product.id, product.product_name, product.product_code),
  );
  const intakeSessionPickerOptions = intakeSessions.map((session) => {
    const product = session.product_id ? productMap.get(session.product_id) : null;

    return pickerOption(
      session.id,
      session.intake_code,
      [session.product_title ?? product?.product_name ?? null, session.status].filter(Boolean).join(" - "),
    );
  });
  const affiliateProfilePickerOptions = affiliateProfiles.map((profile) =>
    pickerOption(
      profile.id,
      profile.profile_name,
      [profile.profile_code, profile.platform, profile.account_label].filter(Boolean).join(" - "),
    ),
  );
  const sourceImagePickerOptions = productImages
    .filter((image) => productMap.has(image.product_id))
    .map((image) => {
      const product = productMap.get(image.product_id);
      const driveItem = driveItemMap.get(image.drive_item_ref_id);

      return pickerOption(
        image.id,
        driveItem?.name ?? image.drive_item_ref_id ?? image.id,
        [product?.product_code ?? product?.product_name ?? "Produk", image.is_primary ? "utama" : null, image.status]
          .filter(Boolean)
          .join(" - "),
      );
    });
  const emptyClips = PROMPT_CLIP_KEYS.reduce(
    (result, clipKey) => ({
      ...result,
      [clipKey]: emptyClipValues(),
    }),
    {} as Record<PromptClipKey, ReturnType<typeof emptyClipValues>>,
  );

  return (
    <div className="stack">
      {products.length ? (
        <SectionCard icon={FileText} title="Buat Prompt">
          <form className="stack" action={savePromptPack}>
            <input type="hidden" name="version" value={1} />
            <input type="hidden" name="status" value="DRAFT" />
            <div className="grid two-up">
              <RelationalPicker
                defaultValue={products[0]?.id ?? ""}
                label="Produk"
                name="product_id"
                options={productPickerOptions}
                placeholder="Pilih produk"
                searchPlaceholder="Cari produk"
                required
              />
              <label className="stack auth-field" htmlFor="create-prompt-code">
                <span>Kode Prompt</span>
                <input id="create-prompt-code" name="prompt_code" type="text" placeholder="PROMPT-001" required />
              </label>
            </div>
            <div className="grid two-up">
              <RelationalPicker
                allowClear
                emptyLabel="Kosong"
                defaultValue=""
                label="Intake"
                name="intake_session_id"
                options={intakeSessionPickerOptions}
                placeholder="Pakai intake terbaru"
                searchPlaceholder="Cari intake"
              />
              <RelationalPicker
                allowClear
                emptyLabel="Kosong"
                defaultValue=""
                label="Akun Affiliate"
                name="affiliate_profile_id"
                options={affiliateProfilePickerOptions}
                placeholder="Pakai default workspace"
                searchPlaceholder="Cari akun"
              />
            </div>
            <RelationalPicker
              allowClear
              emptyLabel="Kosong"
              defaultValue=""
              label="Foto Produk Utama"
              name="source_product_image_id"
              options={sourceImagePickerOptions}
              placeholder="Pakai foto utama"
              searchPlaceholder="Cari foto"
            />
            <div className="grid two-up">
              {PROMPT_CLIP_KEYS.map((clipKey) => (
                <PromptClipFields clipKey={clipKey} idPrefix="create" key={clipKey} values={emptyClips[clipKey]} />
              ))}
            </div>
            <SharedPromptFields idPrefix="create" caption="" tags="" />
            <label className="stack auth-field" htmlFor="create-revision">
              <span>Instruksi Revisi</span>
              <textarea id="create-revision" name="revision_instruction" rows={3} />
            </label>
            <label className="stack auth-field" htmlFor="create-notes">
              <span>Catatan</span>
              <textarea id="create-notes" name="notes" rows={2} />
            </label>
            <FormActions>
              <button className="button primary" name="intent" type="submit" value="create_generate">
                <Play size={16} aria-hidden="true" />
                Buat Prompt
              </button>
              <button className="button" name="intent" type="submit" value="create_generate_mock">
                <FlaskConical size={16} aria-hidden="true" />
                Mock
              </button>
            </FormActions>
          </form>
        </SectionCard>
      ) : (
        <EmptyState
          icon={Package}
          title="Produk belum ada."
          description="Buat produk dulu."
          action={
            <Link className="button primary" href="/products/new">
              Produk Baru
            </Link>
          }
        />
      )}

      {promptPacks.length ? (
        <section className="stack">
          {promptPacks.map((pack) => {
            const product = productMap.get(pack.product_id);
            const intakeSession = pack.intake_session_id ? intakeSessionMap.get(pack.intake_session_id) ?? null : null;
            const affiliateProfile = pack.affiliate_profile_id ? affiliateProfileMap.get(pack.affiliate_profile_id) ?? null : null;
            const sourceImage = pack.source_product_image_id ? sourceImageMap.get(pack.source_product_image_id) ?? null : null;
            const sourceDriveItem = sourceImage ? driveItemMap.get(sourceImage.drive_item_ref_id) ?? null : null;
            const generationTask = pack.ai_task_id ? promptTaskMap.get(pack.ai_task_id) ?? null : null;

            return (
              <PromptEditorForm
                affiliateProfileLabel={affiliateProfile?.profile_name ?? "Default workspace"}
                affiliateProfilePickerOptions={affiliateProfilePickerOptions}
                generationTask={generationTask}
                intakeLabel={intakeSession?.intake_code ?? "Intake terbaru"}
                intakeSessionPickerOptions={intakeSessionPickerOptions}
                key={pack.id}
                pack={pack}
                productLabel={product?.product_name ?? "Produk tidak tersedia"}
                productPickerOptions={productPickerOptions}
                sourceImageLabel={sourceDriveItem?.name ?? "Foto utama"}
                sourceImagePickerOptions={sourceImagePickerOptions}
              />
            );
          })}
        </section>
      ) : (
        <EmptyState icon={FileText} title="Prompt belum ada." description="Buat prompt pertama." />
      )}
    </div>
  );
}
