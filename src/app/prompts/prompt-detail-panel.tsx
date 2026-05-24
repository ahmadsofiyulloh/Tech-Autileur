import Link from "next/link";
import { Clock3, FileText, History as HistoryIcon, RefreshCcw } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { SectionCard } from "@/components/operator/section-card";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { PromptGenerationMonitor } from "@/components/operator/prompt-generation-monitor";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { ToggleField } from "@/components/operator/toggle-field";
import { GeneratingState } from "@/components/operator/generating-state";
import { PromptSkeleton } from "@/components/operator/generating-state-skeletons";
import { NativeLinkButton } from "@/components/ui/native-button";
import { listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { listIntakeSessions } from "@/lib/server/intake";
import { getProductById, listProductImages } from "@/lib/server/products";
import { getPromptPackById, listPromptPacks } from "@/lib/server/prompt-packs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { REGENERATION_SCOPES } from "@/lib/prompts/prompt-regeneration";
import { VIDEO_MODEL_OPTIONS } from "@/lib/prompts/video-model-config";
import { VO_LENGTH_PRESETS } from "@/lib/prompts/vo-length-presets";
import { formatAppDateTime } from "@/lib/app-time";
import { savePromptPack } from "./actions";
import { PromptOutputFields } from "./prompt-output-fields";

type PromptPackRecord = Awaited<ReturnType<typeof getPromptPackById>>;
type ProductRecord = NonNullable<Awaited<ReturnType<typeof getProductById>>>;
type IntakeSessionRecord = Awaited<ReturnType<typeof listIntakeSessions>>[number];
type ProductImageRecord = Awaited<ReturnType<typeof listProductImages>>[number];
type AffiliateProfileRecord = Awaited<ReturnType<typeof listAffiliateProfiles>>[number];
type SiblingPromptPackRecord = Awaited<ReturnType<typeof listPromptPacks>>[number];
type PromptTaskRecord = {
  id: string;
  status: string;
  error_message: string | null;
};

export type PromptDetailTab = "output" | "regenerate" | "history";

type PromptDetailPanelProps = {
  detailHref: string;
  promptPackId: string;
  selectedTab?: PromptDetailTab;
  selectedVersion?: string | null;
};

const PROMPT_STATUS_STAGES = [
  "Memproses permintaan...",
  "Menghubungi Gemini...",
  "Generating prompt...",
  "Masih memproses...",
];

const promptDetailTabs: { key: PromptDetailTab; label: string }[] = [
  { key: "output", label: "Output" },
  { key: "regenerate", label: "Regenerate" },
  { key: "history", label: "History" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readRegenerationNote(pack: SiblingPromptPackRecord) {
  if (!isRecord(pack.personalization_json)) {
    return "";
  }

  const regenerationRequest = pack.personalization_json.regeneration_request;

  if (!isRecord(regenerationRequest)) {
    return "";
  }

  const revisionInstruction = readText(regenerationRequest.revision_instruction);
  const sourceVersion =
    typeof regenerationRequest.source_version === "number"
      ? `v${regenerationRequest.source_version}`
      : "versi sebelumnya";

  return revisionInstruction ? `Dari ${sourceVersion}: ${revisionInstruction}` : "";
}

function buildTabHref(detailHref: string, tab: PromptDetailTab, version?: string | null) {
  const url = new URL(detailHref, "http://placeholder.local");

  if (tab === "output") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", tab);
  }

  if (version) {
    url.searchParams.set("version", version);
  } else {
    url.searchParams.delete("version");
  }

  const search = url.searchParams.toString();
  const path = url.pathname;
  return search ? `${path}?${search}` : path;
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

export async function PromptDetailPanel({
  detailHref,
  promptPackId,
  selectedTab = "output",
  selectedVersion = null,
}: PromptDetailPanelProps) {
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

  // Sibling prompt packs (same prompt_code) for History tab + version resolution.
  let siblingPromptPacks: SiblingPromptPackRecord[] = [];

  try {
    const allPacks = await listPromptPacks({ workspaceId: product.workspace_id, limit: 200 });
    siblingPromptPacks = allPacks
      .filter((pack) => pack.prompt_code === promptPack.prompt_code && pack.status !== "ARCHIVED")
      .sort((left, right) => {
        if (left.version !== right.version) {
          return right.version - left.version;
        }
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
  } catch {
    siblingPromptPacks = [];
  }

  // Resolve which prompt pack to show on Output tab (selectedVersion may point to a sibling).
  let displayedPack = promptPack;
  let isViewingOldVersion = false;

  if (selectedVersion && selectedVersion !== promptPack.id) {
    const sibling = siblingPromptPacks.find((pack) => pack.id === selectedVersion);

    if (sibling) {
      displayedPack = sibling as PromptPackRecord;
      isViewingOldVersion = true;
    }
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
  const isWaitingForKey = promptTaskStatus === "WAITING_FOR_KEY";

  const effectiveTab: PromptDetailTab = selectedTab;
  const latestHrefForOutput = buildTabHref(detailHref, "output", null);

  return (
    <div className="stack operator-detail-panel operator-detail-panel--flush prompt-detail-panel">
      {promptErrorMessage ? <section className="error-box">{promptErrorMessage}</section> : null}

      {isWaitingForKey ? (
        <section className="helper-text" role="status">
          Semua Gemini key sedang cooldown atau melebihi kuota. Sistem otomatis mencoba ulang setiap 15 detik untuk mencari key yang eligible.
        </section>
      ) : null}

      {isPromptGenerationPending ? <PromptGenerationMonitor enabled promptPackId={promptPack.id} /> : null}

      <nav className="tab-nav tab-nav--flush" aria-label="Tab detail prompt">
        {promptDetailTabs.map((tab) => {
          const href = buildTabHref(detailHref, tab.key, null);
          return (
            <Link
              aria-current={effectiveTab === tab.key ? "page" : undefined}
              className="tab-link"
              data-active={effectiveTab === tab.key ? "true" : undefined}
              href={href}
              key={tab.key}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {effectiveTab === "output" ? (
        <SectionCard className="prompt-detail-section prompt-detail-section--output" icon={FileText} title="Output Siap Copy">
          {isViewingOldVersion ? (
            <div className="output-version-banner" role="status">
              <span className="output-version-banner__label">
                Versi v{displayedPack.version} - {formatAppDateTime(displayedPack.created_at, "-")}
              </span>
              <Link className="compact" href={latestHrefForOutput}>
                Kembali ke Terbaru
              </Link>
            </div>
          ) : null}

          {isPromptGenerationPending && !isViewingOldVersion ? (
            <GeneratingState
              skeleton={<PromptSkeleton />}
              statusStages={PROMPT_STATUS_STAGES}
            />
          ) : (
            <>
              <PromptOutputFields pack={displayedPack} />
              <form className="section-card__actions desktop-action-set" action={savePromptPack}>
                <input type="hidden" name="id" value={displayedPack.id} />
                <input type="hidden" name="return_to" value={detailHref} />
                <input type="hidden" name="product_id" value={displayedPack.product_id} />
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
                  <input type="hidden" name="id" value={displayedPack.id} />
                  <input type="hidden" name="return_to" value={detailHref} />
                  <input type="hidden" name="product_id" value={displayedPack.product_id} />
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
      ) : null}

      {effectiveTab === "regenerate" ? (
        <SectionCard className="prompt-detail-section prompt-detail-section--regenerate" icon={RefreshCcw} title="Regenerate Prompt">
          {isPromptGenerationPending ? (
            <GeneratingState
              skeleton={<PromptSkeleton />}
              statusStages={PROMPT_STATUS_STAGES}
            />
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

              <RelationalPicker
                label="Model Generator"
                name="video_model"
                options={VIDEO_MODEL_OPTIONS.map((m) => ({
                  value: m.key,
                  label: m.label,
                  description: m.description,
                }))}
                defaultValue="veo-3.1"
                searchable={false}
              />

              <ToggleField
                label="Sertakan Voiceover"
                name="vo_enabled"
                defaultChecked={true}
                helperText="Nonaktifkan untuk prompt tanpa dialog/narasi"
              />

              <RelationalPicker
                label="Panjang Voiceover"
                name="vo_length_preset"
                options={VO_LENGTH_PRESETS.map((p) => ({
                  value: p.key,
                  label: p.label,
                  description: p.description,
                }))}
                defaultValue="medium"
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
      ) : null}

      {effectiveTab === "history" ? (
        <SectionCard className="prompt-detail-section prompt-detail-section--history" icon={HistoryIcon} title="History Generate">
          {siblingPromptPacks.length ? (
            <ul className="list prompt-history-list">
              {siblingPromptPacks.map((pack) => {
                const regenerationNote = readRegenerationNote(pack);
                const meta = [`v${pack.version}`, pack.status].filter(Boolean).join(" - ");
                const viewHref = buildTabHref(detailHref, "output", pack.id);

                return (
                  <li className="prompt-history-row" key={pack.id}>
                    <div className="prompt-history-row__body">
                      <span className="prompt-history-row__meta">{meta}</span>
                      <strong className="prompt-history-row__note">{regenerationNote || "Generate awal"}</strong>
                      <span className="prompt-history-row__date">{formatAppDateTime(pack.created_at, "-")}</span>
                    </div>
                    <div className="prompt-history-row__actions">
                      <NativeLinkButton className="compact prompt-history-row__action" href={viewHref}>
                        Lihat
                      </NativeLinkButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={HistoryIcon} title="Belum ada history." description="Versi prompt belum tersedia." />
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
