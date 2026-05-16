import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  flowStageDrivePurpose,
  normalizeFlowManifestStage,
  type FlowManifestStage,
} from "@/lib/flow/stage-manifest";
import { HELPER_API_TOKEN_CODE } from "@/lib/helper-api-tokens";
import { GENERATED_FILE_MATCH_STATUSES } from "@/lib/server/clip-jobs";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import {
  isDriveItemPurpose,
  isDriveItemStatus,
  isDriveItemType,
  type DriveItemPurpose,
  type DriveItemStatus,
  type DriveItemType,
} from "@/lib/drive/validation";

type JsonRecord = Record<string, unknown>;

export type HelperCallbackDriveItemInput = {
  drive_item_id?: string | null;
  item_type?: string | null;
  name?: string | null;
  drive_url?: string | null;
  drive_path?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  purpose?: string | null;
  status?: string | null;
  notes?: string | null;
};

export type HelperCallbackFileInput = {
  clip_job_id?: string | null;
  job_code?: string | null;
  clip_code?: string | null;
  version?: string | null;
  stage?: string | null;
  file_name?: string | null;
  detected_prefix?: string | null;
  match_status?: string | null;
  imported_at?: string | null;
  drive_item: HelperCallbackDriveItemInput;
};

export type HelperCallbackPayload = {
  batch_code?: string | null;
  flow_account_code?: string | null;
  helper_event_at?: string | null;
  last_helper_event_at?: string | null;
  generated_files?: HelperCallbackFileInput[];
  files?: HelperCallbackFileInput[];
};

export type HelperCallbackResult = {
  batchId: string;
  batchCode: string;
  flowAccountCode: string;
  batchStatus: string;
  savedFileCount: number;
  helperEventAt: string;
};

type HelperApiTokenRecord = {
  id: string;
  user_id: string;
  token_code: string;
  token_hash: string;
  status: string;
};

type FlowBatchRecord = {
  id: string;
  user_id: string;
  batch_code: string;
  flow_account_id: string;
  status: string;
  last_helper_event_at: string | null;
};

type FlowAccountRecord = {
  id: string;
  user_id: string;
  account_code: string;
};

type ClipJobRecord = {
  id: string;
  user_id: string;
  batch_id: string | null;
  job_code: string;
  clip_code: string;
  version: string;
  start_frame_drive_item_id: string | null;
  last_frame_drive_item_id: string | null;
  generated_drive_item_id: string | null;
  status: string;
};

type DriveItemRecord = {
  id: string;
  user_id: string;
  item_type: DriveItemType;
  drive_item_id: string | null;
  parent_id: string | null;
  parent_drive_item_id: string | null;
  name: string;
  drive_url: string;
  drive_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  purpose: DriveItemPurpose;
  status: DriveItemStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type GeneratedFileRecord = {
  id: string;
  user_id: string;
  clip_job_id: string | null;
  drive_item_id: string;
  file_name: string;
  detected_prefix: string | null;
  stage: FlowManifestStage;
  match_status: string;
  helper_report_json: JsonRecord | null;
  imported_at: string | null;
};

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value.trim() : null;
}

function readNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = readText(value);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTimestamp(value: string | null | undefined) {
  const trimmed = readText(value);

  if (!trimmed) {
    return new Date().toISOString();
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error("helper_event_at harus berupa timestamp ISO yang valid.");
  }

  return new Date(parsed).toISOString();
}

function hashHelperApiToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function readAllowedDriveItemType(value: string | null | undefined): DriveItemType {
  const normalized = readText(value).toUpperCase();

  if (!normalized) {
    return "FILE";
  }

  if (!isDriveItemType(normalized)) {
    throw new Error(`item_type harus salah satu dari: FILE, FOLDER.`);
  }

  return normalized;
}

function readAllowedDriveItemPurpose(value: string | null | undefined, stage: FlowManifestStage): DriveItemPurpose {
  const normalized = readText(value).toUpperCase();

  if (!normalized) {
    return flowStageDrivePurpose(stage);
  }

  if (!isDriveItemPurpose(normalized)) {
    throw new Error("purpose Drive tidak valid.");
  }

  return normalized;
}

function readAllowedDriveItemStatus(value: string | null | undefined): DriveItemStatus {
  const normalized = readText(value).toUpperCase();

  if (!normalized) {
    return "ACTIVE";
  }

  if (!isDriveItemStatus(normalized)) {
    throw new Error("status Drive tidak valid.");
  }

  return normalized;
}

function readAllowedMatchStatus(value: string | null | undefined) {
  const normalized = readText(value).toUpperCase();

  if (!normalized) {
    return "IMPORTED";
  }

  if (!(GENERATED_FILE_MATCH_STATUSES as readonly string[]).includes(normalized)) {
    throw new Error(`match_status harus salah satu dari: ${GENERATED_FILE_MATCH_STATUSES.join(", ")}.`);
  }

  return normalized;
}

