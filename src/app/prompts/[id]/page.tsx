import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Clock3, FileText, FileUp, RefreshCcw } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { SectionCard } from "@/components/operator/section-card";
import { TopbarOverride } from "@/components/operator/topbar-context";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { listIntakeSessions } from "@/lib/server/intake";
import { getProductById, listProductImages } from "@/lib/server/products";
import { getPromptPackById } from "@/lib/server/prompt-packs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { savePromptPack } from "../actions";
import { HiddenPromptSetFields, PromptOutputFields, readPromptOutputSet } from "./prompt-output-fields";

export const dynamic = "force-dynamic";

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

type PromptDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[]; message?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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

export default async function PromptDetailPage({ params, searchParams }: PromptDetailPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const message = firstParam(query.message);
  const errorMessage = firstParam(query.error);
  let promptPack: PromptPackRecord;
  let product: ProductRecord | null = null;
  let intakeSessions: IntakeSessionRecord[] = [];
  let productImages: ProductImageRecord[] = [];
  let affiliateProfiles: AffiliateProfileRecord[] = [];
  let promptTask: PromptTaskRecord | null = null;

  try {
    promptPack = await getPromptPackById(id);
  } catch (error) {
    if (error instanceof Error && error.message === "Prompt pack not found.") {
      notFound();
    }

    const description = error instanceof Error ? error.message : "Prompt tidak tersedia.";

    return (
      <SectionCard icon={FileText} title="Prompt tidak tersedia." description={description}>
        <EmptyState icon={FileText} title="Prompt tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  if (promptPack.status === "ARCHIVED") {
    redirect("/prompts?message=Data%20dihapus.");
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
    notFound();
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
  const promptSet = readPromptOutputSet(promptPack);
  const subtitleInfo = [
    product.product_name,
    `v${promptPack.version}`,
    promptPack.status,
    promptTask?.status ?? "Task belum ada",
  ].join(" - ");

  return (
    <div className="stack">
      <TopbarOverride title="Editor Prompt" subtitle={subtitleInfo} hideSettingsLink />

      {message ? <section className="success-box">{message}</section> : null}
      {errorMessage ? <section className="error-box">{errorMessage}</section> : null}
      {promptTask?.error_message ? <section className="error-box">{promptTask.error_message}</section> : null}
      {promptPack.error_message ? <section className="error-box">{promptPack.error_message}</section> : null}

      <SectionCard icon={FileText} title="Output Siap Copy">
        <PromptOutputFields pack={promptPack} />
        <form className="section-card__actions desktop-action-set" action={savePromptPack}>
          <input type="hidden" name="id" value={promptPack.id} />
          <input type="hidden" name="return_to" value={`/prompts/${promptPack.id}`} />
          <input type="hidden" name="product_id" value={promptPack.product_id} />
          <button className="button compact tertiary" name="intent" type="submit" value="export_prompt_txt">
            <FileUp size={15} aria-hidden="true" />
            Simpan TXT Drive
          </button>
        </form>
        <div className="mobile-action-set">
          <OverflowActionMenu>
            <form action={savePromptPack}>
              <input type="hidden" name="id" value={promptPack.id} />
              <input type="hidden" name="return_to" value={`/prompts/${promptPack.id}`} />
              <input type="hidden" name="product_id" value={promptPack.product_id} />
              <button className="button compact" name="intent" type="submit" value="export_prompt_txt">
                <FileUp size={15} aria-hidden="true" />
                Simpan TXT Drive
              </button>
            </form>
          </OverflowActionMenu>
        </div>
      </SectionCard>

      <SectionCard icon={RefreshCcw} title="Regenerate Prompt">
        <form className="stack" action={savePromptPack}>
          <input type="hidden" name="id" value={promptPack.id} />
          <input type="hidden" name="return_to" value={`/prompts/${promptPack.id}`} />
          <input type="hidden" name="product_id" value={promptPack.product_id} />
          <input type="hidden" name="version" value={promptPack.version} />
          <input type="hidden" name="intake_session_id" value={promptPack.intake_session_id ?? intakeSession?.id ?? ""} />
          <input type="hidden" name="affiliate_profile_id" value={promptPack.affiliate_profile_id ?? affiliateProfile?.id ?? ""} />
          <input type="hidden" name="source_product_image_id" value={promptPack.source_product_image_id ?? sourceImage?.id ?? ""} />
          <HiddenPromptSetFields idPrefix={promptPack.id} promptSet={promptSet} />

          <label className="stack auth-field" htmlFor="revision_instruction">
            <span>Instruksi Revisi</span>
            <textarea id="revision_instruction" name="revision_instruction" rows={3} />
          </label>

          <FormActions layout="pair">
            <Link className="button tertiary" href={`/prompts/${promptPack.id}/history`}>
              <Clock3 size={16} aria-hidden="true" />
              History
            </Link>
            <button className="button primary" name="intent" type="submit" value="regenerate">
              <RefreshCcw size={16} aria-hidden="true" />
              Buat Ulang
            </button>
          </FormActions>
        </form>
      </SectionCard>
    </div>
  );
}
