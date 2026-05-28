import { redirect } from "next/navigation";
import { Share2 } from "lucide-react";
import { OperatorDetailDrawer } from "@/components/operator/detail-drawer";
import { ErrorState } from "@/components/operator/error-state";
import {
  normalizeShareDetailId,
  normalizeShareListPage,
  normalizeShareListSearch,
  normalizeShareTab,
  buildShareListHref,
  SHARE_LIST_DESKTOP_PAGE_SIZE,
} from "@/lib/share/share-list-contract";
import { normalizeSharePlatformParam } from "@/lib/share/share-list-contract";
import { SHARE_PLATFORM_LABELS } from "@/lib/share/share-platform";
import { getShareListRowByProductId, listShareListPage } from "@/lib/server/share-list";
import { getLatestShareGeneration, listShareGenerationHistory } from "@/lib/server/share-generations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ShareDetailPanel } from "./share-detail-panel";
import { ShareProductList } from "./share-product-list";
import { generateShareCaption } from "./actions";

export const revalidate = 30;

type SharePlatformPageProps = {
  params: Promise<{
    platform: string;
  }>;
  searchParams: Promise<{
    detail?: string | string[];
    page?: string | string[];
    q?: string | string[];
    tab?: string | string[];
    from?: string | string[];
    version?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SharePlatformPage({ params, searchParams }: SharePlatformPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedParams = await params;
  const platform = normalizeSharePlatformParam(resolvedParams.platform);

  if (!platform) {
    redirect("/share");
  }

  const query = await searchParams;
  const requestedPage = normalizeShareListPage(firstParam(query.page));
  const requestedSearch = normalizeShareListSearch(firstParam(query.q));
  const selectedDetailId = normalizeShareDetailId(firstParam(query.detail));
  const selectedTab = normalizeShareTab(firstParam(query.tab));

  let shareListPage: Awaited<ReturnType<typeof listShareListPage>> | null = null;

  try {
    shareListPage = await listShareListPage({
      platform,
      page: requestedPage,
      pageSize: SHARE_LIST_DESKTOP_PAGE_SIZE,
      search: requestedSearch,
    });
  } catch {
    return (
      <ErrorState
        icon={Share2}
        title="Produk tidak bisa dimuat."
        description="Coba lagi."
      />
    );
  }

  if (!shareListPage) {
    return (
      <ErrorState
        icon={Share2}
        title="Produk tidak bisa dimuat."
        description="Coba lagi."
      />
    );
  }

  let selectedRow = shareListPage.rows.find((row) => row.id === selectedDetailId) ?? null;

  if (!selectedRow && selectedDetailId) {
    try {
      selectedRow = await getShareListRowByProductId({
        platform,
        productId: selectedDetailId,
        page: shareListPage.pagination.page,
        search: requestedSearch,
      });
    } catch {
      selectedRow = null;
    }
  }
  const hasDetail = Boolean(selectedDetailId);
  const closeHref = buildShareListHref({
    platform,
    page: shareListPage.pagination.page,
    search: requestedSearch,
  });

  const fromParam = firstParam(query.from);
  const versionParam = firstParam(query.version);

  const [latestGeneration, generations] = selectedRow
    ? await Promise.all([
        getLatestShareGeneration({
          productId: selectedRow.id,
          platform,
        }),
        listShareGenerationHistory({
          productId: selectedRow.id,
          platform,
        }),
      ])
    : [null, []];

  const prefillGeneration = fromParam
    ? generations.find((g) => g.id === fromParam) ?? null
    : null;

  let selectedGeneration = null as Awaited<ReturnType<typeof getLatestShareGeneration>>;

  if (selectedRow && versionParam) {
    if (latestGeneration && versionParam === latestGeneration.id) {
      selectedGeneration = latestGeneration;
    } else {
      const fromHistory = generations.find((g) => g.id === versionParam) ?? null;

      if (fromHistory) {
        selectedGeneration = fromHistory;
      } else {
        const { data: versionRow } = await supabase
          .from("share_generations")
          .select("*")
          .eq("user_id", user.id)
          .eq("product_id", selectedRow.id)
          .eq("platform", platform)
          .eq("id", versionParam)
          .maybeSingle();

        selectedGeneration = (versionRow ?? null) as typeof selectedGeneration;
      }
    }
  }

  return (
    <div className="operator-detail-layout" data-has-detail={hasDetail ? "true" : undefined}>
      <div className="operator-detail-layout__list">
        <ShareProductList
          activeProductId={selectedDetailId}
          pagination={shareListPage.pagination}
          platform={platform}
          rows={shareListPage.rows}
          search={requestedSearch}
        />
      </div>

      {selectedDetailId ? (
        <OperatorDetailDrawer
          ariaLabel="Detail share produk"
          closeHref={closeHref}
          subtitle={SHARE_PLATFORM_LABELS[platform]}
          title={selectedRow?.product_name ?? "Detail share"}
        >
          {selectedRow ? (
            <ShareDetailPanel
              action={generateShareCaption}
              generations={generations}
              latestGeneration={latestGeneration}
              platform={platform}
              prefillAngle={prefillGeneration?.angle}
              prefillVariantCount={prefillGeneration?.variant_count}
              product={selectedRow}
              selectedGeneration={selectedGeneration}
              selectedTab={selectedTab}
              selectedVersionId={versionParam ?? null}
            />
          ) : (
            <div className="share-detail-panel">
              <p>Produk tidak ditemukan.</p>
            </div>
          )}
        </OperatorDetailDrawer>
      ) : null}
    </div>
  );
}
