import nextDynamic from "next/dynamic";
import Link from "next/link";
import { Suspense } from "react";
import { FileText, History as HistoryIcon, WandSparkles } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { ErrorState } from "@/components/operator/error-state";
import { SectionCard } from "@/components/operator/section-card";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { PromptGeneratingState } from "@/components/operator/prompt-generating-state";
import { SkeletonButton, SkeletonLine, SkeletonPromptDetailContent } from "@/components/operator/loading-skeleton";
import { NativeLinkButton } from "@/components/ui/native-button";
import { listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { listIntakeSessions } from "@/lib/server/intake";
import { getProductById, listProductImages } from "@/lib/server/products";
import { listPromptPacks } from "@/lib/server/prompt-packs";
import type { getPromptPackById } from "@/lib/server/prompt-packs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  resolvePromptPackVideoMode,
  type PromptPackGenerationOptionsJson,
} from "@/lib/prompts/prompt-pack-contract";
import { SHARE_ANGLE_LABELS } from "@/lib/share/share-platform";
import { formatAppDateTime } from "@/lib/app-time";
import { savePromptPack } from "./actions";
import { PromptOutputFields } from "./prompt-output-fields";

const PromptGenerateForm = nextDynamic(() => import("./prompt-generate-form").then((mod) => mod.PromptGenerateForm), {
  loading: () => <SkeletonButton />,
});

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

export type PromptDetailTab = "output" | "generate" | "history";

type PromptDetailPanelProps = {
  detailHref: string;
  productId: string;
  selectedTab?: PromptDetailTab;
  selectedVersion?: string | null;
};

const promptDetailTabs: { key: PromptDetailTab; label: string }[] = [
  { key: "output", label: "Output" },
  { key: "generate", label: "Generate" },
  { key: "history", label: "History" },
];

