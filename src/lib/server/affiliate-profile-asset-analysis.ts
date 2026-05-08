import "server-only";

import sharp from "sharp";
import { createAITask, markTaskFailed, markTaskRunning, markTaskSuccess } from "@/lib/server/ai-task-queue";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { GeminiClientError } from "@/lib/server/gemini-client";
import { generateTrackedGeminiJsonText } from "@/lib/server/gemini-usage-events";
import { GEMINI_AFFILIATE_PROFILE_ASSET_ANALYSIS_RESPONSE_SCHEMA } from "@/lib/gemini/json-schemas";
import { getDriveItemById } from "@/lib/server/drive-items";
import { getGoogleDriveFileContentBytes } from "@/lib/server/google-drive";
import { getGeminiSecretRotationErrorMessage, readGeminiSecretForKey } from "@/lib/server/gemini-secret";
import {
  getGeminiQuotaGroupKey,
  listQuotaAwareGeminiKeys,
  markGeminiKeyError,
  markGeminiKeySuccess,
  markGeminiQuotaGroupError,
  markGeminiQuotaGroupCooldown,
  type GeminiRoutableKey,
} from "@/lib/server/gemini-key-routing";
import { getGeminiFailureDisposition } from "@/lib/server/gemini-failure-policy";
import type { JsonObject } from "@/lib/affiliate-profiles/validation";
import {
  canonicalizeAffiliateProfileAssetAnalysisJson,
  type AffiliateProfileAssetKind,
} from "@/lib/affiliate-profiles/asset-reanalysis";

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>;

type GeminiSelection = {
  key: GeminiRoutableKey;
  secret: string;
};

const AFFILIATE_PROFILE_ASSET_ANALYSIS_SCHEMA_VERSION = "2026-05-06.asset-analysis.v1";
const AFFILIATE_PROFILE_ASSET_ANALYSIS_PROMPT_VERSION = "2026-05-06.asset-analysis.prompt.v1";

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requireCurrentUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { userId: user.id };
}

async function selectGeminiVisionAnalysisKey(
  serviceClient: SupabaseServiceClient,
  userId: string,
  excludedQuotaGroups: ReadonlySet<string> = new Set(),
  excludedKeyIds: ReadonlySet<string> = new Set(),
) {
  const keys = await listQuotaAwareGeminiKeys({
    userId,
    purpose: "VISION_ANALYSIS",
    excludedQuotaGroups,
    excludedKeyIds,
    serviceClient,
  });
  let sawSecretDecryptionFailure = false;

  for (const key of keys) {
    const secretResult = await readGeminiSecretForKey(serviceClient, userId, key.id);
    sawSecretDecryptionFailure ||= secretResult.decryptFailed;

    if (!secretResult.secret) {
      continue;
    }

    return { key, secret: secretResult.secret } satisfies GeminiSelection;
  }

  if (sawSecretDecryptionFailure) {
    throw new Error(getGeminiSecretRotationErrorMessage());
  }

  return null;
}

