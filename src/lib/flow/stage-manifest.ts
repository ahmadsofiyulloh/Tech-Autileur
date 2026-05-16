import type { PromptPackEditorPromptSet } from "@/lib/prompts/prompt-pack-contract";
import { PROMPT_CLIP_KEYS, type PromptClipKey } from "@/lib/prompts/validation";

export const FLOW_MANIFEST_SCHEMA_VERSION = "flow_manifest_v2" as const;

export const FLOW_MANIFEST_STAGES = ["FIRST_FRAME", "LAST_FRAME", "VIDEO"] as const;

export type FlowManifestStage = (typeof FLOW_MANIFEST_STAGES)[number];

export type FlowStageManifestJob = {
  job_code: string;
  content_code: string;
  clip_code: string;
  version: string;
  stage: FlowManifestStage;
  stage_order: number;
  prompt_prefix: string;
  prompt_file_name: string;
  prompt_copy_text: string;
  input_handles: string[];
  output_purpose: "I2I_RESULT" | "FINAL_VIDEO";
  output_file_name: string;
  depends_on_job_codes: string[];
};

const FLOW_STAGE_INPUT_HANDLES = {
  FIRST_FRAME: ["@character", "@environment", "@product"],
  LAST_FRAME: ["@firstframe"],
  VIDEO: ["@firstframe", "@lastframe"],
} as const satisfies Record<FlowManifestStage, readonly string[]>;

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCodeSegment(value: string | null | undefined, fallback: string) {
  const normalized = readText(value)
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

  return normalized || fallback;
}

function clipCode(index: number) {
  return `CLIP${String(index).padStart(2, "0")}`;
}

function promptClipFilePrefix(key: PromptClipKey) {
  return key;
}

function stageJobCode(input: { batchCode: string; clipCode: string; stage: FlowManifestStage }) {
  return [
    normalizeCodeSegment(input.batchCode, "BATCH"),
    normalizeCodeSegment(input.clipCode, "CLIP01"),
    input.stage.replace("_", "-"),
  ].join("-");
}

function outputFileName(input: {
  contentCode: string;
  batchCode: string;
  clipCode: string;
  version: string;
  stage: FlowManifestStage;
}) {
  const base = [
    normalizeCodeSegment(input.contentCode, "PRODUCT"),
    normalizeCodeSegment(input.batchCode, "BATCH"),
    normalizeCodeSegment(input.clipCode, "CLIP01"),
    normalizeCodeSegment(input.version, "V01"),
  ].join("_");

  if (input.stage === "FIRST_FRAME") {
    return `${base}_FIRSTFRAME.png`;
  }

  if (input.stage === "LAST_FRAME") {
    return `${base}_LASTFRAME.png`;
  }

  return `${base}.mp4`;
}

function stagePromptFileName(clipKey: PromptClipKey, stage: FlowManifestStage) {
  const prefix = promptClipFilePrefix(clipKey);

  if (stage === "FIRST_FRAME") {
    return `${prefix}_i2i_first_frame.txt`;
  }

  if (stage === "LAST_FRAME") {
    return `${prefix}_i2i_last_frame.txt`;
  }

  return `${prefix}_i2v.txt`;
}

export function isFlowManifestStage(value: string): value is FlowManifestStage {
  return (FLOW_MANIFEST_STAGES as readonly string[]).includes(value);
}

export function normalizeFlowManifestStage(value: string | null | undefined, fallback: FlowManifestStage = "VIDEO") {
  const normalized = readText(value).toUpperCase();

  if (!normalized) {
    return fallback;
  }

  if (!isFlowManifestStage(normalized)) {
    throw new Error(`stage harus salah satu dari: ${FLOW_MANIFEST_STAGES.join(", ")}.`);
  }

  return normalized;
}

export function flowStageDrivePurpose(stage: FlowManifestStage) {
  return stage === "VIDEO" ? "FINAL_VIDEO" : "I2I_RESULT";
}

export function buildFlowStageManifestJobs(input: {
  batchCode: string;
  productCode: string;
  promptCode?: string | null;
  promptSet: PromptPackEditorPromptSet;
  version?: string | null;
}) {
  const batchCode = normalizeCodeSegment(input.batchCode, "BATCH");
  const productCode = normalizeCodeSegment(input.productCode, "PRODUCT");
  const version = normalizeCodeSegment(input.version, "V01");
  const promptCode = normalizeCodeSegment(input.promptCode, "");
  const jobs: FlowStageManifestJob[] = [];

  PROMPT_CLIP_KEYS.forEach((clipKey, index) => {
    const currentClipCode = clipCode(index + 1);
    const clip = input.promptSet.clips[clipKey];
    const promptPrefix = [promptCode, productCode, currentClipCode].filter(Boolean).join(" / ");
    const firstFrameJobCode = stageJobCode({ batchCode, clipCode: currentClipCode, stage: "FIRST_FRAME" });
    const lastFrameJobCode = stageJobCode({ batchCode, clipCode: currentClipCode, stage: "LAST_FRAME" });
    const videoJobCode = stageJobCode({ batchCode, clipCode: currentClipCode, stage: "VIDEO" });

    jobs.push({
      job_code: firstFrameJobCode,
      content_code: productCode,
      clip_code: currentClipCode,
      version,
      stage: "FIRST_FRAME",
      stage_order: 10 + index,
      prompt_prefix: promptPrefix,
      prompt_file_name: stagePromptFileName(clipKey, "FIRST_FRAME"),
      prompt_copy_text: clip.i2i_first_frame,
      input_handles: [...FLOW_STAGE_INPUT_HANDLES.FIRST_FRAME],
      output_purpose: flowStageDrivePurpose("FIRST_FRAME"),
      output_file_name: outputFileName({
        contentCode: productCode,
        batchCode,
        clipCode: currentClipCode,
        version,
        stage: "FIRST_FRAME",
      }),
      depends_on_job_codes: [],
    });

    jobs.push({
      job_code: lastFrameJobCode,
      content_code: productCode,
      clip_code: currentClipCode,
      version,
      stage: "LAST_FRAME",
      stage_order: 20 + index,
      prompt_prefix: promptPrefix,
      prompt_file_name: stagePromptFileName(clipKey, "LAST_FRAME"),
      prompt_copy_text: clip.i2i_last_frame,
      input_handles: [...FLOW_STAGE_INPUT_HANDLES.LAST_FRAME],
      output_purpose: flowStageDrivePurpose("LAST_FRAME"),
      output_file_name: outputFileName({
        contentCode: productCode,
        batchCode,
        clipCode: currentClipCode,
        version,
        stage: "LAST_FRAME",
      }),
      depends_on_job_codes: [firstFrameJobCode],
    });

    jobs.push({
      job_code: videoJobCode,
      content_code: productCode,
      clip_code: currentClipCode,
      version,
      stage: "VIDEO",
      stage_order: 30 + index,
      prompt_prefix: promptPrefix,
      prompt_file_name: stagePromptFileName(clipKey, "VIDEO"),
      prompt_copy_text: clip.i2v_prompt,
      input_handles: [...FLOW_STAGE_INPUT_HANDLES.VIDEO],
      output_purpose: flowStageDrivePurpose("VIDEO"),
      output_file_name: outputFileName({
        contentCode: productCode,
        batchCode,
        clipCode: currentClipCode,
        version,
        stage: "VIDEO",
      }),
      depends_on_job_codes: [firstFrameJobCode, lastFrameJobCode],
    });
  });

  return jobs.sort((left, right) => left.stage_order - right.stage_order);
}
