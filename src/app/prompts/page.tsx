import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText, Package, Plus, Search } from "lucide-react";
import { OperatorDetailDrawer } from "@/components/operator/detail-drawer";
import { EmptyState } from "@/components/operator/empty-state";
import { ErrorState } from "@/components/operator/error-state";
import { SearchInput } from "@/components/operator/search-input";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton, NativeLinkButton } from "@/components/ui/native-button";
import { getDefaultAffiliateProfileForWorkspace, listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { listDriveItemsByIds } from "@/lib/server/drive-items";
import { listPromptWorkbenchPage, withPromptWorkbenchActivity } from "@/lib/server/prompt-workbench";
import { listPromptReadinessProjections } from "@/lib/server/prompt-readiness";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
import {
  normalizePromptWorkbenchPage,
  normalizePromptWorkbenchReadinessFilter,
  normalizePromptWorkbenchSearch,
  PROMPT_WORKBENCH_PAGE_SIZE,
  PROMPT_WORKBENCH_READINESS_FILTERS,
  type PromptWorkbenchReadinessFilter,
} from "@/lib/prompts/prompt-workbench";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PromptDetailPanel, type PromptDetailTab } from "./prompt-detail-panel";
import { PromptWorkbenchList, type PromptWorkbenchRowData } from "./prompt-workbench-list";

export const dynamic = "force-dynamic";

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
type PromptWorkbenchPageResult = Awaited<ReturnType<typeof listPromptWorkbenchPage>>;
type PromptReadinessRow = PromptWorkbenchPageResult["rows"][number];

