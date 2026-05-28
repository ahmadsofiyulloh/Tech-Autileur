import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SkeletonIntakeStepper } from "@/components/operator/loading-skeleton";
import { SectionCard } from "@/components/operator/section-card";
import { listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { resolveAffiliateProfileAvatar } from "@/lib/server/affiliate-profile-avatars";
import { resolveDriveImagePreviewUrl } from "@/lib/server/drive-image-previews";
import { listDriveItems, listDriveItemsByIds, type DriveItemRecord } from "@/lib/server/drive-items";
import { getIntakeSessionById, listIntakeSessions } from "@/lib/server/intake";
import { getPromptLaunchReadiness } from "@/lib/prompts/prompt-launch-readiness";
import { getCurrentWorkspace, listWorkspaces } from "@/lib/server/workspaces";
import { listProductImages, listProducts } from "@/lib/server/products";
import { listProductMarketplaceSources } from "@/lib/server/product-marketplace-sources";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAppDateTime } from "@/lib/app-time";

const IntakeWorkflowForm = nextDynamic(() => import("./intake-workflow-form").then((mod) => mod.IntakeWorkflowForm), {
  loading: () => <SkeletonIntakeStepper />,
});

const BulkImportPanel = nextDynamic(() => import("./bulk-import-panel").then((mod) => mod.BulkImportPanel), {
  loading: () => <div className="skeleton-block" style={{ minHeight: "200px" }} />,
});

export const revalidate = 60;

