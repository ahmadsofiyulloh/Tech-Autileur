import "server-only";

import {
  FLOW_MANIFEST_SCHEMA_VERSION,
  buildFlowStageManifestJobs,
  isFlowManifestStage,
  type FlowStageManifestJob,
} from "@/lib/flow/stage-manifest";
import { PROMPT_CLIP_KEYS } from "@/lib/prompts/validation";
import { readPromptPackEditorPromptSet } from "@/lib/prompts/prompt-pack-contract";
import { listClipJobs, type ClipJobRecord } from "@/lib/server/clip-jobs";
import { listContents, type ContentRecord } from "@/lib/server/contents";
import { listDriveItems, writeGeneratedDriveFile, type DriveItemRecord } from "@/lib/server/drive-items";
import { getFlowAccountById, normalizeChromeProfileLaneKey, readChromeProfileLaneKey } from "@/lib/server/flow-accounts";
import { getFlowBatchById, updateFlowBatch, type FlowBatchRecord } from "@/lib/server/flow-batches";
import { getProductById } from "@/lib/server/products";
import { getPromptPackById } from "@/lib/server/prompt-packs";

export type FlowBatchManifestJob = {
  job_code: string;
  content_code: string;
  clip_code: string;
  version: string;
  prompt_prefix: string;
  prompt_one_paragraph: string;
  start_frame_drive_url: string | null;
  last_frame_drive_url: string | null;
  output_file_name: string;
};

export type FlowBatchManifest = {
  schema_version: typeof FLOW_MANIFEST_SCHEMA_VERSION;
  batch_id: string;
  batch_code: string;
  target_date: string;
  model: string;
  max_jobs: number;
  flow_account_code: string;
  chrome_profile_lane_key: string | null;
  flow_url: string;
  drive_output_folder_id: string;
  drive_output_folder_url: string;
  helper_output_folder_key: string;
  rename_pattern: string;
  prompt_context: unknown | null;
  stage_jobs: FlowStageManifestJob[];
  jobs: FlowBatchManifestJob[];
};

type ExportFlowBatchManifestInput = {
  flow_url?: string | null;
  drive_output_folder_id?: string | null;
  drive_output_folder_url?: string | null;
  helper_output_folder_key?: string | null;
  chrome_profile_lane_key?: string | null;
};

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = readText(value);
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readManifestLaneKey(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const laneKey = value.chrome_profile_lane_key;

  return typeof laneKey === "string" ? normalizeChromeProfileLaneKey(laneKey) : null;
}

const SAFE_MANIFEST_FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const REQUIRED_STAGE_INPUT_HANDLES = {
  FIRST_FRAME: ["@character", "@environment", "@product"],
  LAST_FRAME: ["@firstframe"],
  VIDEO: ["@firstframe", "@lastframe"],
} as const satisfies Record<FlowStageManifestJob["stage"], readonly string[]>;

function sameTextArray(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function normalizeTextArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);

  return normalized.length === value.length ? normalized : null;
}

function isSafeManifestFileName(value: string) {
  const trimmed = readText(value);

  return Boolean(trimmed) && SAFE_MANIFEST_FILE_NAME_PATTERN.test(trimmed) && !trimmed.includes("..");
}

function validateManifestFileName(value: string | null | undefined, label: string) {
  const trimmed = readText(value);

  if (!trimmed) {
    throw new Error(`${label} wajib diisi.`);
  }

  if (!isSafeManifestFileName(trimmed)) {
    throw new Error(`${label} tidak valid.`);
  }

  return trimmed;
}

function hasRequiredPromptContext(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  const product = value.product;
  const affiliateProfile = value.affiliate_profile ?? value.affiliateProfile;
  const referenceCards = value.reference_cards;

  return isRecord(product) && isRecord(affiliateProfile) && Array.isArray(referenceCards) && referenceCards.length > 0;
}