function readPayload(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("Payload callback harus berupa object JSON.");
  }

  const generatedFiles = Array.isArray(value.generated_files)
    ? value.generated_files
    : Array.isArray(value.files)
      ? value.files
      : [];

  return {
    batch_code: normalizeNullableText(typeof value.batch_code === "string" ? value.batch_code : null),
    flow_account_code: normalizeNullableText(typeof value.flow_account_code === "string" ? value.flow_account_code : null),
    helper_event_at: normalizeNullableText(typeof value.helper_event_at === "string" ? value.helper_event_at : null),
    last_helper_event_at: normalizeNullableText(typeof value.last_helper_event_at === "string" ? value.last_helper_event_at : null),
    generated_files: generatedFiles.map((file) => {
      if (!isRecord(file)) {
        throw new Error("generated_files item harus berupa object.");
      }

      if (!isRecord(file.drive_item)) {
        throw new Error("generated_files.drive_item wajib diisi.");
      }

      return {
        clip_job_id: readNullableString(file.clip_job_id),
        job_code: readNullableString(file.job_code),
        clip_code: readNullableString(file.clip_code),
        version: readNullableString(file.version),
        stage: readNullableString(file.stage),
        file_name: readNullableString(file.file_name),
        detected_prefix: readNullableString(file.detected_prefix),
        match_status: readNullableString(file.match_status),
        imported_at: readNullableString(file.imported_at),
        drive_item: {
          drive_item_id: readNullableString(file.drive_item.drive_item_id),
          item_type: readNullableString(file.drive_item.item_type),
          name: readNullableString(file.drive_item.name),
          drive_url: readNullableString(file.drive_item.drive_url),
          drive_path: readNullableString(file.drive_item.drive_path),
          mime_type: readNullableString(file.drive_item.mime_type),
          size_bytes: readNullableNumber(file.drive_item.size_bytes),
          purpose: readNullableString(file.drive_item.purpose),
          status: readNullableString(file.drive_item.status),
          notes: readNullableString(file.drive_item.notes),
        },
      } satisfies HelperCallbackFileInput;
    }),
  };
}

async function requireTokenOwner(rawToken: string) {
  const serviceClient = createSupabaseServiceRoleClient();
  const tokenHash = hashHelperApiToken(rawToken);

  const { data, error } = await serviceClient
    .from("helper_api_tokens")
    .select("id, user_id, token_code, token_hash, status")
    .eq("token_code", HELPER_API_TOKEN_CODE)
    .eq("status", "ACTIVE")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const token = data as HelperApiTokenRecord | null;

  if (!token || token.token_code !== HELPER_API_TOKEN_CODE || !safeEqual(token.token_hash, tokenHash)) {
    throw new Error("App API Token tidak valid.");
  }

  return {
    serviceClient,
    userId: token.user_id,
    tokenId: token.id,
  };
}

async function loadBatch(serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>, userId: string, batchCode: string) {
  const { data, error } = await serviceClient
    .from("flow_batches")
    .select("id, user_id, batch_code, flow_account_id, status, last_helper_event_at")
    .eq("user_id", userId)
    .eq("batch_code", batchCode)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const batch = data as FlowBatchRecord | null;
  if (!batch) {
    throw new Error("Batch tidak ditemukan.");
  }

  return batch;
}

async function loadFlowAccount(
  serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
  accountId: string,
) {
  const { data, error } = await serviceClient
    .from("flow_accounts")
    .select("id, user_id, account_code")
    .eq("user_id", userId)
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const account = data as FlowAccountRecord | null;
  if (!account) {
    throw new Error("Akun Flow tidak ditemukan.");
  }

  return account;
}

async function loadClipJob(
  serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
  batchId: string,
  input: HelperCallbackFileInput,
) {
  const selectColumns =
    "id, user_id, batch_id, job_code, clip_code, version, start_frame_drive_item_id, last_frame_drive_item_id, generated_drive_item_id, status";

  if (input.clip_job_id) {
    const { data, error } = await serviceClient
      .from("clip_jobs")
      .select(selectColumns)
      .eq("user_id", userId)
      .eq("batch_id", batchId)
      .eq("id", input.clip_job_id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data as ClipJobRecord;
    }
  }

  const clipCode = normalizeNullableText(input.clip_code);
  const version = normalizeNullableText(input.version);
  const jobCode = normalizeNullableText(input.job_code);
  if (!jobCode && !clipCode) {
    return null;
  }

  const baseQuery = () =>
    serviceClient
      .from("clip_jobs")
      .select(selectColumns)
      .eq("user_id", userId)
      .eq("batch_id", batchId);

  if (jobCode) {
    const { data, error } = await baseQuery().eq("job_code", jobCode).maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data || !clipCode) {
      return (data ?? null) as ClipJobRecord | null;
    }
  }

  let query = baseQuery().eq("clip_code", clipCode);

  if (version) {
    query = query.eq("version", version);
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as ClipJobRecord | null;
}

