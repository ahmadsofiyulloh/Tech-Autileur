import { expect, test } from "@playwright/test";
import {
  validateFlowBatchManifest,
  type FlowBatchManifest,
  type FlowBatchManifestJob,
} from "../../src/lib/server/flow-manifests";
import {
  FLOW_MANIFEST_SCHEMA_VERSION,
  buildFlowStageManifestJobs,
} from "../../src/lib/flow/stage-manifest";
import type { PromptPackEditorPromptSet } from "../../src/lib/prompts/prompt-pack-contract";

function buildPromptSetFixture() {
  return {
    clips: {
      clip_1: {
        i2i_first_frame: "Clip 1 first frame prompt.",
        i2i_last_frame: "Clip 1 last frame prompt.",
        i2v_prompt: "Clip 1 video prompt.",
      },
      clip_2: {
        i2i_first_frame: "Clip 2 first frame prompt.",
        i2i_last_frame: "Clip 2 last frame prompt.",
        i2v_prompt: "Clip 2 video prompt.",
      },
    },
    caption: "Caption.",
    tags: "#tag",
    target_marketplace: "Shopee + TikTok",
    prompt_context: {
      product: {
        product_name: "Tas selempang",
      },
      affiliate_profile: {
        profile_name: "Profil utama",
      },
      reference_cards: [
        { kind: "CHARACTER" },
        { kind: "ENVIRONMENT" },
        { kind: "PRODUCT" },
      ],
    },
    seed_character: {
      locked: false,
    },
    environment: {
      locked: false,
    },
  } as unknown as PromptPackEditorPromptSet;
}

function buildValidManifest(overrides?: Partial<FlowBatchManifest>): FlowBatchManifest {
  const promptSet = buildPromptSetFixture();
  const stageJobs = buildFlowStageManifestJobs({
    batchCode: "BATCH-001",
    productCode: "PRODUCT-001",
    promptCode: "PROMPT-001",
    promptSet,
    version: "V01",
  });
  const jobs: FlowBatchManifestJob[] = [
    {
      job_code: "BATCH-001-CLIP01",
      content_code: "PRODUCT-001",
      clip_code: "CLIP01",
      version: "V01",
      prompt_prefix: "PROMPT-001 / PRODUCT-001 / CLIP01",
      prompt_one_paragraph: "Clip 1 video prompt.",
      start_frame_drive_url: "https://drive.google.com/file/d/clip-1-first/view",
      last_frame_drive_url: "https://drive.google.com/file/d/clip-1-last/view",
      output_file_name: "PRODUCT_001_BATCH_001_CLIP01_V01.mp4",
    },
    {
      job_code: "BATCH-001-CLIP02",
      content_code: "PRODUCT-001",
      clip_code: "CLIP02",
      version: "V01",
      prompt_prefix: "PROMPT-001 / PRODUCT-001 / CLIP02",
      prompt_one_paragraph: "Clip 2 video prompt.",
      start_frame_drive_url: "https://drive.google.com/file/d/clip-2-first/view",
      last_frame_drive_url: "https://drive.google.com/file/d/clip-2-last/view",
      output_file_name: "PRODUCT_001_BATCH_001_CLIP02_V01.mp4",
    },
  ];

  return {
    schema_version: FLOW_MANIFEST_SCHEMA_VERSION,
    batch_id: "batch-001",
    batch_code: "BATCH-001",
    target_date: "2026-05-17",
    model: "google-flow",
    max_jobs: 2,
    flow_account_code: "FLOW-001",
    chrome_profile_lane_key: "utama",
    flow_url: "https://labs.google.com/fx/tools/flow",
    drive_output_folder_id: "drive-folder-001",
    drive_output_folder_url: "https://drive.google.com/drive/folders/drive-folder-001",
    helper_output_folder_key: "helper-output",
    rename_pattern: "PRODUCT_001_BATCH_001_CLIP01_V01.mp4",
    prompt_context: promptSet.prompt_context,
    stage_jobs: stageJobs,
    jobs,
    ...overrides,
  };
}

test("valid flow manifest exports pass semantic validation", () => {
  expect(() => validateFlowBatchManifest(buildValidManifest())).not.toThrow();
});

test("empty jobs cannot be exported", () => {
  const manifest = buildValidManifest({ jobs: [] });

  expect(() => validateFlowBatchManifest(manifest)).toThrow("Manifest belum punya jobs.");
});

test("empty stage jobs cannot be exported", () => {
  const manifest = buildValidManifest({ stage_jobs: [] });

  expect(() => validateFlowBatchManifest(manifest)).toThrow("Manifest belum punya stage jobs.");
});

test("empty prompt copy text cannot be exported", () => {
  const manifest = buildValidManifest({
    stage_jobs: buildValidManifest().stage_jobs.map((job, index) =>
      index === 0 ? { ...job, prompt_copy_text: "   " } : job,
    ),
  });

  expect(() => validateFlowBatchManifest(manifest)).toThrow("Teks prompt stage belum lengkap.");
});

test("unsafe prompt and output file names cannot be exported", () => {
  const manifest = buildValidManifest({
    stage_jobs: buildValidManifest().stage_jobs.map((job, index) =>
      index === 0
        ? { ...job, prompt_file_name: "../clip_1_i2i_first_frame.txt" }
        : index === 1
          ? { ...job, output_file_name: "clip/unsafe.png" }
          : job,
    ),
  });

  expect(() => validateFlowBatchManifest(manifest)).toThrow(/Nama file (prompt|output) tidak valid\./);
});

test("FIRST_FRAME, LAST_FRAME, and VIDEO stage dependencies must match the contract", () => {
  const manifest = buildValidManifest({
    stage_jobs: buildValidManifest().stage_jobs.map((job) =>
      job.stage === "VIDEO" ? { ...job, depends_on_job_codes: [job.depends_on_job_codes[0]] } : job,
    ),
  });

  expect(() => validateFlowBatchManifest(manifest)).toThrow("Kontrak VIDEO belum valid.");
});

test("stage input handles must match the contract", () => {
  const manifest = buildValidManifest({
    stage_jobs: buildValidManifest().stage_jobs.map((job) =>
      job.stage === "FIRST_FRAME" ? { ...job, input_handles: ["@character", "@product"] } : job,
    ),
  });

  expect(() => validateFlowBatchManifest(manifest)).toThrow("Kontrak FIRST_FRAME belum valid.");
});

test("missing prompt context cannot be exported", () => {
  const manifest = buildValidManifest({ prompt_context: null });

  expect(() => validateFlowBatchManifest(manifest)).toThrow("Konteks prompt belum lengkap.");
});