function validateStageJobGroup(clipCode: string, stageJobs: FlowStageManifestJob[]) {
  const jobsByStage = new Map<FlowStageManifestJob["stage"], FlowStageManifestJob>();

  for (const stageJob of stageJobs) {
    if (!isRecord(stageJob)) {
      throw new Error("Kontrak stage manifest belum valid.");
    }

    if (!isFlowManifestStage(stageJob.stage)) {
      throw new Error("Kontrak stage manifest belum valid.");
    }

    if (jobsByStage.has(stageJob.stage)) {
      throw new Error("Kontrak stage manifest belum lengkap.");
    }

    jobsByStage.set(stageJob.stage, stageJob);
  }

  const firstFrame = jobsByStage.get("FIRST_FRAME");
  const lastFrame = jobsByStage.get("LAST_FRAME");
  const video = jobsByStage.get("VIDEO");

  if (!firstFrame || !lastFrame || !video) {
    throw new Error("Kontrak stage manifest belum lengkap.");
  }

  const expectedFirstFrameHandles = REQUIRED_STAGE_INPUT_HANDLES.FIRST_FRAME;
  const expectedLastFrameHandles = REQUIRED_STAGE_INPUT_HANDLES.LAST_FRAME;
  const expectedVideoHandles = REQUIRED_STAGE_INPUT_HANDLES.VIDEO;

  const firstFrameInputHandles = normalizeTextArray(firstFrame.input_handles);
  const lastFrameInputHandles = normalizeTextArray(lastFrame.input_handles);
  const videoInputHandles = normalizeTextArray(video.input_handles);
  const firstFrameDependsOn = normalizeTextArray(firstFrame.depends_on_job_codes);
  const lastFrameDependsOn = normalizeTextArray(lastFrame.depends_on_job_codes);
  const videoDependsOn = normalizeTextArray(video.depends_on_job_codes);

  if (!readText(firstFrame.job_code) || !readText(lastFrame.job_code) || !readText(video.job_code)) {
    throw new Error("Kontrak stage manifest belum lengkap.");
  }

  if (!readText(firstFrame.content_code) || !readText(lastFrame.content_code) || !readText(video.content_code)) {
    throw new Error("Kontrak stage manifest belum lengkap.");
  }

  if (!readText(firstFrame.version) || !readText(lastFrame.version) || !readText(video.version)) {
    throw new Error("Kontrak stage manifest belum lengkap.");
  }

  if (!readText(firstFrame.prompt_prefix) || !readText(lastFrame.prompt_prefix) || !readText(video.prompt_prefix)) {
    throw new Error("Kontrak stage manifest belum lengkap.");
  }

  if (readText(firstFrame.clip_code) !== clipCode) {
    throw new Error("Kontrak stage manifest belum valid.");
  }

  if (readText(lastFrame.clip_code) !== clipCode || readText(video.clip_code) !== clipCode) {
    throw new Error("Kontrak stage manifest belum valid.");
  }

  if (!readText(firstFrame.prompt_copy_text)) {
    throw new Error("Teks prompt stage belum lengkap.");
  }

  if (!readText(lastFrame.prompt_copy_text)) {
    throw new Error("Teks prompt stage belum lengkap.");
  }

  if (!readText(video.prompt_copy_text)) {
    throw new Error("Teks prompt stage belum lengkap.");
  }

  validateManifestFileName(firstFrame.prompt_file_name, "Nama file prompt");
  validateManifestFileName(lastFrame.prompt_file_name, "Nama file prompt");
  validateManifestFileName(video.prompt_file_name, "Nama file prompt");
  validateManifestFileName(firstFrame.output_file_name, "Nama file output");
  validateManifestFileName(lastFrame.output_file_name, "Nama file output");
  validateManifestFileName(video.output_file_name, "Nama file output");

  if (!firstFrameInputHandles || !sameTextArray(firstFrameInputHandles, expectedFirstFrameHandles)) {
    throw new Error("Kontrak FIRST_FRAME belum valid.");
  }

  if (!lastFrameInputHandles || !sameTextArray(lastFrameInputHandles, expectedLastFrameHandles)) {
    throw new Error("Kontrak LAST_FRAME belum valid.");
  }

  if (!videoInputHandles || !sameTextArray(videoInputHandles, expectedVideoHandles)) {
    throw new Error("Kontrak VIDEO belum valid.");
  }

  if (!firstFrameDependsOn || !sameTextArray(firstFrameDependsOn, [])) {
    throw new Error("Kontrak FIRST_FRAME belum valid.");
  }

  if (!lastFrameDependsOn || !sameTextArray(lastFrameDependsOn, [firstFrame.job_code])) {
    throw new Error("Kontrak LAST_FRAME belum valid.");
  }

  if (!videoDependsOn || !sameTextArray(videoDependsOn, [firstFrame.job_code, lastFrame.job_code])) {
    throw new Error("Kontrak VIDEO belum valid.");
  }

  if (firstFrame.output_purpose !== "I2I_RESULT" || lastFrame.output_purpose !== "I2I_RESULT" || video.output_purpose !== "FINAL_VIDEO") {
    throw new Error("Kontrak stage manifest belum valid.");
  }
}

