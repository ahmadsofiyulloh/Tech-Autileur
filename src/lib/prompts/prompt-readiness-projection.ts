import type { AffiliateProfilePromptReadinessInput } from "@/lib/affiliate-profiles/readiness";
import { isAffiliateProfilePromptReady } from "@/lib/affiliate-profiles/readiness";
import type { PromptLaunchReadiness } from "@/lib/prompts/prompt-launch-readiness";

export const PROMPT_READINESS_STATUS_LABELS = {
  NEEDS_EVIDENCE: "Needs Evidence",
  NEEDS_METADATA: "Needs Metadata",
  NEEDS_REVIEW: "Needs Review",
  READY_FOR_PROMPT: "Ready for Prompt",
  PROMPT_QUEUED: "Prompt Queued",
  PROMPT_GENERATED: "Prompt Generated",
  PROMPT_FAILED: "Prompt Failed",
} as const;

export type PromptReadinessStatus = keyof typeof PROMPT_READINESS_STATUS_LABELS;
export type PromptReadinessLabel = (typeof PROMPT_READINESS_STATUS_LABELS)[PromptReadinessStatus];

export type PromptReadinessReasonKey =
  | "source_image"
  | "marketplace_evidence"
  | "metadata_analysis"
  | "metadata_review"
  | "affiliate_profile"
  | "prompt_task";

export type PromptReadinessReason = {
  key: PromptReadinessReasonKey;
  label: string;
};

export type PromptReadinessProductInput = {
  id: string;
  status?: string | null;
};