type PromptsPageProps = {
  searchParams: Promise<{
    affiliate_profile_id?: string | string[];
    detail?: string | string[];
    intake_id?: string | string[];
    page?: string | string[];
    product_id?: string | string[];
    q?: string | string[];
    readiness?: string | string[];
    tab?: string | string[];
    version?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildPromptsHref(params: {
  affiliateProfileId?: string | null;
  detailId?: string | null;
  intakeId?: string | null;
  page?: number | null;
  productId?: string | null;
  readiness?: PromptWorkbenchReadinessFilter | null;
  search?: string | null;
  tab?: PromptDetailTab | null;
  version?: string | null;
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

  if (params.tab && params.tab !== "output") {
    searchParams.set("tab", params.tab);
  }

  if (params.version) {
    searchParams.set("version", params.version);
  }

  if (params.readiness && params.readiness !== "ALL") {
    searchParams.set("readiness", params.readiness);
  }

  if (params.search) {
    searchParams.set("q", params.search);
  }

  if (params.page && params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  const queryString = searchParams.toString();
  return queryString ? `/prompts?${queryString}` : "/prompts";
}

function buildProductContinueHref(params: { affiliateProfileId?: string | null; intakeSessionId?: string | null }) {
  if (!params.intakeSessionId) {
    return null;
  }

  const searchParams = new URLSearchParams({
    intake_id: params.intakeSessionId,
    step: "prompt",
  });

  if (params.affiliateProfileId) {
    searchParams.set("affiliate_profile_id", params.affiliateProfileId);
  }

  return `/products/new?${searchParams.toString()}`;
}

function buildCompactPageNumbers(page: number, totalPages: number) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= totalPages));
  const sortedPages = Array.from(pages).sort((left, right) => left - right);
  const items: Array<number | "ellipsis"> = [];

  for (const targetPage of sortedPages) {
    const previous = items[items.length - 1];

    if (typeof previous === "number" && targetPage - previous > 1) {
      items.push("ellipsis");
    }

    items.push(targetPage);
  }

  return items;
}

function PromptPaginationStepper({
  affiliateProfileId,
  intakeId,
  pageData,
  productId,
  readiness,
  search,
}: {
  affiliateProfileId?: string | null;
  intakeId?: string | null;
  pageData: PromptWorkbenchPageResult;
  productId?: string | null;
  readiness: PromptWorkbenchReadinessFilter;
  search: string;
}) {
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

async function loadSelectedPromptPack(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, promptPackId: string) {
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

async function loadSelectedIntakeProductId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, intakeId: string) {
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
  const requestedDetailId = firstParam(query.detail) ?? "";
  const requestedReadiness = normalizePromptWorkbenchReadinessFilter(firstParam(query.readiness));
  const requestedProductId = firstParam(query.product_id);
  const requestedIntakeId = firstParam(query.intake_id);
  const requestedSearch = normalizePromptWorkbenchSearch(firstParam(query.q));
  const requestedPage = normalizePromptWorkbenchPage(firstParam(query.page));
  const requestedTab = ((): PromptDetailTab => {
    const raw = firstParam(query.tab)?.trim().toLowerCase();
    if (raw === "generate" || raw === "regenerate") return "generate";
    if (raw === "history") return "history";
    return "output";
  })();
  const requestedVersion = firstParam(query.version)?.trim() || null;
  const currentWorkspace = await getCurrentWorkspace();
  const workspaceId = currentWorkspace?.id ?? undefined;

  let promptPage: PromptWorkbenchPageResult | null = null;
  let affiliateProfiles: Awaited<ReturnType<typeof listAffiliateProfiles>> = [];
  let currentAffiliateProfile: Awaited<ReturnType<typeof getDefaultAffiliateProfileForWorkspace>> | null = null;
  let legacySelectedPromptPack: SelectedPromptPackRecord | null = null;
  let requestedIntakeProductId: string | null = null;

  try {
    [promptPage, affiliateProfiles, currentAffiliateProfile, legacySelectedPromptPack, requestedIntakeProductId] = await Promise.all([
      listPromptWorkbenchPage({
        workspaceId,
        readiness: requestedReadiness,
        search: requestedSearch,
        page: requestedPage,
        pageSize: PROMPT_WORKBENCH_PAGE_SIZE,
      }),
      listAffiliateProfiles({ workspaceId, status: "ACTIVE", limit: 200 }),
      getDefaultAffiliateProfileForWorkspace(workspaceId ?? null),
      requestedDetailId ? loadSelectedPromptPack(supabase, user.id, requestedDetailId) : Promise.resolve(null),
      requestedIntakeId ? loadSelectedIntakeProductId(supabase, user.id, requestedIntakeId) : Promise.resolve(null),
    ]);
  } catch {
    return <ErrorState icon={FileText} title="Paket Prompt tidak tersedia." />;
  }

  if (!promptPage) {
    return <ErrorState icon={FileText} title="Paket Prompt tidak tersedia." />;
  }

  const promptPageData = promptPage;

  const affiliateProfileMap = new Map(affiliateProfiles.map((profile) => [profile.id, profile]));
  const requestedAffiliateProfile =
    requestedAffiliateProfileId && affiliateProfileMap.has(requestedAffiliateProfileId)
      ? affiliateProfileMap.get(requestedAffiliateProfileId) ?? null
      : null;

  const requestedDetailProductId = legacySelectedPromptPack?.product_id ?? (requestedDetailId.trim() || null);
  const selectedProductId = requestedDetailProductId ?? requestedProductId ?? requestedIntakeProductId ?? null;
  let visiblePromptReadinessRows: PromptReadinessRow[] = [...promptPageData.rows];
  let selectedSpotlightRows: PromptReadinessRow[] = [];

  const setupProductIds = selectedProductId ? [selectedProductId] : [];
  const missingSetupProductIds = setupProductIds.filter(
    (productId) => !visiblePromptReadinessRows.some((row) => row.product.id === productId),
  );

  if (missingSetupProductIds.length) {
    const selectedRows = await listPromptReadinessProjections({
      affiliateProfileContext: {
        defaultAffiliateProfile: currentAffiliateProfile,
        affiliateProfiles,
      },
      workspaceId,
      productIds: missingSetupProductIds,
      limit: missingSetupProductIds.length,
    });

    selectedSpotlightRows = selectedRows.map(withPromptWorkbenchActivity);

    if (selectedSpotlightRows.length) {
      visiblePromptReadinessRows = [...selectedSpotlightRows, ...visiblePromptReadinessRows];
    }
  }

  const promptReadinessCounts = promptPageData.counts;
  const visiblePromptRows = visiblePromptReadinessRows;

  const currentAffiliateProfileLabel = currentAffiliateProfile?.profile_name ?? "Belum ada profile aktif";
  const currentWorkspaceLabel = currentWorkspace?.workspace_name ?? "Workspace aktif";
  const hasDetailPanel = Boolean(requestedDetailProductId);

  const promptTaskIds = Array.from(
    new Set([
      ...visiblePromptReadinessRows.map((row) => row.promptPack?.ai_task_id).filter((value): value is string => Boolean(value)),
    ]),
  );

  const promptTaskResult = promptTaskIds.length
    ? await supabase
        .from("ai_tasks")
        .select("id, status, error_message, gemini_api_key_id")
        .eq("user_id", user.id)
        .in("id", promptTaskIds)
    : { data: [], error: null };

  if (promptTaskResult.error) {
    return <ErrorState icon={FileText} title="Paket Prompt tidak tersedia." />;
  }

  const promptTaskRows = (promptTaskResult.data ?? []) as PromptTaskRecord[];
  const geminiKeyIds = Array.from(
    new Set(promptTaskRows.map((task) => task.gemini_api_key_id).filter((value): value is string => Boolean(value))),
  );
  const geminiKeyResult = geminiKeyIds.length
    ? await supabase.from("gemini_api_keys").select("id, label, model_name").eq("user_id", user.id).in("id", geminiKeyIds)
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

  const driveItemIds = Array.from(
    new Set(visiblePromptReadinessRows.map((row) => row.sourceImage?.drive_item_ref_id).filter((value): value is string => Boolean(value))),
  );
  const driveItems = driveItemIds.length ? await listDriveItemsByIds(driveItemIds) : [];
  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));

  const displayedPromptProduct = selectedProductId
    ? visiblePromptReadinessRows.find((row) => row.product.id === selectedProductId)?.product ??
      selectedSpotlightRows.find((row) => row.product.id === selectedProductId)?.product ??
      null
    : null;
  const promptsCloseHref = buildPromptsHref({
    affiliateProfileId: requestedAffiliateProfileId,
    intakeId: requestedIntakeId,
    page: promptPageData.page,
    productId: requestedProductId,
    readiness: requestedReadiness,
    search: requestedSearch,
  });
  const promptDetailHref = requestedDetailProductId
    ? buildPromptsHref({
        affiliateProfileId: requestedAffiliateProfileId,
        detailId: requestedDetailProductId,
        intakeId: requestedIntakeId,
        page: promptPageData.page,
        productId: requestedProductId,
        readiness: requestedReadiness,
        search: requestedSearch,
      })
    : promptsCloseHref;

  const workbenchRows: PromptWorkbenchRowData[] = visiblePromptReadinessRows.map((row) => {
    const promptPack = row.promptPack ?? null;
    const intakeSession = row.intakeSession ?? null;
    const affiliateProfile = promptPack?.affiliate_profile_id
      ? affiliateProfileMap.get(promptPack.affiliate_profile_id) ?? null
      : requestedAffiliateProfile ?? currentAffiliateProfile;
    const sourceImage = row.sourceImage ?? null;
    const sourceImageDriveItem = sourceImage?.drive_item_ref_id ? driveItemMap.get(sourceImage.drive_item_ref_id) ?? null : null;
    const generationTask = promptPack?.ai_task_id ? promptTaskMap.get(promptPack.ai_task_id) ?? null : null;
    const rowPromptDetailHref = buildPromptsHref({
      affiliateProfileId: requestedAffiliateProfileId,
      detailId: row.product.id,
      intakeId: requestedIntakeId,
      page: promptPageData.page,
      productId: requestedProductId,
      readiness: requestedReadiness,
      search: requestedSearch,
    });
    const rowPromptGenerateHref = buildPromptsHref({
      affiliateProfileId: requestedAffiliateProfileId,
      detailId: row.product.id,
      intakeId: requestedIntakeId,
      page: promptPageData.page,
      productId: requestedProductId,
      readiness: requestedReadiness,
      search: requestedSearch,
      tab: "generate",
    });
    const rowPromptHistoryHref = buildPromptsHref({
      affiliateProfileId: requestedAffiliateProfileId,
      detailId: row.product.id,
      intakeId: requestedIntakeId,
      page: promptPageData.page,
      productId: requestedProductId,
      readiness: requestedReadiness,
      search: requestedSearch,
      tab: "history",
    });
    const productDetailSearchParams = new URLSearchParams({ detail: row.product.id, tab: "metadata" });
    productDetailSearchParams.set("q", row.product.product_name);

    if (requestedAffiliateProfileId) {
      productDetailSearchParams.set("affiliate_profile_id", requestedAffiliateProfileId);
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
        affiliateProfileId: requestedAffiliateProfileId,
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

  const clearSearchHref = buildPromptsHref({
    affiliateProfileId: requestedAffiliateProfileId,
    intakeId: requestedIntakeId,
    page: 1,
    productId: requestedProductId,
    readiness: requestedReadiness,
  });
  return (
    <div className="operator-detail-layout" data-has-detail={hasDetailPanel ? "true" : undefined}>
      <div className="operator-detail-layout__list stack prompt-page-stack">
        <form className="settings-list-toolbar prompt-workbench-search-toolbar" action="/prompts" method="get">
          {requestedAffiliateProfileId ? <input type="hidden" name="affiliate_profile_id" value={requestedAffiliateProfileId} /> : null}
          {requestedProductId ? <input type="hidden" name="product_id" value={requestedProductId} /> : null}
          {requestedIntakeId ? <input type="hidden" name="intake_id" value={requestedIntakeId} /> : null}
          {requestedReadiness !== "ALL" ? <input type="hidden" name="readiness" value={requestedReadiness} /> : null}
          <input type="hidden" name="page" value="1" />
          <SearchInput
            className="prompt-workbench-search"
            id="prompt-workbench-search"
            name="q"
            label="Cari produk"
            placeholder="Cari produk"
            defaultValue={requestedSearch}
            clearHref={clearSearchHref}
          />
          <NativeButton className="compact primary" type="submit">
            <Search size={15} aria-hidden="true" />
            Cari
          </NativeButton>
        </form>

        <div className="content-filter-tabs" role="tablist" aria-label="Filter kesiapan prompt">
          {PROMPT_WORKBENCH_READINESS_FILTERS.map((filter) => {
            const count = filter.key === "ALL" ? promptReadinessCounts.total : promptReadinessCounts[filter.key];
            const isActive = requestedReadiness === filter.key;

            return (
              <NativeLinkButton
                aria-selected={isActive}
                className="content-filter-tab"
                data-active={isActive ? "true" : undefined}
                href={buildPromptsHref({
                  affiliateProfileId: requestedAffiliateProfileId,
                  intakeId: requestedIntakeId,
                  page: 1,
                  productId: requestedProductId,
                  readiness: filter.key,
                  search: requestedSearch,
                })}
                key={filter.key}
                role="tab"
              >
                {`${filter.label} (${count})`}
              </NativeLinkButton>
            );
          })}
        </div>

        <section className="stack" aria-label="Paket Prompt">
          {visiblePromptRows.length ? (
            <>
              <PromptWorkbenchList
                affiliateProfileId={requestedAffiliateProfileId}
                intakeId={requestedIntakeId}
                pagination={{
                  page: promptPageData.page,
                  pageSize: promptPageData.pageSize,
                  totalCount: promptPageData.totalCount,
                  totalPages: promptPageData.totalPages,
                  hasPreviousPage: promptPageData.hasPreviousPage,
                  hasNextPage: promptPageData.hasNextPage,
                }}
                productId={requestedProductId}
                readiness={requestedReadiness}
                rows={workbenchRows}
                search={requestedSearch}
              />
              <PromptPaginationStepper
                affiliateProfileId={requestedAffiliateProfileId}
                intakeId={requestedIntakeId}
                pageData={promptPageData}
                productId={requestedProductId}
                readiness={requestedReadiness}
                search={requestedSearch}
              />
            </>
          ) : (
            <EmptyState
              icon={Package}
              title={requestedSearch ? "Prompt tidak ditemukan." : "Produk belum ada."}
              description={
                requestedSearch
                  ? "Coba kata kunci lain."
                  : "Buat produk dulu."
              }
              action={
                requestedSearch ? null : (
                  <NativeLinkButton className="primary" href="/products/new">
                    <Plus size={16} aria-hidden="true" />
                    Produk Baru
                  </NativeLinkButton>
                )
              }
            />
          )}
        </section>
      </div>

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
            selectedTab={requestedTab}
            selectedVersion={requestedVersion}
          />
        </OperatorDetailDrawer>
      ) : null}
    </div>
  );
}