export function validateFlowBatchManifest(manifest: FlowBatchManifest) {
  if (manifest.schema_version !== FLOW_MANIFEST_SCHEMA_VERSION) {
    throw new Error("Versi manifest tidak didukung.");
  }

  if (!Array.isArray(manifest.jobs) || manifest.jobs.length === 0) {
    throw new Error("Manifest belum punya jobs.");
  }

  if (!Array.isArray(manifest.stage_jobs) || manifest.stage_jobs.length === 0) {
    throw new Error("Manifest belum punya stage jobs.");
  }

  if (!hasRequiredPromptContext(manifest.prompt_context)) {
    throw new Error("Konteks prompt belum lengkap.");
  }

  if (manifest.chrome_profile_lane_key !== null) {
    normalizeChromeProfileLaneKey(manifest.chrome_profile_lane_key);
  }

  for (const job of manifest.jobs) {
    if (!isRecord(job) || !readText(job.job_code) || !readText(job.content_code) || !readText(job.clip_code) || !readText(job.version) || !readText(job.prompt_prefix) || !readText(job.prompt_one_paragraph)) {
      throw new Error("Jobs manifest belum lengkap.");
    }

    validateManifestFileName(job.output_file_name, "Nama file output");
  }

  const stageJobsByClip = new Map<string, FlowStageManifestJob[]>();

  for (const stageJob of manifest.stage_jobs) {
    if (!isRecord(stageJob)) {
      throw new Error("Kontrak stage manifest belum valid.");
    }

    const clipCode = readText(stageJob.clip_code);

    if (!clipCode) {
      throw new Error("Kontrak stage manifest belum valid.");
    }

    const clipJobs = stageJobsByClip.get(clipCode) ?? [];
    clipJobs.push(stageJob);
    stageJobsByClip.set(clipCode, clipJobs);
  }

  for (const [clipCode, clipStageJobs] of stageJobsByClip) {
    validateStageJobGroup(clipCode, clipStageJobs);
  }
}

function normalizeUrl(value: string | null | undefined, label: string, required: boolean) {
  const trimmed = readText(value);

  if (!trimmed) {
    if (required) {
      throw new Error(`${label} wajib diisi.`);
    }

    return "";
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("invalid protocol");
    }

    return url.toString();
  } catch {
    throw new Error(`${label} harus berupa URL valid.`);
  }
}

function normalizeHelperOutputFolderKey(value: string | null | undefined) {
  const trimmed = readText(value);

  if (!trimmed) {
    throw new Error("Output key Helper wajib diisi.");
  }

  if (/[\\/:]/.test(trimmed)) {
    throw new Error("Output key Helper harus berupa label, bukan path lokal.");
  }

  return trimmed;
}