type NewProductPageProps = {
  searchParams: Promise<{
    intake_id?: string | string[];
    step?: string | string[];
    post_save?: string | string[];
    workspace?: string | string[];
    affiliate_profile_id?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function workspaceLabel(workspaceId: string | null, workspaceMap: Map<string, { workspace_code: string; workspace_name: string }>) {
  if (!workspaceId) {
    return "Unassigned";
  }

  const workspace = workspaceMap.get(workspaceId);
  return workspace ? workspace.workspace_name : "Workspace unavailable";
}

function formatQueueDate(value: string) {
  return formatAppDateTime(value, "-");
}

function intakeContinueHref(input: {
  affiliateProfileId: string | null;
  intakeId: string;
  showAllWorkspaces: boolean;
}) {
  const searchParams = new URLSearchParams({
    intake_id: input.intakeId,
    step: "intake",
  });

  if (input.showAllWorkspaces) {
    searchParams.set("workspace", "all");
  }

  if (input.affiliateProfileId) {
    searchParams.set("affiliate_profile_id", input.affiliateProfileId);
  }

  return `/products/new?${searchParams.toString()}`;
}

function mergeDriveItemsById(items: DriveItemRecord[], extraItems: DriveItemRecord[]) {
  const itemMap = new Map(items.map((item) => [item.id, item]));

  for (const item of extraItems) {
    itemMap.set(item.id, item);
  }

  return Array.from(itemMap.values());
}

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const query = await searchParams;
  const showAllWorkspaces = firstParam(query.workspace) === "all";
  const requestedStep = firstParam(query.step);
  const requestedPostSave = firstParam(query.post_save);
  const intakeId = firstParam(query.intake_id);
  const requestedAffiliateProfileId = firstParam(query.affiliate_profile_id) ?? null;
  let selectedSession: Awaited<ReturnType<typeof getIntakeSessionById>> | null = null;
  let currentWorkspace: Awaited<ReturnType<typeof getCurrentWorkspace>>;
  let workspaces: Awaited<ReturnType<typeof listWorkspaces>>;
  let affiliateProfiles: Awaited<ReturnType<typeof listAffiliateProfiles>> = [];
  let driveItems: Awaited<ReturnType<typeof listDriveItems>> = [];
  let intakeSessions: Awaited<ReturnType<typeof listIntakeSessions>> = [];
  let products: Awaited<ReturnType<typeof listProducts>> = [];
  let selectedSessionSourceImages: Awaited<ReturnType<typeof listProductImages>> = [];
  let selectedSessionMarketplaceSources: Awaited<ReturnType<typeof listProductMarketplaceSources>> = [];
  let draftQueueMarketplaceSources: Awaited<ReturnType<typeof listProductMarketplaceSources>> = [];

  try {
    [currentWorkspace, selectedSession, workspaces] = await Promise.all([
      getCurrentWorkspace(),
      intakeId ? getIntakeSessionById(intakeId) : Promise.resolve(null),
      listWorkspaces({ limit: 200 }),
    ]);

    const workspaceId = currentWorkspace && !showAllWorkspaces ? currentWorkspace.id : undefined;

    [affiliateProfiles, driveItems] = await Promise.all([
      listAffiliateProfiles({
        workspaceId: currentWorkspace?.id ?? undefined,
        status: "ACTIVE",
        limit: 25,
      }),
      listDriveItems({ limit: 100 }),
    ]);

    if (selectedSession?.product_id) {
      const [sourceImages, marketplaceSources] = await Promise.all([
        listProductImages({ productId: selectedSession.product_id, limit: 20 }),
        listProductMarketplaceSources({ productId: selectedSession.product_id, limit: 20 }),
      ]);

      selectedSessionSourceImages = sourceImages;
      selectedSessionMarketplaceSources = marketplaceSources;
    }

    if (!selectedSession) {
      [intakeSessions, products, draftQueueMarketplaceSources] = await Promise.all([
        listIntakeSessions({ workspaceId, limit: 20 }),
        listProducts({ workspaceId, limit: 100 }),
        listProductMarketplaceSources({ workspaceId, limit: 100 }),
      ]);
    }

    const referencedDriveItems = await listDriveItemsByIds([
      ...affiliateProfiles.flatMap((profile) => [
        profile.seed_character_drive_item_ref_id,
        profile.environment_drive_item_ref_id,
      ]),
      selectedSession?.product_photo_drive_item_ref_id,
      selectedSession?.screenshot_drive_item_ref_id,
      ...selectedSessionSourceImages.map((image) => image.drive_item_ref_id),
      ...(selectedSession ? selectedSessionMarketplaceSources : draftQueueMarketplaceSources).map((source) => source.screenshot_drive_item_ref_id),
    ]);
    driveItems = mergeDriveItemsById(driveItems, referencedDriveItems);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load intake.";

    return (
      <SectionCard icon={Inbox} title="Unable to load intake." description={message}>
        <EmptyState icon={Inbox} title="Intake unavailable." description="Try again." />
      </SectionCard>
    );
  }

  const visibleWorkspaces = workspaces.filter((workspace) => workspace.status !== "ARCHIVED");
  const visibleDriveItems = driveItems.filter((item) => item.status !== "ARCHIVED");

  const workspaceMap = new Map(visibleWorkspaces.map((workspace) => [workspace.id, workspace]));
  const driveItemMap = new Map(visibleDriveItems.map((item) => [item.id, item]));
  const affiliateProfilesWithAvatars = await Promise.all(
    affiliateProfiles.map((profile) => ({
      id: profile.id,
      profile_name: profile.profile_name,
      account_label: profile.account_label,
      avatarUrl: resolveAffiliateProfileAvatar(profile, driveItemMap),
      niche: profile.niche,
      platform: profile.platform,
      status: profile.status,
    })),
  );
  const selectedAffiliateProfileId =
    requestedAffiliateProfileId && affiliateProfiles.some((profile) => profile.id === requestedAffiliateProfileId)
      ? requestedAffiliateProfileId
      : affiliateProfiles[0]?.id ?? null;
  const selectedPromptAffiliateProfile = selectedAffiliateProfileId
    ? affiliateProfiles.find((profile) => profile.id === selectedAffiliateProfileId) ?? null
    : null;
  const selectedSourceImage = selectedSessionSourceImages.find((image) => image.is_primary) ?? selectedSessionSourceImages[0] ?? null;
  const selectedSessionDriveItemMap = new Map(visibleDriveItems.map((item) => [item.id, item]));

  const selectedSessionProductPreviewUrl =
      selectedSession?.product_photo_drive_item_ref_id
      ? resolveDriveImagePreviewUrl(selectedSessionDriveItemMap.get(selectedSession.product_photo_drive_item_ref_id) ?? null)
      : null;
  const selectedSessionShopeeSource = selectedSessionMarketplaceSources.find((source) => source.platform === "SHOPEE") ?? null;
  const selectedSessionTiktokSource = selectedSessionMarketplaceSources.find((source) => source.platform === "TIKTOK") ?? null;
  const selectedSessionShopeePreviewUrl =
    selectedSessionShopeeSource?.screenshot_drive_item_ref_id
      ? resolveDriveImagePreviewUrl(selectedSessionDriveItemMap.get(selectedSessionShopeeSource.screenshot_drive_item_ref_id) ?? null)
      : selectedSession?.screenshot_drive_item_ref_id
        ? resolveDriveImagePreviewUrl(selectedSessionDriveItemMap.get(selectedSession.screenshot_drive_item_ref_id) ?? null)
        : null;
  const selectedSessionTiktokPreviewUrl =
    selectedSessionTiktokSource?.screenshot_drive_item_ref_id
      ? resolveDriveImagePreviewUrl(selectedSessionDriveItemMap.get(selectedSessionTiktokSource.screenshot_drive_item_ref_id) ?? null)
      : null;
  const promptLaunchReadiness =
    selectedSession?.status === "REVIEWED" && selectedSession.product_id
      ? getPromptLaunchReadiness({
          productId: selectedSession.product_id,
          intakeSessionId: selectedSession.id,
          affiliateProfileId: selectedPromptAffiliateProfile?.id ?? null,
          hasReviewedMetadata: Boolean(selectedSession.reviewed_metadata_json || selectedSession.status === "REVIEWED"),
          reviewedMetadata: selectedSession.reviewed_metadata_json,
          sourceImageDriveItemRefId: selectedSourceImage?.drive_item_ref_id ?? null,
          affiliateProfile: selectedPromptAffiliateProfile,
        })
      : null;
  const initialStep = requestedStep === "prompt" && selectedSession ? "prompt" : "intake";
  const postSaveDecisionOpen = requestedPostSave === "1" && Boolean(selectedSession);
  const savedSessionWorkspaceName = selectedSession ? workspaceLabel(selectedSession.workspace_id, workspaceMap) : null;
  const activeProductIds = !selectedSession ? new Set(products.filter((product) => product.status !== "ARCHIVED").map((product) => product.id)) : null;
  const draftQueue = !selectedSession
    ? intakeSessions
        .filter((session) => {
          if (!session.product_id) {
            return false;
          }

          if (!activeProductIds?.has(session.product_id)) {
            return false;
          }

          return session.status === "DRAFT" || session.status === "SUBMITTED" || session.status === "NEEDS_REVIEW" || session.status === "ERROR";
        })
        .slice(0, 5)
        .map((session) => {
          const sessionSources = session.product_id ? draftQueueMarketplaceSources.filter((source) => source.product_id === session.product_id) : [];
          const shopeeSource = sessionSources.find((source) => source.platform === "SHOPEE") ?? null;
          const tiktokSource = sessionSources.find((source) => source.platform === "TIKTOK") ?? null;
          const productImagePreviewUrl = session.product_photo_drive_item_ref_id
            ? resolveDriveImagePreviewUrl(selectedSessionDriveItemMap.get(session.product_photo_drive_item_ref_id) ?? null)
            : null;

          return {
            id: session.id,
            productId: session.product_id,
            title: session.product_title || session.intake_code,
            status: session.status,
            errorMessage: session.error_message,
            createdAtLabel: formatQueueDate(session.created_at),
            productImagePreviewUrl,
            shopeeReady: Boolean(shopeeSource?.screenshot_drive_item_ref_id || session.screenshot_drive_item_ref_id),
            tiktokReady: Boolean(tiktokSource?.screenshot_drive_item_ref_id),
            continueHref: intakeContinueHref({
              affiliateProfileId: selectedAffiliateProfileId,
              intakeId: session.id,
              showAllWorkspaces,
            }),
          };
        })
    : [];

  return (
    <div className="stack intake-native-page">
      <div className="intake-desktop-grid">
        <div className="intake-desktop-primary stack">
          <section className="intake-native-surface" aria-label="Workflow intake produk">
            <IntakeWorkflowForm
              affiliateProfiles={affiliateProfilesWithAvatars}
              currentWorkspaceName={currentWorkspace?.workspace_name ?? null}
              initialStep={initialStep}
              savedSession={selectedSession}
              savedSessionWorkspaceName={savedSessionWorkspaceName}
              promptLaunchReadiness={promptLaunchReadiness}
              selectedAffiliateProfileId={selectedAffiliateProfileId}
              showAllWorkspaces={showAllWorkspaces}
              postSaveDecisionOpen={postSaveDecisionOpen}
              savedSessionEvidencePreviewUrls={{
                productImage: selectedSessionProductPreviewUrl,
                shopeeScreenshot: selectedSessionShopeePreviewUrl,
                tiktokScreenshot: selectedSessionTiktokPreviewUrl,
              }}
              draftQueue={draftQueue}
            />
          </section>
        </div>
        <BulkImportPanel />
      </div>
    </div>
  );
}