async function upsertDriveItem(
  serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
  input: HelperCallbackDriveItemInput,
  stage: FlowManifestStage,
): Promise<DriveItemRecord> {
  const driveItemId = normalizeNullableText(input.drive_item_id);
  const name = readText(input.name);
  const driveUrl = readText(input.drive_url);
  const drivePath = readText(input.drive_path);

  if (!name) {
    throw new Error("Drive item name is required.");
  }

  if (!driveUrl) {
    throw new Error("Drive item URL is required.");
  }

  if (!drivePath) {
    throw new Error("Drive item path is required.");
  }

  const payload = {
    user_id: userId,
    item_type: readAllowedDriveItemType(input.item_type),
    drive_item_id: driveItemId,
    parent_id: null,
    parent_drive_item_id: null,
    name,
    drive_url: driveUrl,
    drive_path: drivePath,
    mime_type: normalizeNullableText(input.mime_type),
    size_bytes: typeof input.size_bytes === "number" && Number.isFinite(input.size_bytes) && input.size_bytes >= 0 ? Math.trunc(input.size_bytes) : null,
    purpose: readAllowedDriveItemPurpose(input.purpose, stage),
    status: readAllowedDriveItemStatus(input.status),
    notes: normalizeNullableText(input.notes),
  };

  if (driveItemId) {
    const { data: existing, error: existingError } = await serviceClient
      .from("drive_items")
      .select("id, user_id, item_type, drive_item_id, parent_id, parent_drive_item_id, name, drive_url, drive_path, mime_type, size_bytes, purpose, status, notes, created_at, updated_at")
      .eq("user_id", userId)
      .eq("drive_item_id", driveItemId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existing) {
      const { data, error } = await serviceClient
        .from("drive_items")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select("id, user_id, item_type, drive_item_id, parent_id, parent_drive_item_id, name, drive_url, drive_path, mime_type, size_bytes, purpose, status, notes, created_at, updated_at")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as DriveItemRecord;
    }
  }

  const { data, error } = await serviceClient
    .from("drive_items")
    .insert(payload)
    .select("id, user_id, item_type, drive_item_id, parent_id, parent_drive_item_id, name, drive_url, drive_path, mime_type, size_bytes, purpose, status, notes, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as DriveItemRecord;
}

async function upsertGeneratedFile(
  serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
  input: {
    clipJobId: string | null;
    driveItemId: string;
    fileName: string;
    detectedPrefix: string | null;
    matchStatus: string;
    stage: FlowManifestStage;
    helperReport: JsonRecord;
    importedAt: string;
  },
) {
  const existingQuery = input.clipJobId
    ? serviceClient
        .from("generated_files")
        .select("id, user_id, clip_job_id, drive_item_id, file_name, detected_prefix, stage, match_status, helper_report_json, imported_at")
        .eq("user_id", userId)
        .eq("clip_job_id", input.clipJobId)
        .eq("drive_item_id", input.driveItemId)
        .eq("stage", input.stage)
        .maybeSingle()
    : serviceClient
        .from("generated_files")
        .select("id, user_id, clip_job_id, drive_item_id, file_name, detected_prefix, stage, match_status, helper_report_json, imported_at")
        .eq("user_id", userId)
        .eq("drive_item_id", input.driveItemId)
        .eq("stage", input.stage)
        .maybeSingle();

  const { data: existing, error: existingError } = await existingQuery;

  if (existingError) {
    throw new Error(existingError.message);
  }

  const payload = {
    user_id: userId,
    clip_job_id: input.clipJobId,
    drive_item_id: input.driveItemId,
    file_name: input.fileName,
    detected_prefix: input.detectedPrefix,
    stage: input.stage,
    match_status: input.matchStatus,
    helper_report_json: input.helperReport,
    imported_at: input.importedAt,
  };

  if (existing) {
    const { data, error } = await serviceClient
      .from("generated_files")
      .update(payload)
      .eq("id", existing.id)
      .eq("user_id", userId)
      .select("id, user_id, clip_job_id, drive_item_id, file_name, detected_prefix, stage, match_status, helper_report_json, imported_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as GeneratedFileRecord;
  }

  const { data, error } = await serviceClient
    .from("generated_files")
    .insert(payload)
    .select("id, user_id, clip_job_id, drive_item_id, file_name, detected_prefix, stage, match_status, helper_report_json, imported_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as GeneratedFileRecord;
}

async function updateClipJobImport(
  serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
  clipJob: ClipJobRecord,
  driveItemId: string,
  matchStatus: string,
  stage: FlowManifestStage,
) {
  const patch: Record<string, string | null> = {};

  if (stage === "FIRST_FRAME") {
    patch.start_frame_drive_item_id = driveItemId;
  } else if (stage === "LAST_FRAME") {
    patch.last_frame_drive_item_id = driveItemId;
  } else {
    patch.generated_drive_item_id = driveItemId;
  }

  if (matchStatus === "ERROR") {
    patch.status = "ERROR";
  } else if (matchStatus === "NEEDS_REVIEW" || matchStatus === "UNMATCHED") {
    patch.status = "NEEDS_REVIEW";
  } else if (stage === "VIDEO" && (clipJob.status === "RUNNING" || clipJob.status === "IMPORTING" || matchStatus === "IMPORTED" || matchStatus === "MATCHED")) {
    patch.status = "IMPORTED";
  } else if (stage !== "VIDEO" && (matchStatus === "IMPORTED" || matchStatus === "MATCHED") && clipJob.status !== "IMPORTED" && clipJob.status !== "APPROVED") {
    patch.status = "READY";
  }

  const { error } = await serviceClient
    .from("clip_jobs")
    .update(patch)
    .eq("id", clipJob.id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

function fileNameForDriveItem(input: HelperCallbackFileInput, driveItem: DriveItemRecord) {
  return readText(input.file_name) || driveItem.name;
}

export async function processHelperCallback(rawToken: string, payload: unknown) {
  const { serviceClient, userId, tokenId } = await requireTokenOwner(rawToken);
  const input = readPayload(payload);

  if (!input.batch_code) {
    throw new Error("batch_code wajib diisi.");
  }

  if (!input.generated_files.length) {
    throw new Error("generated_files wajib diisi.");
  }

  const batch = await loadBatch(serviceClient, userId, input.batch_code);
  const flowAccount = await loadFlowAccount(serviceClient, userId, batch.flow_account_id);

  if (input.flow_account_code && input.flow_account_code !== flowAccount.account_code) {
    throw new Error("flow_account_code tidak cocok dengan batch.");
  }

  const helperEventAt = normalizeTimestamp(input.helper_event_at ?? input.last_helper_event_at);

  const savedFiles: GeneratedFileRecord[] = [];
  for (const fileInput of input.generated_files) {
    const stage = normalizeFlowManifestStage(fileInput.stage, "VIDEO");
    const driveItem = await upsertDriveItem(serviceClient, userId, fileInput.drive_item, stage);
    const clipJob = await loadClipJob(serviceClient, userId, batch.id, fileInput);
    const fileName = fileNameForDriveItem(fileInput, driveItem);
    const matchStatus = readAllowedMatchStatus(fileInput.match_status);
    const importedAt = normalizeTimestamp(fileInput.imported_at ?? helperEventAt);
    const helperReport = {
      stage,
      job_code: normalizeNullableText(fileInput.job_code),
      clip_code: normalizeNullableText(fileInput.clip_code),
      version: normalizeNullableText(fileInput.version),
      detected_prefix: normalizeNullableText(fileInput.detected_prefix),
    };

    if (clipJob) {
      await updateClipJobImport(serviceClient, userId, clipJob, driveItem.id, matchStatus, stage);
    }

    const generatedFile = await upsertGeneratedFile(serviceClient, userId, {
      clipJobId: clipJob?.id ?? normalizeNullableText(fileInput.clip_job_id),
      driveItemId: driveItem.id,
      fileName,
      detectedPrefix: normalizeNullableText(fileInput.detected_prefix),
      matchStatus,
      stage,
      helperReport,
      importedAt,
    });

    savedFiles.push(generatedFile);
  }

  const nextBatchStatus = batch.status === "RUNNING" ? "IMPORTING" : batch.status;
  const { error: batchUpdateError } = await serviceClient
    .from("flow_batches")
    .update({
      last_helper_event_at: helperEventAt,
      ...(nextBatchStatus !== batch.status ? { status: nextBatchStatus } : {}),
    })
    .eq("id", batch.id)
    .eq("user_id", userId);

  if (batchUpdateError) {
    throw new Error(batchUpdateError.message);
  }

  const { error: tokenUpdateError } = await serviceClient
    .from("helper_api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("user_id", userId);

  if (tokenUpdateError) {
    throw new Error(tokenUpdateError.message);
  }

  revalidatePath("/controller");
  if (batch.flow_account_id) {
    revalidatePath("/settings/account");
  }

  return {
    batchId: batch.id,
    batchCode: batch.batch_code,
    flowAccountCode: flowAccount.account_code,
    batchStatus: nextBatchStatus,
    savedFileCount: savedFiles.length,
    helperEventAt,
  } satisfies HelperCallbackResult;
}