export type PromptReadinessSourceImageInput = {
  id?: string | null;
  drive_item_ref_id?: string | null;
  status?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PromptReadinessMarketplaceEvidenceInput = {
  id?: string | null;
  screenshot_drive_item_ref_id?: string | null;
  parsed_metadata_json?: unknown;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PromptReadinessIntakeInput = {
  id?: string | null;
  status?: string | null;
  product_photo_drive_item_ref_id?: string | null;
  screenshot_drive_item_ref_id?: string | null;
  parsed_metadata_json?: unknown;
  reviewed_metadata_json?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PromptReadinessPromptPackInput = {
  id?: string | null;
  status?: string | null;
  ai_task_id?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PromptReadinessAiTaskInput = {
  id?: string | null;
  task_type?: string | null;
  status?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PromptReadinessProjectionInput = {
  product: PromptReadinessProductInput;
  sourceImageDriveItemRefId?: string | null;
  marketplaceEvidenceDriveItemRefId?: string | null;
  sourceImages?: readonly PromptReadinessSourceImageInput[];
  marketplaceSources?: readonly PromptReadinessMarketplaceEvidenceInput[];
  intakeSessions?: readonly PromptReadinessIntakeInput[];
  promptPacks?: readonly PromptReadinessPromptPackInput[];
  aiTasks?: readonly PromptReadinessAiTaskInput[];
  affiliateProfile?: AffiliateProfilePromptReadinessInput | null;
  launchReadiness?: PromptLaunchReadiness | null;
};

export type PromptReadinessProjection = {
  productId: string;
  status: PromptReadinessStatus;
  label: PromptReadinessLabel;
  reasons: PromptReadinessReason[];
  isBulkEnqueueEligible: boolean;
};

const ACTIVE_SOURCE_IMAGE_STATUSES = new Set(["ATTACHED", "ANALYZED"]);
const ACTIVE_PROMPT_STATUSES = new Set(["QUEUED", "GENERATING"]);
const GENERATED_PROMPT_STATUSES = new Set(["GENERATED", "NEEDS_REVIEW", "APPROVED"]);
const FAILED_PROMPT_STATUSES = new Set(["ERROR"]);
const ACTIVE_TASK_STATUSES = new Set(["QUEUED", "RUNNING", "RETRYING", "WAITING_FOR_KEY"]);
const FAILED_TASK_STATUSES = new Set(["FAILED"]);

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function hasJsonPayload(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function isBulkImportMetadata(value: unknown) {
  const record = asRecord(value);
  const sourceImport = asRecord(record?.source_import);

  return record?.schema_version === "bulk_import_v1" || sourceImport?.schema_version === "bulk_import_v1";
}

function statusOf(value: { status?: string | null } | null | undefined) {
  return readText(value?.status).toUpperCase();
}

function timestampOf(value: { updated_at?: string | null; created_at?: string | null } | null | undefined) {
  const rawValue = value?.updated_at ?? value?.created_at ?? "";
  const timestamp = rawValue ? new Date(rawValue).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function latestByTimestamp<T extends { updated_at?: string | null; created_at?: string | null }>(items: readonly T[]) {
  return [...items].sort((left, right) => timestampOf(right) - timestampOf(left))[0] ?? null;
}

function buildProjection(
  productId: string,
  status: PromptReadinessStatus,
  reasons: PromptReadinessReason[] = [],
): PromptReadinessProjection {
  return {
    productId,
    status,
    label: PROMPT_READINESS_STATUS_LABELS[status],
    reasons,
    isBulkEnqueueEligible: status === "READY_FOR_PROMPT",
  };
}

function hasSourceImageEvidence(input: PromptReadinessProjectionInput) {
  if (readText(input.sourceImageDriveItemRefId)) {
    return true;
  }

  return (input.sourceImages ?? []).some((image) => {
    const status = statusOf(image);
    return readText(image.drive_item_ref_id).length > 0 && ACTIVE_SOURCE_IMAGE_STATUSES.has(status);
  });
}

function hasMarketplaceScreenshotEvidence(input: PromptReadinessProjectionInput) {
  if (readText(input.marketplaceEvidenceDriveItemRefId)) {
    return true;
  }

  const hasSourceEvidence = (input.marketplaceSources ?? []).some((source) => {
    const status = statusOf(source);
    return status !== "ARCHIVED" && (readText(source.screenshot_drive_item_ref_id).length > 0 || isBulkImportMetadata(source.parsed_metadata_json));
  });

  if (hasSourceEvidence) {
    return true;
  }

  return (input.intakeSessions ?? []).some((session) => {
    const status = statusOf(session);
    return (
      status !== "ARCHIVED" &&
      (readText(session.screenshot_drive_item_ref_id).length > 0 ||
        isBulkImportMetadata(session.reviewed_metadata_json) ||
        isBulkImportMetadata(session.parsed_metadata_json))
    );
  });
}

function selectMetadataSession(input: PromptReadinessProjectionInput) {
  const sessions = (input.intakeSessions ?? []).filter((session) => statusOf(session) !== "ARCHIVED");
  const reviewedSessions = sessions.filter((session) => hasJsonPayload(session.reviewed_metadata_json));

  return latestByTimestamp(reviewedSessions) ?? latestByTimestamp(sessions);
}

function isReviewedMetadataReady(session: PromptReadinessIntakeInput | null) {
  return hasJsonPayload(session?.reviewed_metadata_json);
}

function hasParsedMetadataForReview(session: PromptReadinessIntakeInput | null) {
  return statusOf(session) === "NEEDS_REVIEW" || hasJsonPayload(session?.parsed_metadata_json);
}

function latestPromptPack(input: PromptReadinessProjectionInput) {
  return latestByTimestamp((input.promptPacks ?? []).filter((pack) => statusOf(pack) !== "ARCHIVED"));
}

function latestPromptTask(input: PromptReadinessProjectionInput, pack: PromptReadinessPromptPackInput | null) {
  const tasks = input.aiTasks ?? [];
  const linkedTaskId = readText(pack?.ai_task_id);
  const linkedTask = linkedTaskId ? tasks.find((task) => readText(task.id) === linkedTaskId) ?? null : null;

  return linkedTask ?? latestByTimestamp(tasks);
}

function getPromptStateProjection(input: PromptReadinessProjectionInput, pack: PromptReadinessPromptPackInput | null) {
  const task = latestPromptTask(input, pack);
  const packStatus = statusOf(pack);
  const taskStatus = statusOf(task);

  if (ACTIVE_TASK_STATUSES.has(taskStatus) || ACTIVE_PROMPT_STATUSES.has(packStatus)) {
    return buildProjection(input.product.id, "PROMPT_QUEUED", [{ key: "prompt_task", label: "Prompt generation task" }]);
  }

  if (GENERATED_PROMPT_STATUSES.has(packStatus)) {
    return buildProjection(input.product.id, "PROMPT_GENERATED", [{ key: "prompt_task", label: "Prompt pack generated" }]);
  }

  if (FAILED_TASK_STATUSES.has(taskStatus) || FAILED_PROMPT_STATUSES.has(packStatus)) {
    return buildProjection(input.product.id, "PROMPT_FAILED", [{ key: "prompt_task", label: "Prompt generation failed" }]);
  }

  return null;
}

function hasProfileReadinessInput(input: PromptReadinessProjectionInput) {
  return Object.prototype.hasOwnProperty.call(input, "affiliateProfile") || Boolean(input.launchReadiness);
}

function getProfileBlockReasons(input: PromptReadinessProjectionInput): PromptReadinessReason[] {
  if (input.launchReadiness && !input.launchReadiness.ready) {
    return input.launchReadiness.blockers
      .filter((blocker) => blocker.key !== "source_image" && blocker.key !== "review_metadata")
      .map((blocker) => ({
        key: "affiliate_profile" as const,
        label: blocker.label,
      }));
  }

  if (hasProfileReadinessInput(input) && !isAffiliateProfilePromptReady(input.affiliateProfile)) {
    return [{ key: "affiliate_profile", label: "Akun Affiliate" }];
  }

  return [];
}

export function projectPromptReadiness(input: PromptReadinessProjectionInput): PromptReadinessProjection {
  const promptStateProjection = getPromptStateProjection(input, latestPromptPack(input));

  if (promptStateProjection) {
    return promptStateProjection;
  }

  const evidenceReasons: PromptReadinessReason[] = [];

  if (!hasSourceImageEvidence(input)) {
    evidenceReasons.push({ key: "source_image", label: "Foto Produk Utama" });
  }

  if (!hasMarketplaceScreenshotEvidence(input)) {
    evidenceReasons.push({ key: "marketplace_evidence", label: "Screenshot Shopee/TikTok" });
  }

  if (evidenceReasons.length) {
    return buildProjection(input.product.id, "NEEDS_EVIDENCE", evidenceReasons);
  }

  const metadataSession = selectMetadataSession(input);

  if (!metadataSession || statusOf(metadataSession) === "ERROR") {
    return buildProjection(input.product.id, "NEEDS_METADATA", [
      { key: "metadata_analysis", label: "Analisis Metadata" },
    ]);
  }

  if (!isReviewedMetadataReady(metadataSession)) {
    if (hasParsedMetadataForReview(metadataSession)) {
      return buildProjection(input.product.id, "NEEDS_REVIEW", [{ key: "metadata_review", label: "Review Gemini" }]);
    }

    return buildProjection(input.product.id, "NEEDS_METADATA", [
      { key: "metadata_analysis", label: "Analisis Metadata" },
    ]);
  }

  const launchReviewBlocked =
    input.launchReadiness?.blockers.some((blocker) => blocker.key === "review_metadata") ?? false;

  if (launchReviewBlocked) {
    return buildProjection(input.product.id, "NEEDS_REVIEW", [{ key: "metadata_review", label: "Review Gemini" }]);
  }

  const profileBlockReasons = getProfileBlockReasons(input);

  if (profileBlockReasons.length) {
    return buildProjection(input.product.id, "NEEDS_REVIEW", profileBlockReasons);
  }

  return buildProjection(input.product.id, "READY_FOR_PROMPT");
}

export function isBulkPromptEnqueueEligible(projection: Pick<PromptReadinessProjection, "status">) {
  return projection.status === "READY_FOR_PROMPT";
}