const promptGenerationPendingStatuses = new Set(["QUEUED", "RUNNING", "GENERATING", "WAITING_FOR_KEY", "RETRYING"]);
const promptOutputReadyStatuses = new Set(["GENERATED", "NEEDS_REVIEW", "APPROVED"]);
const promptOutputUnavailableStatuses = new Set(["DRAFT", "QUEUED", "RUNNING", "GENERATING", "WAITING_FOR_KEY", "RETRYING", "ERROR"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPromptGenerationStatusPending(status: string | null | undefined) {
  return Boolean(status && promptGenerationPendingStatuses.has(status));
}

function readGenerationOptions(pack: SiblingPromptPackRecord | PromptPackRecord | null): PromptPackGenerationOptionsJson {
  const personalization = isRecord(pack?.personalization_json) ? pack.personalization_json : {};
  const inputParams = isRecord(pack?.input_params_json) ? pack.input_params_json : {};
  const inputOptions = isRecord(inputParams.generation_options) ? inputParams.generation_options : null;
  const personalizationOptions = isRecord(personalization.generation_options) ? personalization.generation_options : null;
  const options = inputOptions ?? personalizationOptions ?? {};

  return {
    ...(typeof options.vo_enabled === "boolean" ? { vo_enabled: options.vo_enabled } : {}),
    ...(typeof options.vo_length_preset === "string" ? { vo_length_preset: options.vo_length_preset as PromptPackGenerationOptionsJson["vo_length_preset"] } : {}),
    ...(typeof options.video_model === "string" ? { video_model: options.video_model as PromptPackGenerationOptionsJson["video_model"] } : {}),
    video_mode: resolvePromptPackVideoMode(options.video_mode),
  };
}

function hasGeneratedPromptOutput(pack: SiblingPromptPackRecord | PromptPackRecord | null) {
  if (!pack) {
    return false;
  }

  if (promptOutputUnavailableStatuses.has(pack.status)) {
    return false;
  }

  if (promptOutputReadyStatuses.has(pack.status)) {
    return true;
  }

  if (Array.isArray(pack.output_variants_json) && pack.output_variants_json.length > 0) {
    return true;
  }

  return Boolean(pack.i2i_prompts_json && pack.i2v_prompts_json);
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

async function readPromptTask(promptPack: PromptPackRecord | SiblingPromptPackRecord | null, userId: string): Promise<PromptTaskRecord | null> {
  if (!promptPack?.ai_task_id) {
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

function findDefaultIntakeSession(promptPack: PromptPackRecord | SiblingPromptPackRecord | null, intakeSessions: IntakeSessionRecord[]) {
  return promptPack?.intake_session_id
    ? intakeSessions.find((session) => session.id === promptPack.intake_session_id) ?? null
    : intakeSessions.find((session) => session.reviewed_metadata_json || session.status === "REVIEWED") ?? null;
}

function findDefaultSourceImage(promptPack: PromptPackRecord | SiblingPromptPackRecord | null, productImages: ProductImageRecord[]) {
  return promptPack?.source_product_image_id
    ? productImages.find((image) => image.id === promptPack.source_product_image_id) ?? null
    : productImages.find((image) => image.is_primary) ?? productImages[0] ?? null;
}

function findDefaultAffiliateProfile(
  promptPack: PromptPackRecord | SiblingPromptPackRecord | null,
  affiliateProfiles: AffiliateProfileRecord[],
) {
  return promptPack?.affiliate_profile_id
    ? affiliateProfiles.find((profile) => profile.id === promptPack.affiliate_profile_id) ?? null
    : null;
}

type PromptDetailTabContentProps = {
  activeTab: PromptDetailTab;
  detailHref: string;
  productId: string;
  selectedVersion?: string | null;
  userId: string;
};

type PromptDetailPackState = {
  activePromptPacks: SiblingPromptPackRecord[];
  latestPromptPack: SiblingPromptPackRecord | null;
  selectedVersionPack: SiblingPromptPackRecord | null;
  pendingPromptPack: SiblingPromptPackRecord | null;
  displayedPack: SiblingPromptPackRecord | null;
  sourcePackForGenerate: SiblingPromptPackRecord | null;
  isViewingOldVersion: boolean;
};

function resolvePromptDetailPackState(promptPacks: SiblingPromptPackRecord[], selectedVersion: string | null): PromptDetailPackState {
  const activePromptPacks = promptPacks
    .filter((pack) => pack.status !== "ARCHIVED")
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const latestPromptPack = activePromptPacks[0] ?? null;
  const selectedVersionPack = selectedVersion ? activePromptPacks.find((pack) => pack.id === selectedVersion) ?? null : null;
  const pendingPromptPack = activePromptPacks.find((pack) => isPromptGenerationStatusPending(pack.status)) ?? null;
  const displayedPack = selectedVersionPack ?? pendingPromptPack ?? latestPromptPack;
  const sourcePackForGenerate = selectedVersionPack ?? latestPromptPack;

  return {
    activePromptPacks,
    latestPromptPack,
    selectedVersionPack,
    pendingPromptPack,
    displayedPack,
    sourcePackForGenerate,
    isViewingOldVersion: Boolean(selectedVersionPack && latestPromptPack && selectedVersionPack.id !== latestPromptPack.id),
  };
}

function PromptDetailFetchErrorState({ description = "Coba lagi." }: { description?: string }) {
  return (
    <div className="stack">
      <ErrorState icon={FileText} title="Detail prompt tidak tersedia." description={description} />
    </div>
  );
}

function PromptDetailProductUnavailableState() {
  return (
    <SectionCard icon={FileText} title="Produk tidak tersedia.">
      <EmptyState icon={FileText} title="Produk tidak tersedia." description="Produk untuk prompt ini tidak tersedia di workspace aktif." />
    </SectionCard>
  );
}

function PromptDetailStatusBanners({ errorMessage, waitingForKey }: { errorMessage: string | null; waitingForKey: boolean }) {
  return (
    <>
      {errorMessage ? <section className="error-box">{errorMessage}</section> : null}
      {waitingForKey ? (
        <section className="helper-text" role="status">
          Semua Gemini key sedang cooldown atau melebihi kuota. Sistem otomatis mencoba ulang saat generate berjalan.
        </section>
      ) : null}
    </>
  );
}

function PromptDetailOutputLoadingState() {
  return (
    <SectionCard className="prompt-detail-section prompt-detail-section--output" icon={FileText} title="Output Siap Copy">
      <SkeletonPromptDetailContent />
    </SectionCard>
  );
}

function PromptDetailGenerateLoadingState() {
  return (
    <SectionCard className="prompt-detail-section prompt-detail-section--generate" icon={WandSparkles} title="Generate Prompt">
      <div className="stack loading-skeleton-static" aria-hidden="true">
        <div className="share-input-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="share-input-field stack-tight" key={index}>
              <SkeletonLine size="short" />
              <SkeletonLine size="long" />
            </div>
          ))}
          <div className="share-input-field stack-tight">
            <SkeletonLine size="short" />
            <div className="share-input-variant__options">
              {Array.from({ length: 4 }).map((__, index) => (
                <span className="skeleton-pill" key={index} />
              ))}
            </div>
          </div>
        </div>
        <div className="share-input-form__footer">
          <SkeletonButton />
        </div>
      </div>
    </SectionCard>
  );
}

function PromptDetailHistoryLoadingState() {
  return (
    <SectionCard className="prompt-detail-section prompt-detail-section--history" icon={HistoryIcon} title="History Generate">
      <ul className="list prompt-history-list loading-skeleton-static" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <li className="prompt-history-row" key={index}>
            <div className="prompt-history-row__body">
              <SkeletonLine size="medium" />
              <SkeletonLine size="long" />
              <SkeletonLine size="short" />
            </div>
            <div className="prompt-history-row__actions">
              <span className="skeleton-pill" />
              <SkeletonButton />
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function PromptDetailTabLoadingState({ activeTab }: { activeTab: PromptDetailTab }) {
  switch (activeTab) {
    case "generate":
      return <PromptDetailGenerateLoadingState />;
    case "history":
      return <PromptDetailHistoryLoadingState />;
    default:
      return <PromptDetailOutputLoadingState />;
  }
}

function PromptDetailTabContent({ activeTab, detailHref, productId, selectedVersion, userId }: PromptDetailTabContentProps) {
  switch (activeTab) {
    case "generate":
      return (
        <PromptDetailGenerateTab detailHref={detailHref} productId={productId} selectedVersion={selectedVersion ?? null} userId={userId} />
      );
    case "history":
      return (
        <PromptDetailHistoryTab detailHref={detailHref} productId={productId} selectedVersion={selectedVersion ?? null} userId={userId} />
      );
    default:
      return <PromptDetailOutputTab detailHref={detailHref} productId={productId} selectedVersion={selectedVersion ?? null} userId={userId} />;
  }
}

async function PromptDetailOutputTab({
  detailHref,
  productId,
  selectedVersion,
  userId,
}: {
  detailHref: string;
  productId: string;
  selectedVersion: string | null;
  userId: string;
}) {
  let product: ProductRecord | null = null;
  let promptPacks: SiblingPromptPackRecord[] = [];

  try {
    [product, promptPacks] = await Promise.all([getProductById(productId), listPromptPacks({ productId, limit: 200 })]);
  } catch (error) {
    const description = error instanceof Error ? error.message : "Detail prompt tidak tersedia.";
    return <PromptDetailFetchErrorState description={description} />;
  }

  if (!product || product.status === "ARCHIVED") {
    return <PromptDetailProductUnavailableState />;
  }

  const { latestPromptPack, selectedVersionPack, displayedPack, isViewingOldVersion } = resolvePromptDetailPackState(promptPacks, selectedVersion);
  let promptTask: PromptTaskRecord | null = null;

  try {
    promptTask = await readPromptTask(displayedPack, userId);
  } catch (error) {
    const description = error instanceof Error ? error.message : "Detail prompt tidak tersedia.";
    return <PromptDetailFetchErrorState description={description} />;
  }

  const promptErrorMessage = displayedPack?.error_message ?? promptTask?.error_message ?? null;
  const promptTaskStatus = promptTask?.status ?? displayedPack?.status ?? null;
  const isPromptOutputReady = hasGeneratedPromptOutput(displayedPack);
  const isPromptGenerationPending =
    !isPromptOutputReady && (isPromptGenerationStatusPending(promptTaskStatus) || isPromptGenerationStatusPending(displayedPack?.status));
  const isPromptOutputUnavailable = Boolean(displayedPack) && !isPromptOutputReady && !isPromptGenerationPending;
  const isWaitingForKey = promptTaskStatus === "WAITING_FOR_KEY";
  const latestHrefForOutput = buildTabHref(detailHref, "output", null);

  return (
    <section className="stack product-detail-tab-content">
      <PromptDetailStatusBanners errorMessage={promptErrorMessage} waitingForKey={isWaitingForKey} />
      {!displayedPack ? (
        <EmptyState icon={FileText} title="Belum ada output." description="Generate prompt dari tab Generate." />
      ) : (
        <>
          {isViewingOldVersion && selectedVersionPack && latestPromptPack ? (
            <div className="output-version-banner" role="status">
              <span className="output-version-banner__label">
                Versi v{selectedVersionPack.version} - {formatAppDateTime(selectedVersionPack.created_at, "-")}
              </span>
              <Link className="compact" href={latestHrefForOutput}>
                Kembali ke Terbaru
              </Link>
            </div>
          ) : null}

          {isPromptGenerationPending ? (
            <PromptGeneratingState promptPackId={displayedPack.id} />
          ) : isPromptOutputUnavailable ? (
            <EmptyState icon={FileText} title="Output belum tersedia." description="Generate ulang dari tab Generate." />
          ) : (
            <>
              <PromptOutputFields pack={displayedPack} />
              <form className="section-card__actions desktop-action-set" action={savePromptPack}>
                <input type="hidden" name="id" value={displayedPack.id} />
                <input type="hidden" name="return_to" value={detailHref} />
                <input type="hidden" name="product_id" value={displayedPack.product_id} />
                <PendingActionButton className="compact tertiary" pendingLabel="Menyimpan" name="intent" value="export_prompt_txt">
                  Simpan TXT Drive
                </PendingActionButton>
              </form>
              <div className="mobile-action-set">
                <form action={savePromptPack}>
                  <input type="hidden" name="id" value={displayedPack.id} />
                  <input type="hidden" name="return_to" value={detailHref} />
                  <input type="hidden" name="product_id" value={displayedPack.product_id} />
                  <PendingActionButton className="compact tertiary" pendingLabel="Menyimpan" name="intent" value="export_prompt_txt">
                    Simpan TXT Drive
                  </PendingActionButton>
                </form>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

async function PromptDetailGenerateTab({
  detailHref,
  productId,
  selectedVersion,
  userId,
}: {
  detailHref: string;
  productId: string;
  selectedVersion: string | null;
  userId: string;
}) {
  let product: ProductRecord | null = null;
  let promptPacks: SiblingPromptPackRecord[] = [];
  let intakeSessions: IntakeSessionRecord[] = [];
  let productImages: ProductImageRecord[] = [];
  let affiliateProfiles: AffiliateProfileRecord[] = [];

  try {
    [product, promptPacks, intakeSessions, productImages, affiliateProfiles] = await Promise.all([
      getProductById(productId),
      listPromptPacks({ productId, limit: 200 }),
      listIntakeSessions({ productId, limit: 200 }),
      listProductImages({ productId, limit: 200 }),
      listAffiliateProfiles({ limit: 200 }),
    ]);
  } catch (error) {
    const description = error instanceof Error ? error.message : "Detail prompt tidak tersedia.";
    return <PromptDetailFetchErrorState description={description} />;
  }

  if (!product || product.status === "ARCHIVED") {
    return <PromptDetailProductUnavailableState />;
  }

  const { displayedPack, sourcePackForGenerate } = resolvePromptDetailPackState(promptPacks, selectedVersion);
  let promptTask: PromptTaskRecord | null = null;

  try {
    promptTask = await readPromptTask(displayedPack, userId);
  } catch (error) {
    const description = error instanceof Error ? error.message : "Detail prompt tidak tersedia.";
    return <PromptDetailFetchErrorState description={description} />;
  }

  const promptErrorMessage = displayedPack?.error_message ?? promptTask?.error_message ?? null;
  const promptTaskStatus = promptTask?.status ?? displayedPack?.status ?? null;
  const isPromptOutputReady = hasGeneratedPromptOutput(displayedPack);
  const isPromptGenerationPending =
    !isPromptOutputReady && (isPromptGenerationStatusPending(promptTaskStatus) || isPromptGenerationStatusPending(displayedPack?.status));
  const generationOptions = readGenerationOptions(sourcePackForGenerate);
  const intakeSession = findDefaultIntakeSession(sourcePackForGenerate, intakeSessions);
  const affiliateProfile = findDefaultAffiliateProfile(sourcePackForGenerate, affiliateProfiles);
  const sourceImage = findDefaultSourceImage(sourcePackForGenerate, productImages);

  return (
    <section className="stack product-detail-tab-content">
      <PromptDetailStatusBanners errorMessage={promptErrorMessage} waitingForKey={promptTaskStatus === "WAITING_FOR_KEY"} />
      {displayedPack && isPromptGenerationPending ? (
        <PromptGeneratingState promptPackId={displayedPack.id} />
      ) : (
        <PromptGenerateForm
          action={savePromptPack}
          affiliateProfileId={sourcePackForGenerate?.affiliate_profile_id ?? affiliateProfile?.id ?? null}
          angle={sourcePackForGenerate?.angle ?? null}
          intakeSessionId={sourcePackForGenerate?.intake_session_id ?? intakeSession?.id ?? null}
          mode={sourcePackForGenerate ? "regenerate" : "create"}
          productId={product.id}
          promptPackId={sourcePackForGenerate?.id ?? null}
          returnHref={buildTabHref(detailHref, "generate", sourcePackForGenerate?.id ?? null)}
          sourceImageId={sourcePackForGenerate?.source_product_image_id ?? sourceImage?.id ?? null}
          variantCount={sourcePackForGenerate?.variant_count ?? 1}
          videoMode={generationOptions.video_mode}
          voEnabled={generationOptions.vo_enabled}
        />
      )}
    </section>
  );
}

async function PromptDetailHistoryTab({
  detailHref,
  productId,
  selectedVersion,
  userId,
}: {
  detailHref: string;
  productId: string;
  selectedVersion: string | null;
  userId: string;
}) {
  let product: ProductRecord | null = null;
  let promptPacks: SiblingPromptPackRecord[] = [];

  try {
    [product, promptPacks] = await Promise.all([getProductById(productId), listPromptPacks({ productId, limit: 200 })]);
  } catch (error) {
    const description = error instanceof Error ? error.message : "Detail prompt tidak tersedia.";
    return <PromptDetailFetchErrorState description={description} />;
  }

  if (!product || product.status === "ARCHIVED") {
    return <PromptDetailProductUnavailableState />;
  }

  const { activePromptPacks, displayedPack } = resolvePromptDetailPackState(promptPacks, selectedVersion);
  let promptTask: PromptTaskRecord | null = null;

  try {
    promptTask = await readPromptTask(displayedPack, userId);
  } catch (error) {
    const description = error instanceof Error ? error.message : "Detail prompt tidak tersedia.";
    return <PromptDetailFetchErrorState description={description} />;
  }

  const promptErrorMessage = displayedPack?.error_message ?? promptTask?.error_message ?? null;
  const promptTaskStatus = promptTask?.status ?? displayedPack?.status ?? null;
  const isWaitingForKey = promptTaskStatus === "WAITING_FOR_KEY";

  return (
    <section className="stack product-detail-tab-content">
      <PromptDetailStatusBanners errorMessage={promptErrorMessage} waitingForKey={isWaitingForKey} />
      <SectionCard className="prompt-detail-section prompt-detail-section--history" icon={HistoryIcon} title="History Generate">
        {activePromptPacks.length ? (
          <ul className="list prompt-history-list">
            {activePromptPacks.map((pack) => {
              const regenerationNote = readRegenerationNote(pack);
              const meta = [`v${pack.version}`, pack.status, SHARE_ANGLE_LABELS[pack.angle]].filter(Boolean).join(" - ");
              const viewHref = buildTabHref(detailHref, "output", pack.id);

              return (
                <li className="prompt-history-row" data-active={displayedPack?.id === pack.id ? "true" : undefined} key={pack.id}>
                  <div className="prompt-history-row__body">
                    <span className="prompt-history-row__meta">{meta}</span>
                    <strong className="prompt-history-row__note">{regenerationNote || `${pack.variant_count} varian`}</strong>
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
          <EmptyState icon={HistoryIcon} title="Belum ada history." description="Generate pertama akan muncul di sini." />
        )}
      </SectionCard>
    </section>
  );
}

export async function PromptDetailPanel({
  detailHref,
  productId,
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

  const generateVersion = selectedVersion ?? null;

  return (
    <div className="stack operator-detail-panel operator-detail-panel--flush prompt-detail-panel">
      <nav className="tab-nav tab-nav--flush" aria-label="Tab detail prompt">
        {promptDetailTabs.map((tab) => {
          const href = buildTabHref(detailHref, tab.key, tab.key === "generate" ? generateVersion : null);

          return (
            <Link aria-current={selectedTab === tab.key ? "page" : undefined} className="tab-link" data-active={selectedTab === tab.key ? "true" : undefined} href={href} key={tab.key}>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Suspense fallback={<PromptDetailTabLoadingState activeTab={selectedTab} />}>
        <PromptDetailTabContent activeTab={selectedTab} detailHref={detailHref} productId={productId} selectedVersion={selectedVersion} userId={user.id} />
      </Suspense>
    </div>
  );
}
