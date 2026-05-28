import { ArrowLeft, ArrowRight, FileText, Package, Plus } from "lucide-react";
import { OperatorDetailDrawer } from "@/components/operator/detail-drawer";
import { EmptyState } from "@/components/operator/empty-state";
import { ErrorState } from "@/components/operator/error-state";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton, NativeLinkButton } from "@/components/ui/native-button";
import { listDriveItemsByIds } from "@/lib/server/drive-items";
import { listPromptReadinessProjections } from "@/lib/server/prompt-readiness";
import { listPromptWorkbenchPageForUser, withPromptWorkbenchActivity } from "@/lib/server/prompt-workbench";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROMPT_WORKBENCH_PAGE_SIZE, type PromptWorkbenchReadinessFilter } from "@/lib/prompts/prompt-workbench";
import { PromptDetailPanel, type PromptDetailTab } from "./prompt-detail-panel";
import { PromptWorkbenchList, type PromptWorkbenchRowData } from "./prompt-workbench-list";
import { buildCompactPageNumbers, buildProductContinueHref, buildPromptsHref } from "./prompt-workbench-links";

type GeminiKeyRecord = {
  id: string;
  label: string;
  model_name: string;
};

type PromptTaskRecord = {
  id: string;
  status: string;
  error_message: string | null;
  gemini_api_key_id: string | null;
};

type SelectedPromptPackRecord = {
  id: string;
  product_id: string;
  version: number;
  status: string;
  ai_task_id: string | null;
};

type PromptWorkbenchPageResult = Awaited<ReturnType<typeof listPromptWorkbenchPageForUser>>;
type PromptReadinessRow = PromptWorkbenchPageResult["rows"][number];

type PromptPaginationStepperProps = {
  affiliateProfileId?: string | null;
  intakeId?: string | null;
  pageData: PromptWorkbenchPageResult;
  productId?: string | null;
  readiness: PromptWorkbenchReadinessFilter;
  search: string;
};

type PromptWorkbenchSectionProps = {
  userId: string;
  affiliateProfileId?: string | null;
  detailId?: string | null;
  intakeId?: string | null;
  page: number;
  productId?: string | null;
  readiness: PromptWorkbenchReadinessFilter;
  search: string;
  selectedTab: PromptDetailTab;
  selectedVersion?: string | null;
};

function PromptPaginationStepper({
  affiliateProfileId,
  intakeId,
  pageData,
  productId,
  readiness,
  search,
}: PromptPaginationStepperProps) {
  const pageItems = buildCompactPageNumbers(pageData.page, pageData.totalPages);

  return (
    <nav className="list-pagination-stepper prompt-workbench-footer-pagination" aria-label="Navigasi halaman prompt">
      <div className="list-pagination-stepper__status">
        <StatusBadge status={`Halaman ${pageData.page}/${pageData.totalPages}`} tone="neutral" />
      </div>
      <div className="list-pagination-stepper__controls">
        {pageData.hasPreviousPage ? (
          <NativeLinkButton
            className="compact tertiary"
            href={buildPromptsHref({
              affiliateProfileId,
              intakeId,
              page: Math.max(pageData.page - 1, 1),
              productId,
              readiness,
              search,
            })}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Sebelumnya
          </NativeLinkButton>
        ) : (
          <NativeButton className="compact tertiary" type="button" disabled>
            <ArrowLeft size={15} aria-hidden="true" />
            Sebelumnya
          </NativeButton>
        )}

        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <span className="list-pagination-stepper__ellipsis" aria-hidden="true" key={`ellipsis-${index}`}>
              ...
            </span>
          ) : item === pageData.page ? (
            <NativeButton className="compact primary" type="button" aria-current="page" disabled key={item}>
              {item}
            </NativeButton>
          ) : (
            <NativeLinkButton
              className="compact tertiary"
              href={buildPromptsHref({
                affiliateProfileId,
                intakeId,
                page: item,
                productId,
                readiness,
                search,
              })}
              key={item}
            >
              {item}
            </NativeLinkButton>
          ),
        )}

        {pageData.hasNextPage ? (
          <NativeLinkButton
            className="compact tertiary"
            href={buildPromptsHref({
              affiliateProfileId,
              intakeId,
              page: pageData.page + 1,
              productId,
              readiness,
              search,
            })}
          >
            Berikutnya
            <ArrowRight size={15} aria-hidden="true" />
          </NativeLinkButton>
        ) : (
          <NativeButton className="compact tertiary" type="button" disabled>
            Berikutnya
            <ArrowRight size={15} aria-hidden="true" />
          </NativeButton>
        )}
      </div>
    </nav>
  );
}

