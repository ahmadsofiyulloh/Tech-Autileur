import type { AffiliateProfilePromptReadinessInput } from "@/lib/affiliate-profiles/readiness";
import {
  hasAffiliateProfilePromptRules,
  isAffiliateProfileAssetAnalysisReady,
} from "@/lib/affiliate-profiles/readiness";

export type PromptLaunchReadinessBlocker = {
  key:
    | "affiliate_profile"
    | "affiliate_namespace"
    | "review_metadata"
    | "source_image"
    | "profile_rules"
    | "seed_character"
    | "environment";
  label: string;
  href: string;
};

export type PromptLaunchReadiness = {
  ready: boolean;
  blockers: PromptLaunchReadinessBlocker[];
};

export type PromptLaunchReadinessInput = {
  productId: string | null;
  intakeSessionId: string | null;
  affiliateProfileId: string | null;
  hasReviewedMetadata: boolean;
  sourceImageDriveItemRefId: string | null;
  affiliateProfile: AffiliateProfilePromptReadinessInput | null | undefined;
};

function buildPromptReviewHref(input: Pick<PromptLaunchReadinessInput, "affiliateProfileId" | "intakeSessionId">) {
  const searchParams = new URLSearchParams({
    step: "prompt",
  });

  if (input.intakeSessionId) {
    searchParams.set("intake_id", input.intakeSessionId);
  }

  if (input.affiliateProfileId) {
    searchParams.set("affiliate_profile_id", input.affiliateProfileId);
  }

  return `/products/new?${searchParams.toString()}`;
}

function buildProductMetadataHref(productId: string) {
  return `/products/${productId}?tab=metadata`;
}

function buildAffiliateProfileHref() {
  return "/settings/affiliate-profiles";
}

function hasPromptNamespace(profile: AffiliateProfilePromptReadinessInput) {
  return Boolean(profile.workspace_ids?.length);
}

export function getPromptLaunchReadiness(input: PromptLaunchReadinessInput): PromptLaunchReadiness {
  const blockers: PromptLaunchReadinessBlocker[] = [];
  const profile = input.affiliateProfile ?? null;
  const activeProfile = profile && profile.status === "ACTIVE" ? profile : null;

  if (!activeProfile) {
    blockers.push({
      key: "affiliate_profile",
      label: "Akun Affiliate",
      href: buildAffiliateProfileHref(),
    });
  } else {
    if (!hasPromptNamespace(activeProfile)) {
      blockers.push({
        key: "affiliate_namespace",
        label: "Namespace internal",
        href: buildAffiliateProfileHref(),
      });
    }

    if (!hasAffiliateProfilePromptRules(activeProfile)) {
      blockers.push({
        key: "profile_rules",
        label: "Rules Affiliate Profile",
        href: buildAffiliateProfileHref(),
      });
    }

    if (
      !isAffiliateProfileAssetAnalysisReady({
        locked: activeProfile.lock_seed_character ?? false,
        driveItemRefId: activeProfile.seed_character_drive_item_ref_id,
        analysisJson: activeProfile.seed_character_analysis_json,
      })
    ) {
      blockers.push({
        key: "seed_character",
        label: "Lock Character",
        href: buildAffiliateProfileHref(),
      });
    }

    if (
      !isAffiliateProfileAssetAnalysisReady({
        locked: activeProfile.lock_environment ?? false,
        driveItemRefId: activeProfile.environment_drive_item_ref_id,
        analysisJson: activeProfile.environment_analysis_json,
      })
    ) {
      blockers.push({
        key: "environment",
        label: "Lock Environment",
        href: buildAffiliateProfileHref(),
      });
    }
  }

  if (!input.hasReviewedMetadata) {
    blockers.push({
      key: "review_metadata",
      label: "Review Gemini",
      href: buildPromptReviewHref({
        affiliateProfileId: input.affiliateProfileId,
        intakeSessionId: input.intakeSessionId,
      }),
    });
  }

  if (!input.sourceImageDriveItemRefId) {
    blockers.push({
      key: "source_image",
      label: "Foto Produk Utama",
      href: input.productId ? buildProductMetadataHref(input.productId) : buildAffiliateProfileHref(),
    });
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}
