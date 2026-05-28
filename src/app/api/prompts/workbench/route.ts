import { listDriveItemsByIds } from "@/lib/server/drive-items";
import { listPromptWorkbenchPageForUser } from "@/lib/server/prompt-workbench";
import {
  normalizePromptWorkbenchPage,
  normalizePromptWorkbenchReadinessFilter,
  normalizePromptWorkbenchSearch,
  PROMPT_WORKBENCH_MOBILE_PAGE_SIZE,
} from "@/lib/prompts/prompt-workbench";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function buildPromptsHref(params: {
  affiliateProfileId?: string | null;
  detailId?: string | null;
  intakeId?: string | null;
  page?: number | null;
  productId?: string | null;
  readiness?: string | null;
  search?: string | null;
  tab?: "output" | "generate" | "history" | null;
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

function normalizePageSize(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : PROMPT_WORKBENCH_MOBILE_PAGE_SIZE;

  if (!Number.isInteger(parsed)) {
    return PROMPT_WORKBENCH_MOBILE_PAGE_SIZE;
  }

  return Math.min(Math.max(parsed, 1), 50);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const requestedAffiliateProfileId = url.searchParams.get("affiliate_profile_id");
    const requestedIntakeId = url.searchParams.get("intake_id");
    const requestedProductId = url.searchParams.get("product_id");
    const requestedReadiness = normalizePromptWorkbenchReadinessFilter(url.searchParams.get("readiness") ?? undefined);
    const requestedSearch = normalizePromptWorkbenchSearch(url.searchParams.get("q") ?? undefined);
    const promptPage = await listPromptWorkbenchPageForUser(user.id, {
      readiness: requestedReadiness,
      search: requestedSearch,
      page: normalizePromptWorkbenchPage(url.searchParams.get("page") ?? undefined),
      pageSize: normalizePageSize(url.searchParams.get("page_size")),
    }, supabase);
    const affiliateProfileMap = new Map(promptPage.affiliateProfiles.map((profile) => [profile.id, profile]));
    const currentAffiliateProfile = promptPage.currentAffiliateProfile;
    const currentWorkspaceLabel = promptPage.workspaceLabel ?? "Workspace aktif";
    const promptTaskIds = Array.from(
      new Set(promptPage.rows.map((row) => row.promptPack?.ai_task_id).filter((value): value is string => Boolean(value))),
    );
    const promptTaskResult = promptTaskIds.length
      ? await supabase
          .from("ai_tasks")
          .select("id, status, error_message, gemini_api_key_id")
          .eq("user_id", user.id)
          .in("id", promptTaskIds)
      : { data: [], error: null };

    if (promptTaskResult.error) {
      throw new Error(promptTaskResult.error.message);
    }

    const promptTaskRows = (promptTaskResult.data ?? []) as PromptTaskRecord[];
    const geminiKeyIds = Array.from(
      new Set(promptTaskRows.map((task) => task.gemini_api_key_id).filter((value): value is string => Boolean(value))),
    );
    const geminiKeyResult = geminiKeyIds.length
      ? await supabase.from("gemini_api_keys").select("id, label, model_name").eq("user_id", user.id).in("id", geminiKeyIds)
      : { data: [], error: null };

    if (geminiKeyResult.error) {
      throw new Error(geminiKeyResult.error.message);
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
      new Set(promptPage.rows.map((row) => row.sourceImage?.drive_item_ref_id).filter((value): value is string => Boolean(value))),
    );
    const driveItems = driveItemIds.length ? await listDriveItemsByIds(driveItemIds) : [];
    const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));
    const currentAffiliateProfileLabel = currentAffiliateProfile?.profile_name ?? "Belum ada profile aktif";
    const returnHref = buildPromptsHref({
      affiliateProfileId: requestedAffiliateProfileId,
      intakeId: requestedIntakeId,
      page: promptPage.page,
      productId: requestedProductId,
      readiness: requestedReadiness,
      search: requestedSearch,
    });

    const rows = promptPage.rows.map((row) => {
      const promptPack = row.promptPack ?? null;
      const affiliateProfile = promptPack?.affiliate_profile_id
        ? affiliateProfileMap.get(promptPack.affiliate_profile_id) ?? null
        : currentAffiliateProfile;
      const sourceImage = row.sourceImage ?? null;
      const sourceImageDriveItem = sourceImage?.drive_item_ref_id ? driveItemMap.get(sourceImage.drive_item_ref_id) ?? null : null;
      const generationTask = promptPack?.ai_task_id ? promptTaskMap.get(promptPack.ai_task_id) ?? null : null;
      const intakeSession = row.intakeSession ?? null;
      const rowPromptDetailHref = promptPack
        ? buildPromptsHref({
            affiliateProfileId: requestedAffiliateProfileId,
            detailId: row.product.id,
            intakeId: requestedIntakeId,
            page: promptPage.page,
            productId: requestedProductId,
            readiness: requestedReadiness,
            search: requestedSearch,
          })
        : buildPromptsHref({
            affiliateProfileId: requestedAffiliateProfileId,
            detailId: row.product.id,
            intakeId: requestedIntakeId,
            page: promptPage.page,
            productId: requestedProductId,
            readiness: requestedReadiness,
            search: requestedSearch,
          });
      const rowPromptGenerateHref = buildPromptsHref({
        affiliateProfileId: requestedAffiliateProfileId,
        detailId: row.product.id,
        intakeId: requestedIntakeId,
        page: promptPage.page,
        productId: requestedProductId,
        readiness: requestedReadiness,
        search: requestedSearch,
        tab: "generate",
      });
      const rowPromptHistoryHref = buildPromptsHref({
        affiliateProfileId: requestedAffiliateProfileId,
        detailId: row.product.id,
        intakeId: requestedIntakeId,
        page: promptPage.page,
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
        returnHref,
        isOpen: false,
      };
    });

    return Response.json({
      pagination: {
        page: promptPage.page,
        pageSize: promptPage.pageSize,
        totalCount: promptPage.totalCount,
        totalPages: promptPage.totalPages,
        hasPreviousPage: promptPage.hasPreviousPage,
        hasNextPage: promptPage.hasNextPage,
      },
      rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prompt gagal dimuat.";
    const status = message.includes("Authentication") ? 401 : 400;

    return Response.json({ error: message }, { status });
  }
}
