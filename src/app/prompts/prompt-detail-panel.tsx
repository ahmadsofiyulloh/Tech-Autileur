import { Clock3, FileText, RefreshCcw } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { SectionCard } from "@/components/operator/section-card";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { PromptGenerationMonitor } from "@/components/operator/prompt-generation-monitor";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { NativeLinkButton } from "@/components/ui/native-button";
import { listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { listIntakeSessions } from "@/lib/server/intake";
import { getProductById, listProductImages } from "@/lib/server/products";
import { getPromptPackById } from "@/lib/server/prompt-packs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { REGENERATION_SCOPES } from "@/lib/prompts/prompt-regeneration";
import { savePromptPack } from "./actions";
import { PromptOutputFields } from "./prompt-output-fields";
import {
  SkeletonPromptDetailContent,
  SkeletonPromptDetailRegenerate,
} from "@/components/operator/loading-skeleton";

type PromptPackRecord = Awaited<ReturnType<typeof getPromptPackById>>;
type ProductRecord = NonNullable<Awaited<ReturnType<typeof getProductById>>>;
type IntakeSessionRecord = Awaited<ReturnType<typeof listIntakeSessions>>[number];
type ProductImageRecord = Awaited<ReturnType<typeof listProductImages>>[number];
type AffiliateProfileRecord = Awaited<ReturnType<typeof listAffiliateProfiles>>[number];
type PromptTaskRecord = {
  id: string;
  status: string;
  error_message: string | null;
};

type PromptDetailPanelProps = {
  detailHref: string;
  promptPackId: string;
};

async function readPromptTask(promptPack: PromptPackRecord, userId: string): Promise<PromptTaskRecord | null> {
  if (!promptPack.ai_task_id) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_tasks")
    .select("id, status, error_message")
    .eq("id", promptPack.ai_task_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? (data as PromptTaskRecord) : null;
}

export async function PromptDetailPanel({ detailHref, promptPackId }: PromptDetailPanelProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <SectionCard icon={FileText} title="Sesi tidak tersedia.">
        <EmptyState icon={FileText} title="Sesi tidak tersedia." description="Masuk ulang untuk membuka detail prompt." />
      </SectionCard>
    );
  }

  const id = promptPackId;
  let promptPack: PromptPackRecord;
  let product: ProductRecord | null = null;
  let intakeSessions: IntakeSessionRecord[] = [];
  let productImages: ProductImageRecord[] = [];
  let affiliateProfiles: AffiliateProfileRecord[] = [];
  let promptTask: PromptTaskRecord | null = null;

  try {
    promptPack = await getPromptPackById(id);
  } catch (error) {
    const description = error instanceof Error ? error.message : "Prompt tidak tersedia.";

    return (
      <SectionCard icon={FileText} title="Prompt tidak tersedia." description={description}>
        <EmptyState icon={FileText} title="Prompt tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  if (promptPack.status === "ARCHIVED") {
    return (
      <SectionCard icon={FileText} title="Prompt sudah diarsipkan.">
        <EmptyState icon={FileText} title="Prompt tidak tersedia." description="Paket prompt ini sudah dihapus dari daftar aktif." />
      </SectionCard>
    );
  }

  try {
    [product, intakeSessions, productImages, affiliateProfiles, promptTask] = await Promise.all([
      getProductById(promptPack.product_id),
      listIntakeSessions({ productId: promptPack.product_id, limit: 200 }),
      listProductImages({ productId: promptPack.product_id, limit: 200 }),
      listAffiliateProfiles({ limit: 200 }),
      readPromptTask(promptPack, user.id),
    ]);
  } catch (error) {
    const description = error instanceof Error ? error.message : "Detail prompt tidak tersedia.";

    return (
      <SectionCard icon={FileText} title="Detail prompt tidak tersedia." description={description}>
        <EmptyState icon={FileText} title="Detail prompt tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  if (!product || product.status === "ARCHIVED") {
    return (
      <SectionCard icon={FileText} title="Produk tidak tersedia.">
        <EmptyState icon={FileText} title="Produk tidak tersedia." description="Produk untuk prompt ini tidak tersedia di workspace aktif." />
      </SectionCard>
    );
  }

  const intakeSession = promptPack.intake_session_id
    ? intakeSessions.find((session) => session.id === promptPack.intake_session_id) ?? null
    : intakeSessions.find((session) => session.reviewed_metadata_json || session.status === "REVIEWED") ?? null;
  const affiliateProfile = promptPack.affiliate_profile_id
    ? affiliateProfiles.find((profile) => profile.id === promptPack.affiliate_profile_id) ?? null
    : null;
  const sourceImage = promptPack.source_product_image_id
    ? productImages.find((image) => image.id === promptPack.source_product_image_id) ?? null
    : productImages.find((image) => image.is_primary) ?? productImages[0] ?? null;
  const promptErrorMessage = promptPack.error_message ?? promptTask?.error_message ?? null;
  const promptTaskStatus = promptTask?.status ?? promptPack.status;
  const isPromptGenerationPending = ["QUEUED", "GENERATING", "WAITING_FOR_KEY", "RETRYING"].includes(promptTaskStatus);
  return (
    <div className="stack operator-detail-panel">
      {promptErrorMessage ? <section className="error-box">{promptErrorMessage}</section> : null}

      {isPromptGenerationPending ? <PromptGenerationMonitor enabled promptPackId={promptPack.id} /> : null}

      <SectionCard icon={FileText} title="Output Siap Copy">
        {isPromptGenerationPending ? (
          <>
            <SkeletonPromptDetailContent />
            <div className="section-card__actions desktop-action-set">
              <PendingActionButton className="compact tertiary" pendingLabel="Menyimpan" disabled>
                Simpan TXT Drive
              </PendingActionButton>
            </div>
            <div className="mobile-action-set">
              <PendingActionButton className="compact tertiary" pendingLabel="Menyimpan" disabled>
                Simpan TXT Drive
              </PendingActionButton>
            </div>
          </>
        ) : (
          <>
            <PromptOutputFields pack={promptPack} />
            <form className="section-card__actions desktop-action-set" action={savePromptPack}>
              <input type="hidden" name="id" value={promptPack.id} />
              <input type="hidden" name="return_to" value={detailHref} />
              <input type="hidden" name="product_id" value={promptPack.product_id} />
              <PendingActionButton
                className="compact tertiary"
                pendingLabel="Menyimpan"
                name="intent"
                value="export_prompt_txt"
              >
                Simpan TXT Drive
              </PendingActionButton>
            </form>
            <div className="mobile-action-set">
              <form action={savePromptPack}>
                <input type="hidden" name="id" value={promptPack.id} />
                <input type="hidden" name="return_to" value={detailHref} />
                <input type="hidden" name="product_id" value={promptPack.product_id} />
                <PendingActionButton
                  className="compact tertiary"
                  pendingLabel="Menyimpan"
                  name="intent"
                  value="export_prompt_txt"
                >
                  Simpan TXT Drive
                </PendingActionButton>
              </form>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard icon={RefreshCcw} title="Regenerate Prompt">
        {isPromptGenerationPending ? (
          <SkeletonPromptDetailRegenerate />
        ) : (
          <form className="stack" action={savePromptPack}>
            <input type="hidden" name="id" value={promptPack.id} />
            <input type="hidden" name="return_to" value={detailHref} />
            <input type="hidden" name="product_id" value={promptPack.product_id} />
            <input type="hidden" name="intake_session_id" value={promptPack.intake_session_id ?? intakeSession?.id ?? ""} />
            <input type="hidden" name="affiliate_profile_id" value={promptPack.affiliate_profile_id ?? affiliateProfile?.id ?? ""} />
            <input type="hidden" name="source_product_image_id" value={promptPack.source_product_image_id ?? sourceImage?.id ?? ""} />

            <RelationalPicker
              label="Lingkup Regenerasi"
              name="regeneration_scope"
              options={REGENERATION_SCOPES.map((scope) => ({
                value: scope.key,
                label: scope.label,
                description: scope.description,
              }))}
              defaultValue="full_pack"
              searchable={false}
            />

            <label className="stack auth-field" htmlFor="revision_instruction">
              <span>Instruksi Revisi</span>
              <textarea id="revision_instruction" name="revision_instruction" rows={3} />
            </label>

            <FormActions layout="pair">
              <NativeLinkButton className="tertiary" href={`/prompts/${promptPack.id}/history`}>
                <Clock3 size={16} aria-hidden="true" />
                History
              </NativeLinkButton>
              <PendingActionButton
                className="primary"
                pendingLabel="Meregenerasi"
                name="intent"
                value="regenerate"
              >
                Buat Ulang
              </PendingActionButton>
            </FormActions>
          </form>
        )}
      </SectionCard>
    </div>
  );
}