function normalizeDriveFolder(input: ExportFlowBatchManifestInput, batch: FlowBatchRecord) {
  const driveOutputFolderId = readText(input.drive_output_folder_id ?? batch.drive_output_folder_id);
  const driveOutputFolderUrl = normalizeUrl(input.drive_output_folder_url ?? batch.drive_output_folder_url, "Folder Drive", false);

  if (!driveOutputFolderId && !driveOutputFolderUrl) {
    throw new Error("Folder Drive wajib diisi.");
  }

  return {
    driveOutputFolderId,
    driveOutputFolderUrl,
  };
}

function normalizeCodeSegment(value: string | null | undefined, fallback: string) {
  const normalized = readText(value)
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

  return normalized || fallback;
}

function clipNumber(value: string, fallback: number) {
  const match = value.match(/\d+/);
  const parsed = match ? Number.parseInt(match[0], 10) : fallback;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clipCode(index: number) {
  return `CLIP${String(index).padStart(2, "0")}`;
}

function versionCode(value: string | null | undefined) {
  const trimmed = readText(value).toUpperCase();

  if (!trimmed) {
    return "V01";
  }

  const match = trimmed.match(/\d+/);
  if (!match) {
    return trimmed;
  }

  return `V${match[0].padStart(2, "0")}`;
}

function outputFileName(input: { contentCode: string; batchCode: string; clipCode: string; version: string }) {
  return [
    normalizeCodeSegment(input.contentCode, "PRODUCT"),
    normalizeCodeSegment(input.batchCode, "BATCH"),
    normalizeCodeSegment(input.clipCode, "CLIP01"),
    versionCode(input.version),
  ].join("_") + ".mp4";
}

function manifestFileName() {
  return "manifest.json";
}

function joinDrivePath(...segments: Array<string | null | undefined>) {
  return `/${segments
    .map((segment) => readText(segment))
    .filter(Boolean)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")}`;
}

function sortClipJobs(left: ClipJobRecord, right: ClipJobRecord) {
  return clipNumber(left.clip_code, 99) - clipNumber(right.clip_code, 99) || left.created_at.localeCompare(right.created_at);
}

async function buildJobsFromClipJobs(input: {
  batch: FlowBatchRecord;
  productCode: string;
  clipJobs: ClipJobRecord[];
  contentMap: Map<string, ContentRecord>;
  driveItemMap: Map<string, DriveItemRecord>;
}) {
  return [...input.clipJobs].sort(sortClipJobs).map<FlowBatchManifestJob>((job, index) => {
    const content = input.contentMap.get(job.content_id) ?? null;
    const contentCode = content?.content_code ?? input.productCode;
    const normalizedClipCode = normalizeCodeSegment(job.clip_code || clipCode(index + 1), clipCode(index + 1));
    const normalizedVersion = versionCode(job.version);

    return {
      job_code: job.job_code,
      content_code: contentCode,
      clip_code: normalizedClipCode,
      version: normalizedVersion,
      prompt_prefix: job.prompt_prefix,
      prompt_one_paragraph: job.prompt_one_paragraph,
      start_frame_drive_url: job.start_frame_drive_item_id ? input.driveItemMap.get(job.start_frame_drive_item_id)?.drive_url ?? null : null,
      last_frame_drive_url: job.last_frame_drive_item_id ? input.driveItemMap.get(job.last_frame_drive_item_id)?.drive_url ?? null : null,
      output_file_name: outputFileName({
        contentCode,
        batchCode: input.batch.batch_code,
        clipCode: normalizedClipCode,
        version: normalizedVersion,
      }),
    };
  });
}

async function buildJobsFromPromptPack(input: {
  batch: FlowBatchRecord;
  productCode: string;
  promptPack: Awaited<ReturnType<typeof getPromptPackById>> | null;
  promptSet?: ReturnType<typeof readPromptPackEditorPromptSet>;
}) {
  const promptPack = input.promptPack;

  if (!promptPack) {
    throw new Error("Prompt pack tidak tersedia.");
  }

  const promptSet = input.promptSet ?? readPromptPackEditorPromptSet(promptPack);

  return PROMPT_CLIP_KEYS.map<FlowBatchManifestJob>((key, index) => {
    const currentClipCode = clipCode(index + 1);
    const currentVersion = "V01";
    const clip = promptSet.clips[key];
    const promptParagraph = readText(clip.i2v_prompt) || [clip.i2i_first_frame, clip.i2i_last_frame].map(readText).filter(Boolean).join(" ");

    if (!promptParagraph) {
      throw new Error("Prompt clip belum lengkap.");
    }

    return {
      job_code: `${input.batch.batch_code}-${currentClipCode}`,
      content_code: input.productCode,
      clip_code: currentClipCode,
      version: currentVersion,
      prompt_prefix: [promptPack.prompt_code, input.productCode, currentClipCode].filter(Boolean).join(" / "),
      prompt_one_paragraph: promptParagraph,
      start_frame_drive_url: null,
      last_frame_drive_url: null,
      output_file_name: outputFileName({
        contentCode: input.productCode,
        batchCode: input.batch.batch_code,
        clipCode: currentClipCode,
        version: currentVersion,
      }),
    };
  });
}

function buildStageJobsFromPromptPack(input: {
  batch: FlowBatchRecord;
  productCode: string;
  promptPack: Awaited<ReturnType<typeof getPromptPackById>> | null;
}) {
  if (!input.promptPack) {
    return {
      promptContext: null,
      stageJobs: [],
      promptSet: null,
    };
  }

  const promptSet = readPromptPackEditorPromptSet(input.promptPack);

  return {
    promptContext: promptSet.prompt_context,
    stageJobs: buildFlowStageManifestJobs({
      batchCode: input.batch.batch_code,
      productCode: input.productCode,
      promptCode: input.promptPack.prompt_code,
      promptSet,
      version: "V01",
    }),
    promptSet,
  };
}

async function buildManifest(input: {
  batch: FlowBatchRecord;
  flowUrl: string;
  driveOutputFolderId: string;
  driveOutputFolderUrl: string;
  helperOutputFolderKey: string;
  chromeProfileLaneKey: string | null;
}) {
  const [flowAccount, product, promptPack, clipJobs, contents, driveItems] = await Promise.all([
    getFlowAccountById(input.batch.flow_account_id),
    input.batch.product_id ? getProductById(input.batch.product_id) : Promise.resolve(null),
    input.batch.prompt_pack_id ? getPromptPackById(input.batch.prompt_pack_id) : Promise.resolve(null),
    listClipJobs({ batchId: input.batch.id, limit: 20 }),
    input.batch.product_id ? listContents({ productId: input.batch.product_id, limit: 200 }) : Promise.resolve([]),
    listDriveItems({ limit: 200 }),
  ]);

  if (!flowAccount) {
    throw new Error("Akun Flow tidak tersedia.");
  }

  const productCode = normalizeCodeSegment(product?.product_code, "PRODUCT");
  const contentMap = new Map(contents.map((content) => [content.id, content]));
  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));
  const manifestClipJobs = [...clipJobs].sort(sortClipJobs).slice(0, PROMPT_CLIP_KEYS.length);
  const chromeProfileLaneKey =
    normalizeChromeProfileLaneKey(input.chromeProfileLaneKey) ??
    readManifestLaneKey(input.batch.manifest_json) ??
    readChromeProfileLaneKey(flowAccount.notes);
  const stageManifest = buildStageJobsFromPromptPack({
    batch: input.batch,
    productCode,
    promptPack,
  });
  const jobs = manifestClipJobs.length === PROMPT_CLIP_KEYS.length
    ? await buildJobsFromClipJobs({
        batch: input.batch,
        productCode,
        clipJobs: manifestClipJobs,
        contentMap,
        driveItemMap,
      })
    : await buildJobsFromPromptPack({
        batch: input.batch,
        productCode,
        promptPack,
        promptSet: stageManifest.promptSet ?? undefined,
      });

  return {
    schema_version: FLOW_MANIFEST_SCHEMA_VERSION,
    batch_id: input.batch.id,
    batch_code: input.batch.batch_code,
    target_date: input.batch.target_date,
    model: input.batch.model,
    max_jobs: input.batch.max_jobs,
    flow_account_code: flowAccount.account_code,
    chrome_profile_lane_key: chromeProfileLaneKey,
    flow_url: input.flowUrl,
    drive_output_folder_id: input.driveOutputFolderId,
    drive_output_folder_url: input.driveOutputFolderUrl,
    helper_output_folder_key: input.helperOutputFolderKey,
    rename_pattern: outputFileName({
      contentCode: productCode,
      batchCode: input.batch.batch_code,
      clipCode: "CLIP01",
      version: "V01",
    }),
    prompt_context: stageManifest.promptContext,
    stage_jobs: stageManifest.stageJobs,
    jobs,
  } satisfies FlowBatchManifest;
}