async function prepareGeminiCompatibleBytes(input: {
  bytes: Buffer;
  mimeType: string;
  label: string;
}) {
  const mimeType = readText(input.mimeType).toLowerCase() || "application/octet-stream";

  if (mimeType === "image/avif" || mimeType === "image/heic" || mimeType === "image/heif") {
    try {
      const converted = await sharp(input.bytes, { failOn: "none" }).webp().toBuffer();
      return {
        bytes: converted,
        mimeType: "image/webp",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${input.label} image could not be prepared for Gemini: ${message}`);
    }
  }

  return {
    bytes: input.bytes,
    mimeType,
  };
}

function buildAffiliateAssetAnalysisPrompt(input: {
  profileCode: string;
  kind: AffiliateProfileAssetKind;
  fileName: string;
}) {
  return [
    "You are analyzing a locked affiliate profile asset for a JSON-first multimodal prompt pipeline.",
    "Return JSON only. Do not use markdown, code fences, or prose.",
    "The asset is cached on the affiliate profile and reused until the uploaded file changes.",
    `Asset kind: ${input.kind}.`,
    `Affiliate profile code: ${input.profileCode}.`,
    `File name: ${input.fileName}.`,
    "Extract OCR-visible text when present, but also infer the visual style metadata needed for prompt generation.",
    "Focus on: subject, style keywords, scene keywords, color keywords, material keywords, mood keywords, composition keywords, OCR text lines, and prompt rules.",
    "Prompt rules must be concise and action-oriented so the generation step can reuse them verbatim.",
    "Return only fields described by the response schema.",
  ].join("\n");
}

function sanitizeGeminiFailureMessage(error: unknown) {
  if (error instanceof GeminiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Affiliate profile asset analysis failed.";
}

async function analyzeAssetWithKey(input: {
  userId: string;
  serviceClient: SupabaseServiceClient;
  profileCode: string;
  kind: AffiliateProfileAssetKind;
  driveItemId: string;
  excludedQuotaGroups: Set<string>;
  excludedKeyIds: Set<string>;
}) {
  const driveItem = await getDriveItemById(input.driveItemId);

  if (!driveItem || driveItem.user_id !== input.userId) {
    throw new Error("Drive asset not found.");
  }

  if (!driveItem.drive_item_id) {
    throw new Error("Drive asset is not linked to Google Drive yet.");
  }

  if (!driveItem.mime_type) {
    throw new Error("Drive asset mime type is missing.");
  }

  const bytes = await getGoogleDriveFileContentBytes(driveItem.drive_item_id);
  if (!bytes.length) {
    throw new Error("Drive asset bytes are empty.");
  }

  const prepared = await prepareGeminiCompatibleBytes({
    bytes,
    mimeType: driveItem.mime_type,
    label: `${input.kind} asset`,
  });

  const selection = await selectGeminiVisionAnalysisKey(
    input.serviceClient,
    input.userId,
    input.excludedQuotaGroups,
    input.excludedKeyIds,
  );

  if (!selection) {
    throw new Error("No Gemini vision key is available for asset analysis.");
  }

  const task = await createAITask({
    taskType: "VISION_ANALYSIS",
    geminiApiKeyId: selection.key.id,
    maxRetries: 0,
    inputJson: {
      asset_kind: input.kind,
      profile_code: input.profileCode,
      drive_item_ref_id: input.driveItemId,
      drive_item_name: driveItem.name,
    },
  });

  await markTaskRunning(task.id).catch(() => undefined);

  try {
    const response = await generateTrackedGeminiJsonText({
      aiTaskId: task.id,
      geminiApiKey: selection.key,
      taskType: "VISION_ANALYSIS",
      userId: input.userId,
      request: {
        modelName: selection.key.model_name,
        apiKey: selection.secret,
        prompt: buildAffiliateAssetAnalysisPrompt({
          profileCode: input.profileCode,
          kind: input.kind,
          fileName: driveItem.name,
        }),
        parts: [
          {
            inline_data: {
              mime_type: prepared.mimeType,
              data: prepared.bytes.toString("base64"),
            },
          },
        ],
        temperature: 0,
        maxOutputTokens: 3072,
        timeoutMs: 120_000,
        responseJsonSchema: GEMINI_AFFILIATE_PROFILE_ASSET_ANALYSIS_RESPONSE_SCHEMA,
      },
    });

    const parsed = JSON.parse(response.text);
    const outputJson = isRecord(parsed) ? (parsed as JsonObject) : ({} as JsonObject);
    await markTaskSuccess(task.id, outputJson).catch(() => undefined);
    await markGeminiKeySuccess({
      serviceClient: input.serviceClient,
      userId: input.userId,
      key: selection.key,
    }).catch(() => undefined);
    return canonicalizeAffiliateProfileAssetAnalysisJson(outputJson, input.driveItemId);
  } catch (error) {
    if (error instanceof GeminiClientError && (error.status === 429 || error.status === 408 || error.status >= 500 || error.status === 401 || error.status === 403 || error.status === 404)) {
      console.warn("[affiliate-profile-asset-analysis] Gemini upstream error", {
        profileCode: input.profileCode,
        kind: input.kind,
        modelName: selection.key.model_name,
        driveItemRefId: input.driveItemId,
        status: error.status,
        retryAfterSeconds: error.retryAfterSeconds,
        message: error.message,
      });
    }

    if (error instanceof GeminiClientError) {
      const disposition = getGeminiFailureDisposition(error);

      if (disposition.markKeyError) {
        input.excludedKeyIds.add(selection.key.id);
        await markGeminiKeyError({
          serviceClient: input.serviceClient,
          userId: input.userId,
          keyId: selection.key.id,
        }).catch(() => undefined);
      } else if (disposition.markGroupError) {
        input.excludedQuotaGroups.add(getGeminiQuotaGroupKey(selection.key));
        await markGeminiQuotaGroupError({
          serviceClient: input.serviceClient,
          userId: input.userId,
          key: selection.key,
        }).catch(() => undefined);
      } else if (disposition.markGroupCooldown) {
        input.excludedQuotaGroups.add(getGeminiQuotaGroupKey(selection.key));
        await markGeminiQuotaGroupCooldown({
          serviceClient: input.serviceClient,
          userId: input.userId,
          key: selection.key,
          nextStatus: disposition.nextStatus ?? "RATE_LIMITED",
          cooldownUntil: disposition.cooldownUntil,
        }).catch(() => undefined);
      }
    }

    const message = sanitizeGeminiFailureMessage(error);
    await markTaskFailed(task.id, message, { retryable: false }).catch(() => undefined);
    throw error instanceof Error ? error : new Error(message);
  }
}

export async function analyzeAffiliateProfileAsset(input: {
  profileCode: string;
  kind: AffiliateProfileAssetKind;
  driveItemId: string | null;
}) {
  if (!input.driveItemId) {
    return null;
  }

  const { userId } = await requireCurrentUserId();
  const serviceClient = createSupabaseServiceRoleClient();
  const excludedQuotaGroups = new Set<string>();
  const excludedKeyIds = new Set<string>();
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await analyzeAssetWithKey({
        userId,
        serviceClient,
        profileCode: input.profileCode,
        kind: input.kind,
        driveItemId: input.driveItemId,
        excludedQuotaGroups,
        excludedKeyIds,
      });
    } catch (error) {
      lastError = error;

      if (error instanceof GeminiClientError && (error.status === 429 || error.status === 408 || error.status >= 500 || error.status === 401 || error.status === 403 || error.status === 404)) {
        continue;
      }

      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Affiliate profile asset analysis failed.");
}