async function loadSelectedPromptPack(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  promptPackId: string,
) {
  const { data, error } = await supabase
    .from("prompt_packs")
    .select("id, product_id, version, status, ai_task_id")
    .eq("id", promptPackId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.status === "ARCHIVED") {
    return null;
  }

  return data as SelectedPromptPackRecord;
}

async function loadSelectedIntakeProductId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  intakeId: string,
) {
  const { data, error } = await supabase
    .from("product_intake_sessions")
    .select("product_id")
    .eq("id", intakeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.product_id === "string" && data.product_id.trim() ? data.product_id.trim() : null;
}

export async function PromptWorkbenchSection({
  userId,
  affiliateProfileId,
  detailId,
  intakeId,
  page,
  productId,
  readiness,
  search,
  selectedTab,
  selectedVersion,
}: PromptWorkbenchSectionProps) {
  const supabase = await createSupabaseServerClient();
  const requestedDetailId = detailId?.trim() || "";
  let promptPage: PromptWorkbenchPageResult | null = null;
  let legacySelectedPromptPack: SelectedPromptPackRecord | null = null;
  let requestedIntakeProductId: string | null = null;

  try {
    [promptPage, legacySelectedPromptPack, requestedIntakeProductId] = await Promise.all([
      listPromptWorkbenchPageForUser(
        userId,
        {
          readiness,
          search,
          page,
          pageSize: PROMPT_WORKBENCH_PAGE_SIZE,
        },
        supabase,
      ),
      requestedDetailId ? loadSelectedPromptPack(supabase, userId, requestedDetailId) : Promise.resolve(null),
      intakeId ? loadSelectedIntakeProductId(supabase, userId, intakeId) : Promise.resolve(null),
    ]);
  } catch {
    return <ErrorState icon={FileText} title="Paket Prompt tidak tersedia." />;
  }

  if (!promptPage) {
    return <ErrorState icon={FileText} title="Paket Prompt tidak tersedia." />;
  }

  const promptPageData = promptPage;
  const affiliateProfileMap = new Map(promptPageData.affiliateProfiles.map((profile) => [profile.id, profile]));
  const requestedAffiliateProfile =
    affiliateProfileId && affiliateProfileMap.has(affiliateProfileId) ? affiliateProfileMap.get(affiliateProfileId) ?? null : null;

  const requestedDetailProductId = legacySelectedPromptPack?.product_id ?? (requestedDetailId.trim() || null);
  const selectedProductId = requestedDetailProductId ?? productId ?? requestedIntakeProductId ?? null;
  let visiblePromptReadinessRows: PromptReadinessRow[] = [...promptPageData.rows];
  let selectedSpotlightRows: PromptReadinessRow[] = [];

  const setupProductIds = selectedProductId ? [selectedProductId] : [];
  const missingSetupProductIds = setupProductIds.filter(
    (productKey) => !visiblePromptReadinessRows.some((row) => row.product.id === productKey),
  );

  if (missingSetupProductIds.length) {
    const selectedRows = await listPromptReadinessProjections({
      affiliateProfileContext: {
        defaultAffiliateProfile: promptPageData.currentAffiliateProfile,
        affiliateProfiles: promptPageData.affiliateProfiles,
      },
      workspaceId: promptPageData.workspaceId,
      productIds: missingSetupProductIds,
      limit: missingSetupProductIds.length,
    });

    selectedSpotlightRows = selectedRows.map(withPromptWorkbenchActivity);

    if (selectedSpotlightRows.length) {
      visiblePromptReadinessRows = [...selectedSpotlightRows, ...visiblePromptReadinessRows];
    }
  }

  const currentAffiliateProfileLabel = promptPageData.currentAffiliateProfile?.profile_name ?? "Belum ada profile aktif";
  const currentWorkspaceLabel = promptPageData.workspaceLabel ?? "Workspace aktif";
  const promptTaskIds = Array.from(
    new Set([
      ...visiblePromptReadinessRows.map((row) => row.promptPack?.ai_task_id).filter((value): value is string => Boolean(value)),
    ]),
  );

  const driveItemIds = Array.from(
    new Set(visiblePromptReadinessRows.map((row) => row.sourceImage?.drive_item_ref_id).filter((value): value is string => Boolean(value))),
  );

  const [promptTaskResult, driveItems] = await Promise.all([
    promptTaskIds.length
      ? supabase
          .from("ai_tasks")
          .select("id, status, error_message, gemini_api_key_id")
          .eq("user_id", userId)
          .in("id", promptTaskIds)
      : Promise.resolve({ data: [], error: null }),
    driveItemIds.length ? listDriveItemsByIds(driveItemIds) : Promise.resolve([]),
  ]);

  if (promptTaskResult.error) {
    return <ErrorState icon={FileText} title="Paket Prompt tidak tersedia." />;
  }

  const promptTaskRows = (promptTaskResult.data ?? []) as PromptTaskRecord[];
  const geminiKeyIds = Array.from(
    new Set(promptTaskRows.map((task) => task.gemini_api_key_id).filter((value): value is string => Boolean(value))),
  );
  const geminiKeyResult = geminiKeyIds.length
    ? await supabase.from("gemini_api_keys").select("id, label, model_name").eq("user_id", userId).in("id", geminiKeyIds)
    : { data: [], error: null };

  if (geminiKeyResult.error) {
    return <ErrorState icon={FileText} title="Paket Prompt tidak tersedia." />;
  }

  const geminiKeys = (geminiKeyResult.data ?? []) as GeminiKeyRecord[];
  const geminiKeyMap = new Map(geminiKeys.map((key) => [key.id, key]));
  const promptTaskMap = new Map(
    promptTaskRows.map((task) => [
      task.id,
      {
        status: task.status,
        error_message: task.error_message,
        gemini_api_key_id: task.gemini_api_key_id,
        gemini_key_label: task.gemini_api_key_id ? geminiKeyMap.get(task.gemini_api_key_id)?.label ?? null : null,
      },
    ]),
  );

  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));

  const displayedPromptProduct = selectedProductId
    ? visiblePromptReadinessRows.find((row) => row.product.id === selectedProductId)?.product ??
      selectedSpotlightRows.find((row) => row.product.id === selectedProductId)?.product ??
      null
    : null;
  const promptsCloseHref = buildPromptsHref({
    affiliateProfileId,
    intakeId,
    page: promptPageData.page,
    productId,
    readiness,
    search,
  });
  const promptDetailHref = requestedDetailProductId
    ? buildPromptsHref({
        affiliateProfileId,
        detailId: requestedDetailProductId,
        intakeId,
        page: promptPageData.page,
        productId,
        readiness,
        search,
      })
    : promptsCloseHref;

  const workbenchRows: PromptWorkbenchRowData[] = visiblePromptReadinessRows.map((row) => {
    const promptPack = row.promptPack ?? null;
    const intakeSession = row.intakeSession ?? null;
    const affiliateProfile = promptPack?.affiliate_profile_id
      ? affiliateProfileMap.get(promptPack.affiliate_profile_id) ?? null
      : requestedAffiliateProfile ?? promptPageData.currentAffiliateProfile;
    const sourceImage = row.sourceImage ?? null;
    const sourceImageDriveItem = sourceImage?.drive_item_ref_id ? driveItemMap.get(sourceImage.drive_item_ref_id) ?? null : null;
    const generationTask = promptPack?.ai_task_id ? promptTaskMap.get(promptPack.ai_task_id) ?? null : null;
    const rowPromptDetailHref = buildPromptsHref({
      affiliateProfileId,
      detailId: row.product.id,
      intakeId,
      page: promptPageData.page,
      productId,
      readiness,
      search,
    });
    const rowPromptGenerateHref = buildPromptsHref({
      affiliateProfileId,
      detailId: row.product.id,
      intakeId,
      page: promptPageData.page,
      productId,
      readiness,
      search,
      tab: "generate",
    });
    const rowPromptHistoryHref = buildPromptsHref({
      affiliateProfileId,
      detailId: row.product.id,
      intakeId,
      page: promptPageData.page,
      productId,
      readiness,
      search,
      tab: "history",
    });
    const productDetailSearchParams = new URLSearchParams({ detail: row.product.id, tab: "metadata" });
    productDetailSearchParams.set("q", row.product.product_name);

    if (affiliateProfileId) {
      productDetailSearchParams.set("affiliate_profile_id", affiliateProfileId);
    }

    return {
      product: row.product,
      latest_activity_at: row.latest_activity_at,
      latest_activity_label: row.latest_activity_label,
      workspaceName: currentWorkspaceLabel,
      promptPack,
      intakeSession,
      affiliateProfile,
      sourceImage,
      sourceImageDriveItem,
      generationTask,
      promptReadiness: row,
      defaultAffiliateProfileName: currentAffiliateProfileLabel,
      productContinueHref: buildProductContinueHref({
        affiliateProfileId,
        intakeSessionId: intakeSession?.id,
      }),
      productDetailHref: `/products?${productDetailSearchParams.toString()}`,
      promptDetailHref: rowPromptDetailHref,
      promptGenerateHref: rowPromptGenerateHref,
      promptHistoryHref: rowPromptHistoryHref,
      returnHref: promptsCloseHref,
      isOpen: requestedDetailProductId === row.product.id,
    };
  });

  const selectedPromptRow = requestedDetailProductId
    ? workbenchRows.find((row) => row.product.id === requestedDetailProductId) ?? null
    : null;
  const selectedPromptTask = selectedPromptRow?.generationTask ?? null;
  const promptDetailSubtitle = selectedPromptRow?.promptPack
    ? [`v${selectedPromptRow.promptPack.version}`, selectedPromptRow.promptPack.status, selectedPromptTask?.status ?? "Task belum ada"].join(" - ")
    : "Generate prompt";

  return (
    <>
      <section className="stack" aria-label="Paket Prompt">
        {visiblePromptReadinessRows.length ? (
          <>
            <PromptWorkbenchList
              affiliateProfileId={affiliateProfileId}
              intakeId={intakeId}
              pagination={{
                page: promptPageData.page,
                pageSize: promptPageData.pageSize,
                totalCount: promptPageData.totalCount,
                totalPages: promptPageData.totalPages,
                hasPreviousPage: promptPageData.hasPreviousPage,
                hasNextPage: promptPageData.hasNextPage,
              }}
              productId={productId}
              readiness={readiness}
              rows={workbenchRows}
              search={search}
            />
            <PromptPaginationStepper
              affiliateProfileId={affiliateProfileId}
              intakeId={intakeId}
              pageData={promptPageData}
              productId={productId}
              readiness={readiness}
              search={search}
            />
          </>
        ) : (
          <EmptyState
            icon={Package}
            title={search ? "Prompt tidak ditemukan." : "Produk belum ada."}
            description={search ? "Coba kata kunci lain." : "Buat produk dulu."}
            action={
              search ? null : (
                <NativeLinkButton className="primary" href="/products/new">
                  <Plus size={16} aria-hidden="true" />
                  Produk Baru
                </NativeLinkButton>
              )
            }
          />
        )}
      </section>

      {requestedDetailProductId ? (
        <OperatorDetailDrawer
          ariaLabel="Detail prompt"
          closeHref={promptsCloseHref}
          subtitle={promptDetailSubtitle}
          title={displayedPromptProduct?.product_name ?? "Detail prompt"}
        >
          <PromptDetailPanel
            detailHref={promptDetailHref}
            productId={requestedDetailProductId}
            selectedTab={selectedTab}
            selectedVersion={selectedVersion}
          />
        </OperatorDetailDrawer>
      ) : null}
    </>
  );
}