async function persistManifestFileToDrive(input: {
  batch: FlowBatchRecord;
  manifest: FlowBatchManifest;
  driveOutputFolderId: string;
}) {
  if (!input.driveOutputFolderId) {
    return null;
  }

  const name = manifestFileName();
  const drivePath = joinDrivePath(
    "AffiliateAI",
    "03_BATCHES",
    input.batch.target_date,
    input.batch.batch_code,
    input.manifest.flow_account_code,
    name,
  );
  const bytes = Buffer.from(JSON.stringify(input.manifest, null, 2), "utf8");

  return await writeGeneratedDriveFile({
    bytes,
    description: `Flow manifest ${input.batch.batch_code}`,
    drivePath,
    mimeType: "application/json",
    name,
    notes: `Flow manifest ${input.batch.batch_code}`,
    parentDriveFolderId: input.driveOutputFolderId,
    purpose: "EXPORT_FILE",
  });
}

export async function exportFlowBatchManifest(batchId: string, input: ExportFlowBatchManifestInput) {
  const batch = await getFlowBatchById(batchId);

  if (!batch) {
    throw new Error("Flow batch tidak ditemukan.");
  }

  if (batch.status === "DRAFT") {
    throw new Error("Batch belum siap ekspor.");
  }

  if (batch.status === "CLOSED") {
    throw new Error("Batch sudah ditutup.");
  }

  const flowUrl = normalizeUrl(input.flow_url ?? batch.flow_url, "Flow URL", true);
  const helperOutputFolderKey = normalizeHelperOutputFolderKey(input.helper_output_folder_key ?? batch.helper_output_folder_key);
  const chromeProfileLaneKey = normalizeNullableText(input.chrome_profile_lane_key ?? readManifestLaneKey(batch.manifest_json));
  const { driveOutputFolderId, driveOutputFolderUrl } = normalizeDriveFolder(input, batch);
  const manifest = await buildManifest({
    batch,
    flowUrl,
    driveOutputFolderId,
    driveOutputFolderUrl,
    helperOutputFolderKey,
    chromeProfileLaneKey,
  });

  validateFlowBatchManifest(manifest);

  await persistManifestFileToDrive({
    batch,
    driveOutputFolderId,
    manifest,
  });

  await updateFlowBatch(batch.id, {
    flow_url: flowUrl,
    drive_output_folder_id: driveOutputFolderId,
    drive_output_folder_url: driveOutputFolderUrl,
    helper_output_folder_key: helperOutputFolderKey,
    manifest_json: manifest,
    status: batch.status === "READY_TO_EXPORT" ? "EXPORTED" : batch.status,
  });

  return manifest;
}

export async function getPersistedFlowBatchManifest(batchId: string) {
  const batch = await getFlowBatchById(batchId);

  if (!batch) {
    throw new Error("Flow batch tidak ditemukan.");
  }

  if (!isRecord(batch.manifest_json)) {
    throw new Error("Manifest belum diekspor.");
  }

  return {
    batch,
    manifest: batch.manifest_json as FlowBatchManifest,
  };
}
