import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { SearchInput } from "@/components/operator/search-input";
import { NativeButton, NativeLinkButton } from "@/components/ui/native-button";
import { SkeletonPromptCards } from "@/components/operator/loading-skeleton";
import { normalizePromptWorkbenchPage, normalizePromptWorkbenchReadinessFilter, normalizePromptWorkbenchSearch, PROMPT_WORKBENCH_READINESS_FILTERS, type PromptWorkbenchReadinessFilter } from "@/lib/prompts/prompt-workbench";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildPromptsHref } from "./prompt-workbench-links";
import { PromptWorkbenchSection } from "./prompt-workbench-section";
import { type PromptDetailTab } from "./prompt-detail-panel";

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

function PromptWorkbenchSectionFallback() {
  return (
    <section className="stack prompt-workbench-section-fallback" aria-label="Memuat paket prompt">
      <SkeletonPromptCards count={10} />
    </section>
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

  const clearSearchHref = buildPromptsHref({
    affiliateProfileId: requestedAffiliateProfileId,
    intakeId: requestedIntakeId,
    page: 1,
    productId: requestedProductId,
    readiness: requestedReadiness,
  });

  return (
    <div className="operator-detail-layout" data-has-detail={requestedDetailId ? "true" : undefined}>
      <div className="stack prompt-page-stack prompt-workbench-layout__chrome">
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
                  readiness: filter.key as PromptWorkbenchReadinessFilter,
                  search: requestedSearch,
                })}
                key={filter.key}
                role="tab"
              >
                {filter.label}
              </NativeLinkButton>
            );
          })}
        </div>
      </div>

      <Suspense fallback={<PromptWorkbenchSectionFallback />}>
        <PromptWorkbenchSection
          affiliateProfileId={requestedAffiliateProfileId}
          detailId={requestedDetailId}
          intakeId={requestedIntakeId}
          page={requestedPage}
          productId={requestedProductId}
          readiness={requestedReadiness}
          search={requestedSearch}
          selectedTab={requestedTab}
          selectedVersion={requestedVersion}
          userId={user.id}
        />
      </Suspense>
    </div>
  );
}
