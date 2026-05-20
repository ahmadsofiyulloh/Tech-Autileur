import { expect, test } from "@playwright/test";
import {
  PROMPT_PACK_GEMINI_KEY_PRIORITY,
  VISION_MODEL_NAMES,
  getGeminiQuotaGroupKey,
  hasConfiguredGeminiQuotaLimits,
} from "../../src/lib/gemini/routing";
import {
  GEMINI_MODEL_OPTIONS,
  GEMINI_MODEL_QUOTA_DEFAULTS,
  GEMINI_MODELS,
  GEMINI_ZERO_QUOTA_MODELS,
  isGeminiDatabaseModelName,
  isGeminiModelName,
  supportsGeminiStructuredOutputTools,
} from "../../src/lib/gemini/validation";
import {
  GEMINI_INTAKE_VISION_RESPONSE_SCHEMA,
  GEMINI_PROMPT_PACK_RESPONSE_SCHEMA,
} from "../../src/lib/gemini/json-schemas";
import { parseIntakeVisionOutput } from "../../src/lib/intake/vision-contract";
import {
  PROMPT_PACK_COPY_SCHEMA_VERSION,
  PROMPT_PACK_I2V_COPY_ASPECT_RATIO,
  PROMPT_PACK_I2V_COPY_MODEL,
  PROMPT_PACK_I2V_DURATION_SECONDS,
  PROMPT_PACK_I2V_TIMELINE_WINDOWS,
  PROMPT_PACK_SHOPEE_COPY_MAX_CHARS,
  PROMPT_PACK_VO_MAX_CHARS,
  buildPromptPackEditorStoragePayload,
  buildPromptPackStoragePayload,
  buildStructuredI2VPromptForCopy,
  parsePromptPackGenerationOutput,
  readPromptPackEditorPromptSet,
  type PromptPackGenerationOutput,
  type PromptPackPromptRulesJson,
  type PromptPackVisualReferenceJson,
  type PromptPackVisualReferenceKind,
  type PromptPackVisualReferenceRole,
  type JsonObject,
} from "../../src/lib/prompts/prompt-pack-contract";
import {
  isGeminiTemporaryUnavailableMessage,
  sanitizeGeminiStatusMessage,
} from "../../src/lib/gemini/error-message";
import { isAffiliateProfileSchemaMissingError } from "../../src/lib/affiliate-profiles/schema-errors";
import { canonicalizeAffiliateProfileAssetAnalysisJson } from "../../src/lib/affiliate-profiles/asset-reanalysis";
import {
  getAffiliateProfileAssetAnalysisState,
  isAffiliateProfileAssetAnalysisReady,
  isAffiliateProfilePromptReady,
} from "../../src/lib/affiliate-profiles/readiness";
import { assertUploadedImage, prepareGeminiCompatibleUploadImage } from "../../src/lib/intake/upload-validation";
import { getPromptLaunchReadiness } from "../../src/lib/prompts/prompt-launch-readiness";
import { projectPromptReadiness } from "../../src/lib/prompts/prompt-readiness-projection";
import {
  countPromptWorkbenchRows,
  filterPromptWorkbenchRows,
  normalizePromptWorkbenchReadinessFilter,
} from "../../src/lib/prompts/prompt-workbench";
import { createPromptWorkbenchPageCollector } from "../../src/lib/prompts/prompt-workbench-collector";
import { buildContentVariantPromptCode } from "../../src/lib/prompts/content-variants";
import {
  REGENERATION_SCOPES,
  getRegenerationScope,
  isRegenerationScopeKey,
} from "../../src/lib/prompts/prompt-regeneration";
import {
  buildFlowStageManifestJobs,
  flowStageDrivePurpose,
} from "../../src/lib/flow/stage-manifest";
import { getGeminiFailureDisposition } from "../../src/lib/server/gemini-failure-policy";
import sharp from "sharp";

type PromptPackFixtureOptions = {
  productStatus?: string;
  sourceImage?:
    | {
        id: string;
        is_primary: boolean;
        status: string;
        source_type: string;
        drive_item_ref_id: string;
        analysis_json: JsonObject | null;
      }
    | null;
};

function buildCompactReferenceCard(
  kind: PromptPackVisualReferenceKind,
  label: string,
  mention: string,
  role: PromptPackVisualReferenceRole,
  summary: string,
  mustKeep: string[],
  mustAvoid: string[],
  driveItemRefId: string,
): PromptPackVisualReferenceJson {
  return {
    kind,
    label,
    mention,
    role,
    summary,
    must_keep: mustKeep,
    must_avoid: mustAvoid,
    instruction: `${mention} is the ${role.replace(/_/g, " ")} for ${kind.toLowerCase()}-driven image-to-image generation.`,
    drive_item_ref_id: driveItemRefId,
    drive_url: null,
    drive_path: null,
    analysis_json: null,
  };
}

function buildTestI2VTimeline() {
  return PROMPT_PACK_I2V_TIMELINE_WINDOWS.map((time, index) => ({
    time,
    action:
      index === 0
        ? "start from @firstframe single first image"
        : index === 3
          ? "resolve from the same first-frame setup with @lastframe kept for compatibility"
          : "continue the same first-frame setup into smooth product motion",
  }));
}

function buildTestI2IFrame<TSlot extends "clip_1" | "clip_2">(input: {
  slot: TSlot;
  frame: "first_frame" | "last_frame";
  promptText: string;
}): PromptPackGenerationOutput["i2i_prompts"][TSlot]["first_frame"] {
  return {
    schema_version: PROMPT_PACK_COPY_SCHEMA_VERSION,
    slot: input.slot,
    stage: input.frame === "first_frame" ? "i2i_first_frame" : "i2i_last_frame",
    image_inputs: input.frame === "first_frame" ? ["@character", "@environment", "@product.png"] : ["@firstframe"],
    prompt_text: input.promptText,
    must_keep: ["keep product shape"],
    must_avoid: ["no extra props"],
  } as PromptPackGenerationOutput["i2i_prompts"][TSlot]["first_frame"];
}

function buildTestI2VPrompt<TSlot extends "clip_1" | "clip_2">(
  slot: TSlot,
  promptText: string,
): PromptPackGenerationOutput["i2v_prompts"][TSlot] {
  return {
    schema_version: PROMPT_PACK_COPY_SCHEMA_VERSION,
    slot,
    stage: "i2v",
    duration_seconds: PROMPT_PACK_I2V_DURATION_SECONDS,
    frame_inputs: ["@firstframe", "@lastframe"],
    timeline: buildTestI2VTimeline(),
    motion_prompt: `${promptText} motion`,
    camera_motion: "slow push-in",
    prompt_text: promptText,
    continuity: "use @firstframe as the single starting image while @lastframe stays legacy-compatible",
    negative_prompt: "no extra props",
    audio: {
      voiceover_text: slot === "clip_1" ? "Cek detail produk ini dalam dua detik pertama." : "Detailnya jelas untuk bahan pertimbangan checkout.",
      voiceover_timing: "00:00-00:02",
      voice_style: "natural Indonesian UGC",
      sfx_cues: "soft product handling",
      ambient_cues: "quiet indoor room tone",
    },
  } as PromptPackGenerationOutput["i2v_prompts"][TSlot];
}

function expectNoLegacyI2VCopyReference(value: unknown) {
  const text = JSON.stringify(value).toLowerCase();

  for (const phrase of ["@lastframe", "last frame", "last-frame", "ending frame", "final frame"]) {
    expect(text).not.toContain(phrase);
  }
}

function buildReadyAffiliateProfile() {
  return {
    status: "ACTIVE",
    workspace_ids: ["workspace-1"],
    i2i_prompt_rules: "keep product shape",
    i2v_prompt_rules: "keep continuity",
    caption_rules: "short caption",
    hashtag_rules: "#tag",
    negative_prompt_rules: "avoid blur",
    product_positioning_notes: "product-first",
    lock_seed_character: false,
    seed_character_drive_item_ref_id: null,
    seed_character_analysis_json: null,
    lock_environment: false,
    environment_drive_item_ref_id: null,
    environment_analysis_json: null,
  };
}

function buildCompleteReviewedMetadata(overrides: Record<string, unknown> = {}) {
  return {
    nama_produk: "Tas Selempang Travel",
    keyword_cari_etalase: "tas selempang",
    deskripsi_visual: "Tas selempang hitam compact dengan beberapa kantong depan.",
    use_case: "Dipakai untuk membawa barang harian saat kerja atau jalan.",
    pain_point: "Barang kecil sering tercecer saat bepergian.",
    selling_angle: "Banyak kompartemen dalam ukuran compact.",
    target_viewer: "Pria dan wanita aktif yang sering mobile.",
    ...overrides,
  };
}

function buildPromptPackFixture(options?: PromptPackFixtureOptions) {
  const sharedVisualReferences = [
    buildCompactReferenceCard(
      "CHARACTER",
      "Character",
      "@character.png",
      "supporting_reference",
      "Young East Asian man portrait used only as a supporting identity anchor.",
      ["young East Asian man", "dark wavy hair", "dark grey hoodie", "neutral expression"],
      ["smiling", "accessories", "complex background", "other people", "dynamic pose"],
      "character-ref",
    ),
    buildCompactReferenceCard(
      "ENVIRONMENT",
      "Environment",
      "@environment.png",
      "background_anchor",
      "Industrial room with concrete walls and warm accent lighting.",
      ["black mannequin", "black t-shirt", "industrial background", "concrete walls", "warm accent lighting"],
      ["bright colors", "cluttered background", "outdoor setting", "people", "other clothing items"],
      "environment-ref",
    ),
    buildCompactReferenceCard(
      "PRODUCT",
      "Product",
      "@product.png",
      "primary_subject",
      "Apparel product reference for the front-facing garment.",
      ["keep product shape", "keep garment readable", "keep product-first composition"],
      ["extra props", "extra text", "identity drift", "cluttered scene"],
      "product-ref",
    ),
  ] satisfies PromptPackVisualReferenceJson[];
  return {
    product_analysis: {
      mode: "gemini",
      prompt_code: "PROMPT-1",
      version: 1,
      product: {
        id: "product-id",
        product_code: "PROD-1",
        product_name: "Tas",
        niche: "Fashion",
        marketplace: "Shopee + TikTok",
        marketplace_product_link: null,
        status: options?.productStatus ?? "IMAGE_ANALYZED",
      },
      source_image: options?.sourceImage ?? null,
      coverage: {
        vision_analysis: 1,
        prompt_clips: 2,
      },
      vision_analysis: {
        summary: "Tas compact",
        hero_direction: "Use profile positioning",
        scene_constraints: ["Keep product readable"],
        risks: ["Do not invent packaging"],
      },
    },
    prompt_context: {
      mode: "server_injected",
      reference_cards: sharedVisualReferences,
    },
    i2i_prompts: {
      clip_1: {
        slot: "clip_1",
        first_frame: buildTestI2IFrame({ slot: "clip_1", frame: "first_frame", promptText: "first" }),
        last_frame: buildTestI2IFrame({ slot: "clip_1", frame: "last_frame", promptText: "last" }),
      },
      clip_2: {
        slot: "clip_2",
        first_frame: buildTestI2IFrame({ slot: "clip_2", frame: "first_frame", promptText: "first" }),
        last_frame: buildTestI2IFrame({ slot: "clip_2", frame: "last_frame", promptText: "last" }),
      },
    },
    i2v_prompts: {
      clip_1: buildTestI2VPrompt("clip_1", "motion one"),
      clip_2: buildTestI2VPrompt("clip_2", "motion two"),
    },
    caption: "Caption",
    tags: "#tas #shopee",
    upload_copy: {
      shopee_caption: "Caption",
      shopee_tags: "#tas #shopee",
      shopee_caption_tags: "Caption #tas #shopee",
    },
    target_marketplace: "Shopee + TikTok",
    negative_prompt_rules: ["no extra props"],
    consistency_rules: ["same product silhouette"],
    seed_character: { locked: false, notes: "", drive_item_ref_id: null },
    environment: { locked: false, notes: "", drive_item_ref_id: null },
  } satisfies PromptPackGenerationOutput;
}

function buildPromptPackServerContextFixture(): JsonObject {
  const sharedReferenceCards = [
    buildCompactReferenceCard(
      "CHARACTER",
      "Character",
      "@character.png",
      "supporting_reference",
      "Young East Asian man portrait used only as a supporting identity anchor.",
      ["young East Asian man", "dark wavy hair", "dark grey hoodie", "neutral expression"],
      ["smiling", "accessories", "complex background", "other people", "dynamic pose"],
      "character-ref",
    ),
    buildCompactReferenceCard(
      "ENVIRONMENT",
      "Environment",
      "@environment.png",
      "background_anchor",
      "Industrial room with concrete walls and warm accent lighting.",
      ["black mannequin", "black t-shirt", "industrial background", "concrete walls", "warm accent lighting"],
      ["bright colors", "cluttered background", "outdoor setting", "people", "other clothing items"],
      "environment-ref",
    ),
    buildCompactReferenceCard(
      "PRODUCT",
      "Product",
      "@product.png",
      "primary_subject",
      "Apparel product reference for the front-facing garment.",
      ["keep product shape", "keep garment readable", "keep product-first composition"],
      ["extra props", "extra text", "identity drift", "cluttered scene"],
      "product-ref",
    ),
  ] satisfies PromptPackVisualReferenceJson[];

  return {
    mode: "server_injected",
    reference_cards: sharedReferenceCards,
    prompt_writing_contract: {
      mode: "FLOW_I2I_SINGLE_FRAME_I2V_PROMPT_PACK_V2",
      schema_version: PROMPT_PACK_COPY_SCHEMA_VERSION,
      first_frame_image_inputs: ["@character", "@environment", "@product"],
      last_frame_image_inputs: ["@firstframe"],
      i2v_frame_inputs: ["@firstframe", "@lastframe"],
      i2v_duration_seconds: PROMPT_PACK_I2V_DURATION_SECONDS,
      i2v_timeline_windows: [...PROMPT_PACK_I2V_TIMELINE_WINDOWS],
      clip_roles: {
        clip_1: "hook/hero look",
        clip_2: "detail/benefit/use-case look",
      },
      mention_format: "@original_file_name for product, @character and @environment for locked profile references",
      subject_priority: ["PRODUCT", "CHARACTER", "ENVIRONMENT"],
      max_prompt_sentences: 3,
      no_raw_analysis_json: true,
      no_raw_prompt_rules_in_output: true,
    },
    product: {
      id: "product-id",
      product_code: "PROD-1",
      product_name: "Tas",
      niche: "Fashion",
      marketplace: "Shopee + TikTok",
      marketplace_product_link: null,
      status: "IMAGE_ANALYZED",
    },
    affiliate_profile: {
      rules: {
        i2i_prompt_rules: ["{", '"i2i_prompt_rules": ["keep product shape"]', "}"],
        i2v_prompt_rules: ["{", '"i2v_prompt_rules": ["keep motion smooth"]', "}"],
        caption_rules: ["{", '"caption_rules": ["short caption"]', "}"],
        hashtag_rules: ["{", '"hashtag_rules": ["#tas"]', "}"],
        negative_prompt_rules: ["{", '"negative_prompt_rules": ["no extra props"]', "}"],
        product_positioning_notes: ["{", '"product_positioning_notes": ["highlight the bag silhouette"]', "}"],
      },
      seed_character: {
        locked: true,
        notes: "Lock the character silhouette.",
        drive_item_ref_id: "character-ref",
        analysis_json: null,
        drive_item: {
          id: "character-drive-item",
          name: "character.png",
          drive_path: "/assets/character.png",
          drive_url: "https://example.com/character.png",
          mime_type: "image/png",
        },
      },
      environment: {
        locked: false,
        notes: "Use the default background.",
        drive_item_ref_id: "environment-ref",
        analysis_json: null,
        drive_item: {
          id: "environment-drive-item",
          name: "environment.png",
          drive_path: "/assets/environment.png",
          drive_url: "https://example.com/environment.png",
          mime_type: "image/png",
        },
      },
    },
    source_image: {
      id: "source-image-id",
      is_primary: true,
      status: "ATTACHED",
      source_type: "GOOGLE_DRIVE",
      drive_item_ref_id: "product-ref",
      analysis_json: null,
      drive_item: {
        id: "product-drive-item",
        name: "product.png",
        drive_path: "/assets/product.png",
        drive_url: "https://example.com/product.png",
        mime_type: "image/png",
      },
    },
  } satisfies JsonObject;
}

function buildPromptPackCompactFixture(options?: PromptPackFixtureOptions) {
  const fullFixture = buildPromptPackFixture(options);

  return {
    product_analysis: fullFixture.product_analysis,
    i2i_prompts: {
      clip_1: {
        slot: "clip_1",
        first_frame: {
          slot: "clip_1",
          frame: "first_frame",
          prompt_text: "first",
        },
        last_frame: {
          slot: "clip_1",
          frame: "last_frame",
          prompt_text: "last",
        },
      },
      clip_2: {
        slot: "clip_2",
        first_frame: {
          slot: "clip_2",
          frame: "first_frame",
          prompt_text: "first",
        },
        last_frame: {
          slot: "clip_2",
          frame: "last_frame",
          prompt_text: "last",
        },
      },
    },
    i2v_prompts: {
      clip_1: {
        slot: "clip_1",
        prompt_text: "motion one",
        duration_seconds: PROMPT_PACK_I2V_DURATION_SECONDS,
        timeline: buildTestI2VTimeline(),
        motion_prompt: "motion one from @firstframe to @lastframe",
        camera_motion: "slow push-in",
        continuity: {
          first_frame_hint: "start",
          last_frame_hint: "end",
        },
        negative_prompt: "no extra props",
        audio: {
          voiceover_text: "Cek detail produk ini dalam dua detik pertama.",
          voiceover_timing: "00:00-00:02",
          voice_style: "natural Indonesian UGC",
          sfx_cues: "soft product handling",
          ambient_cues: "quiet indoor room tone",
        },
      },
      clip_2: {
        slot: "clip_2",
        prompt_text: "motion two",
        duration_seconds: PROMPT_PACK_I2V_DURATION_SECONDS,
        timeline: buildTestI2VTimeline(),
        motion_prompt: "motion two from @firstframe to @lastframe",
        camera_motion: "slow push-in",
        continuity: {
          first_frame_hint: "start",
          last_frame_hint: "end",
        },
        negative_prompt: "no extra props",
        audio: {
          voiceover_text: "Detailnya jelas untuk bahan pertimbangan checkout.",
          voiceover_timing: "00:00-00:02",
          voice_style: "natural Indonesian UGC",
          sfx_cues: "soft camera handling",
          ambient_cues: "quiet indoor room tone",
        },
      },
    },
    caption: "Caption",
    tags: "#tas #shopee",
    upload_copy: {
      shopee_caption: "Caption",
      shopee_tags: "#tas #shopee",
      shopee_caption_tags: "Caption #tas #shopee",
    },
    negative_prompt_rules: ["no extra props"],
    consistency_rules: ["same product silhouette"],
  };
}

function buildLegacyPromptPackFixture(options?: PromptPackFixtureOptions) {
  const base = buildPromptPackFixture(options);
  const { upload_copy: _uploadCopy, ...legacyBase } = base;
  const serverContext = buildPromptPackServerContextFixture() as {
    reference_cards: PromptPackVisualReferenceJson[];
    affiliate_profile: { rules: PromptPackPromptRulesJson };
  };
  const visualReferences = serverContext.reference_cards;
  const promptRules = serverContext.affiliate_profile.rules;

  return {
    ...legacyBase,
    prompt_context: serverContext,
    i2i_prompts: {
      clip_1: {
        slot: "clip_1",
        first_frame: {
          slot: "clip_1",
          frame: "first_frame",
          prompt_text: "legacy first",
          visual_references: visualReferences,
          prompt_rules: promptRules,
        },
        last_frame: {
          slot: "clip_1",
          frame: "last_frame",
          prompt_text: "legacy last",
          visual_references: visualReferences,
          prompt_rules: promptRules,
        },
      },
      clip_2: {
        slot: "clip_2",
        first_frame: {
          slot: "clip_2",
          frame: "first_frame",
          prompt_text: "legacy first two",
          visual_references: visualReferences,
          prompt_rules: promptRules,
        },
        last_frame: {
          slot: "clip_2",
          frame: "last_frame",
          prompt_text: "legacy last two",
          visual_references: visualReferences,
          prompt_rules: promptRules,
        },
      },
    },
    i2v_prompts: {
      clip_1: {
        slot: "clip_1",
        prompt_text: "legacy motion one",
        visual_references: visualReferences,
        prompt_rules: promptRules,
        continuity: {
          first_frame_hint: "legacy start",
          last_frame_hint: "legacy end",
        },
      },
      clip_2: {
        slot: "clip_2",
        prompt_text: "legacy motion two",
        visual_references: visualReferences,
        prompt_rules: promptRules,
        continuity: {
          first_frame_hint: "legacy start two",
          last_frame_hint: "legacy end two",
        },
      },
    },
  };
}

test("prompt-pack routing does not consume vision-only keys", () => {
  expect(PROMPT_PACK_GEMINI_KEY_PRIORITY).not.toContain("VISION_ANALYSIS");
});

test("quota grouping is project and model scoped when project metadata exists", () => {
  const first = getGeminiQuotaGroupKey({
    id: "key-a",
    model_name: "gemini-2.5-flash",
    project_label: " Tech Autilieur ",
  });
  const second = getGeminiQuotaGroupKey({
    id: "key-b",
    model_name: "gemini-2.5-flash",
    project_label: "tech autilieur",
  });
  const fallback = getGeminiQuotaGroupKey({
    id: "key-c",
    model_name: "gemini-2.5-flash",
    project_label: null,
  });

  expect(first).toBe(second);
  expect(fallback).toBe("key:key-c");
});

test("Gemini Free tier model defaults match selectable quota-positive models", () => {
  expect(GEMINI_MODELS).toEqual([
    "gemini-3.1-flash-lite",
    "gemini-3-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ]);
  expect(GEMINI_MODEL_OPTIONS.map((option) => option.value)).toEqual([...GEMINI_MODELS]);
  expect(GEMINI_MODEL_QUOTA_DEFAULTS["gemini-3.1-flash-lite"]).toEqual({
    rpmLimit: 15,
    rpdLimit: 500,
    tpmLimit: 250000,
  });
  expect(GEMINI_MODEL_QUOTA_DEFAULTS["gemini-3-flash"]).toEqual({
    rpmLimit: 5,
    rpdLimit: 20,
    tpmLimit: 250000,
  });
  expect(GEMINI_MODEL_QUOTA_DEFAULTS["gemini-2.5-flash"]).toEqual({
    rpmLimit: 5,
    rpdLimit: 20,
    tpmLimit: 250000,
  });
  expect(GEMINI_MODEL_QUOTA_DEFAULTS["gemini-2.5-flash-lite"]).toEqual({
    rpmLimit: 10,
    rpdLimit: 20,
    tpmLimit: 250000,
  });
  expect(VISION_MODEL_NAMES).toEqual(GEMINI_MODELS);
  expect(isGeminiModelName("gemini-2.5-pro")).toBe(false);
  expect(isGeminiDatabaseModelName("gemini-2.5-pro")).toBe(true);
  expect(GEMINI_ZERO_QUOTA_MODELS).toEqual(["gemini-2.5-pro", "gemini-2.0-flash", "gemini-3.1-pro"]);
  expect(GEMINI_MODELS.some((modelName) => supportsGeminiStructuredOutputTools(modelName))).toBe(false);
  expect(supportsGeminiStructuredOutputTools("gemini-3-flash-preview")).toBe(true);
});

test("Gemini quota config treats zero and missing limits as unavailable", () => {
  expect(
    hasConfiguredGeminiQuotaLimits({
      rpm_limit: 15,
      rpd_limit: 500,
      tpm_limit: 250000,
    }),
  ).toBe(true);
  expect(
    hasConfiguredGeminiQuotaLimits({
      rpm_limit: 0,
      rpd_limit: 0,
      tpm_limit: 0,
    }),
  ).toBe(false);
  expect(
    hasConfiguredGeminiQuotaLimits({
      rpm_limit: null,
      rpd_limit: 20,
      tpm_limit: 250000,
    }),
  ).toBe(false);
});

test("Gemini response schemas are strict at the top level", () => {
  expect(GEMINI_INTAKE_VISION_RESPONSE_SCHEMA.additionalProperties).toBe(false);
  expect(GEMINI_INTAKE_VISION_RESPONSE_SCHEMA.required).toContain("schema_version");
  expect(GEMINI_INTAKE_VISION_RESPONSE_SCHEMA.required).toContain("ocr_evidence");
  expect(GEMINI_INTAKE_VISION_RESPONSE_SCHEMA.required).toContain("extraction_quality");
  expect(GEMINI_INTAKE_VISION_RESPONSE_SCHEMA.properties?.ocr_evidence?.additionalProperties).toBe(false);
  expect(GEMINI_INTAKE_VISION_RESPONSE_SCHEMA.properties?.extraction_quality?.additionalProperties).toBe(false);
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.additionalProperties).toBe(false);
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.required).toEqual(
    expect.arrayContaining([
      "product_analysis",
      "i2i_prompts",
      "i2v_prompts",
      "caption",
      "tags",
      "upload_copy",
      "negative_prompt_rules",
      "consistency_rules",
    ]),
  );
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.required).not.toContain("prompt_context");
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.required).not.toContain("target_marketplace");
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.properties?.i2i_prompts?.properties?.clip_1?.properties?.first_frame?.required).toEqual([
    "slot",
    "frame",
    "prompt_text",
  ]);
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.properties?.i2i_prompts?.properties?.clip_1?.properties?.first_frame?.required).not.toContain(
    "visual_references",
  );
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.properties?.i2v_prompts?.properties?.clip_1?.required).toEqual([
    "slot",
    "prompt_text",
    "duration_seconds",
    "timeline",
    "motion_prompt",
    "camera_motion",
    "continuity",
    "negative_prompt",
    "audio",
  ]);
  expect(
    GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.properties?.i2v_prompts?.properties?.clip_1?.properties?.audio?.required,
  ).toEqual(["voiceover_text", "voiceover_timing", "voice_style", "sfx_cues", "ambient_cues"]);
  expect(
    GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.properties?.i2v_prompts?.properties?.clip_1?.properties?.audio?.properties?.voiceover_text?.maxLength,
  ).toBe(PROMPT_PACK_VO_MAX_CHARS);
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.properties?.upload_copy?.required).toEqual([
    "shopee_caption",
    "shopee_tags",
    "shopee_caption_tags",
  ]);
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.properties?.upload_copy?.properties?.shopee_caption_tags?.maxLength).toBe(
    PROMPT_PACK_SHOPEE_COPY_MAX_CHARS,
  );
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.properties?.product_analysis?.properties?.product?.required).toContain("status");
});

test("affiliate profile schema detector handles missing analysis columns", () => {
  const error = Object.assign(new Error("column seed_character_analysis_json does not exist"), {
    code: "42703",
  });

  expect(isAffiliateProfileSchemaMissingError(error)).toBe(true);
});

test("affiliate profile asset analysis readiness is ref aware", () => {
  expect(
    isAffiliateProfileAssetAnalysisReady({
      locked: true,
      driveItemRefId: "drive-character-1",
      analysisJson: {
        drive_item_ref_id: "drive-character-1",
      },
    }),
  ).toBe(true);

  expect(
    isAffiliateProfileAssetAnalysisReady({
      locked: true,
      driveItemRefId: "drive-character-2",
      analysisJson: {
        drive_item_ref_id: "drive-character-1",
      },
    }),
  ).toBe(false);

  expect(
    getAffiliateProfileAssetAnalysisState({
      locked: true,
      driveItemRefId: "drive-character-2",
      analysisJson: {
        drive_item_ref_id: "drive-character-1",
      },
    }),
  ).toBe("PENDING");

  expect(
    getAffiliateProfileAssetAnalysisState({
      locked: false,
      driveItemRefId: null,
      analysisJson: null,
    }),
  ).toBe("OPTIONAL");
});

test("affiliate profile asset analysis canonicalizes the active drive ref", () => {
  const canonical = canonicalizeAffiliateProfileAssetAnalysisJson(
    {
      schema_version: "2026-05-06.asset-analysis.v1",
      prompt_version: "2026-05-06.asset-analysis.prompt.v1",
      asset_kind: "CHARACTER",
      profile_code: "SMOKE_PROFILE_PRIMARY",
      drive_item_ref_id: "model-ref-id",
      drive_item_name: "smoke-character.png",
      analysis: {
        summary: "Character posture",
      },
      prompt_rules: {
        i2i_prompt_rules: ["keep silhouette"],
        i2v_prompt_rules: ["keep silhouette"],
        caption_rules: ["short"],
        hashtag_rules: ["#smoke"],
        negative_prompt_rules: ["no blur"],
        product_positioning_notes: ["center the subject"],
      },
      quality: {
        ocr_confidence: 0.92,
        visual_confidence: 0.95,
      },
    } as JsonObject,
    "active-drive-ref-id",
  );

  expect(canonical?.drive_item_ref_id).toBe("active-drive-ref-id");
  expect(canonical?.profile_code).toBe("SMOKE_PROFILE_PRIMARY");
  expect(canonical?.analysis).toEqual({
    summary: "Character posture",
  });
});

test("affiliate profile prompt readiness rejects stale cached analysis", () => {
  expect(
    isAffiliateProfilePromptReady({
      status: "ACTIVE",
      workspace_ids: ["workspace-1"],
      i2i_prompt_rules: "keep product shape",
      i2v_prompt_rules: "keep continuity",
      caption_rules: "short caption",
      hashtag_rules: "#tag",
      negative_prompt_rules: "avoid blur",
      product_positioning_notes: "product-first",
      lock_seed_character: true,
      seed_character_drive_item_ref_id: "drive-character-2",
      seed_character_analysis_json: {
        drive_item_ref_id: "drive-character-2",
      },
      lock_environment: true,
      environment_drive_item_ref_id: "drive-environment-1",
      environment_analysis_json: {
        drive_item_ref_id: "drive-environment-1",
      },
    }),
  ).toBe(true);

  expect(
    isAffiliateProfilePromptReady({
      status: "ACTIVE",
      workspace_ids: ["workspace-1"],
      i2i_prompt_rules: "keep product shape",
      i2v_prompt_rules: "keep continuity",
      caption_rules: "short caption",
      hashtag_rules: "#tag",
      negative_prompt_rules: "avoid blur",
      product_positioning_notes: "product-first",
      lock_seed_character: true,
      seed_character_drive_item_ref_id: "drive-character-2",
      seed_character_analysis_json: {
        drive_item_ref_id: "drive-character-1",
      },
      lock_environment: true,
      environment_drive_item_ref_id: "drive-environment-1",
      environment_analysis_json: {
        drive_item_ref_id: "drive-environment-1",
      },
    }),
  ).toBe(false);
});

test("prompt launch readiness enables create prompt when review and locks are complete", () => {
  const readiness = getPromptLaunchReadiness({
    productId: "product-1",
    intakeSessionId: "intake-1",
    affiliateProfileId: "affiliate-1",
    hasReviewedMetadata: true,
    reviewedMetadata: buildCompleteReviewedMetadata(),
    sourceImageDriveItemRefId: "source-ref",
    affiliateProfile: {
      status: "ACTIVE",
      workspace_ids: ["workspace-1"],
      i2i_prompt_rules: "keep product shape",
      i2v_prompt_rules: "keep continuity",
      caption_rules: "short caption",
      hashtag_rules: "#tag",
      negative_prompt_rules: "avoid blur",
      product_positioning_notes: "product-first",
      lock_seed_character: true,
      seed_character_drive_item_ref_id: "drive-character-2",
      seed_character_analysis_json: {
        drive_item_ref_id: "drive-character-2",
      },
      lock_environment: true,
      environment_drive_item_ref_id: "drive-environment-1",
      environment_analysis_json: {
        drive_item_ref_id: "drive-environment-1",
      },
    },
  });

  expect(readiness.ready).toBe(true);
  expect(readiness.blockers).toHaveLength(0);
});

test("prompt launch readiness blocks incomplete Prompt Essentials", () => {
  const readiness = getPromptLaunchReadiness({
    productId: "product-1",
    intakeSessionId: "intake-1",
    affiliateProfileId: "affiliate-1",
    hasReviewedMetadata: true,
    reviewedMetadata: { nama_produk: "Tas" },
    sourceImageDriveItemRefId: "source-ref",
    affiliateProfile: buildReadyAffiliateProfile(),
  });

  expect(readiness.ready).toBe(false);
  expect(readiness.blockers.map((blocker) => blocker.key)).toContain("review_metadata");
  expect(readiness.blockers.map((blocker) => blocker.label)).toContain("Prompt Essentials");
});

test("prompt launch readiness lists blockers for missing review and source image", () => {
  const readiness = getPromptLaunchReadiness({
    productId: "product-1",
    intakeSessionId: "intake-1",
    affiliateProfileId: "affiliate-1",
    hasReviewedMetadata: false,
    sourceImageDriveItemRefId: null,
    affiliateProfile: {
      status: "ACTIVE",
      workspace_ids: ["workspace-1"],
      i2i_prompt_rules: "keep product shape",
      i2v_prompt_rules: "keep continuity",
      caption_rules: "short caption",
      hashtag_rules: "#tag",
      negative_prompt_rules: "avoid blur",
      product_positioning_notes: "product-first",
      lock_seed_character: false,
      seed_character_drive_item_ref_id: null,
      seed_character_analysis_json: null,
      lock_environment: false,
      environment_drive_item_ref_id: null,
      environment_analysis_json: null,
    },
  });

  expect(readiness.ready).toBe(false);
  expect(readiness.blockers.map((blocker) => blocker.key)).toEqual(
    expect.arrayContaining(["review_metadata", "source_image"]),
  );
  expect(readiness.blockers.some((blocker) => blocker.href.includes("/products/new?step=prompt"))).toBe(true);
});

test("prompt readiness projection does not trust raw product status alone", () => {
  const projection = projectPromptReadiness({
    product: { id: "product-1", status: "PROMPT_READY" },
    sourceImages: [],
    marketplaceSources: [],
    intakeSessions: [
      {
        id: "intake-1",
        status: "REVIEWED",
        reviewed_metadata_json: buildCompleteReviewedMetadata(),
      },
    ],
    affiliateProfile: buildReadyAffiliateProfile(),
  });

  expect(projection.status).toBe("NEEDS_EVIDENCE");
  expect(projection.label).toBe("Needs Evidence");
  expect(projection.reasons.map((reason) => reason.key)).toEqual(
    expect.arrayContaining(["source_image", "marketplace_evidence"]),
  );
  expect(projection.isBulkEnqueueEligible).toBe(false);
});

test("prompt readiness projection separates metadata analysis from metadata review", () => {
  const needsMetadata = projectPromptReadiness({
    product: { id: "product-1", status: "DRAFT" },
    sourceImages: [{ id: "image-1", drive_item_ref_id: "drive-product", status: "ATTACHED" }],
    marketplaceSources: [{ id: "source-1", screenshot_drive_item_ref_id: "drive-shot", status: "ACTIVE" }],
    intakeSessions: [],
    affiliateProfile: buildReadyAffiliateProfile(),
  });
  const needsReview = projectPromptReadiness({
    product: { id: "product-1", status: "DRAFT" },
    sourceImages: [{ id: "image-1", drive_item_ref_id: "drive-product", status: "ATTACHED" }],
    marketplaceSources: [{ id: "source-1", screenshot_drive_item_ref_id: "drive-shot", status: "ACTIVE" }],
    intakeSessions: [
      {
        id: "intake-1",
        status: "NEEDS_REVIEW",
        parsed_metadata_json: { nama_produk: "Tas" },
      },
    ],
    affiliateProfile: buildReadyAffiliateProfile(),
  });

  expect(needsMetadata.status).toBe("NEEDS_METADATA");
  expect(needsMetadata.label).toBe("Needs Metadata");
  expect(needsMetadata.isBulkEnqueueEligible).toBe(false);
  expect(needsReview.status).toBe("NEEDS_REVIEW");
  expect(needsReview.label).toBe("Needs Review");
  expect(needsReview.isBulkEnqueueEligible).toBe(false);
});

test("prompt readiness projection marks only ready rows as bulk enqueue eligible", () => {
  const projection = projectPromptReadiness({
    product: { id: "product-1", status: "DRAFT" },
    sourceImages: [{ id: "image-1", drive_item_ref_id: "drive-product", status: "ATTACHED" }],
    marketplaceSources: [{ id: "source-1", screenshot_drive_item_ref_id: "drive-shot", status: "ACTIVE" }],
    intakeSessions: [
      {
        id: "intake-1",
        status: "REVIEWED",
        reviewed_metadata_json: buildCompleteReviewedMetadata(),
      },
    ],
    affiliateProfile: buildReadyAffiliateProfile(),
  });

  expect(projection.status).toBe("READY_FOR_PROMPT");
  expect(projection.label).toBe("Ready for Prompt");
  expect(projection.reasons).toHaveLength(0);
  expect(projection.isBulkEnqueueEligible).toBe(true);
});

test("prompt readiness projection reflects queued generated and failed prompt states", () => {
  const readyInput = {
    product: { id: "product-1", status: "DRAFT" },
    sourceImages: [{ id: "image-1", drive_item_ref_id: "drive-product", status: "ATTACHED" }],
    marketplaceSources: [{ id: "source-1", screenshot_drive_item_ref_id: "drive-shot", status: "ACTIVE" }],
    intakeSessions: [
      {
        id: "intake-1",
        status: "REVIEWED",
        reviewed_metadata_json: buildCompleteReviewedMetadata(),
      },
    ],
    affiliateProfile: buildReadyAffiliateProfile(),
  };

  expect(
    projectPromptReadiness({
      ...readyInput,
      promptPacks: [{ id: "pack-1", status: "QUEUED", ai_task_id: "task-1" }],
      aiTasks: [{ id: "task-1", task_type: "PROMPT_PACK_GENERATION", status: "RUNNING" }],
    }).label,
  ).toBe("Prompt Queued");
  expect(
    projectPromptReadiness({
      ...readyInput,
      promptPacks: [{ id: "pack-1", status: "GENERATED" }],
    }).label,
  ).toBe("Prompt Generated");
  expect(
    projectPromptReadiness({
      ...readyInput,
      promptPacks: [{ id: "pack-1", status: "ERROR", error_message: "Gemini failed" }],
    }).label,
  ).toBe("Prompt Failed");
});

test("prompt workbench readiness filter normalizes query values", () => {
  expect(normalizePromptWorkbenchReadinessFilter("ready for prompt")).toBe("READY_FOR_PROMPT");
  expect(normalizePromptWorkbenchReadinessFilter("prompt-failed")).toBe("PROMPT_FAILED");
  expect(normalizePromptWorkbenchReadinessFilter("unknown")).toBe("ALL");
});

test("prompt workbench readiness counts and filters rows", () => {
  const rows = [
    { product: { id: "product-1" }, status: "NEEDS_EVIDENCE" },
    { product: { id: "product-2" }, status: "READY_FOR_PROMPT" },
    { product: { id: "product-3" }, status: "READY_FOR_PROMPT" },
    { product: { id: "product-4" }, status: "PROMPT_GENERATED" },
  ] as any;

  const counts = countPromptWorkbenchRows(rows);

  expect(counts.total).toBe(4);
  expect(counts.NEEDS_EVIDENCE).toBe(1);
  expect(counts.READY_FOR_PROMPT).toBe(2);
  expect(counts.PROMPT_GENERATED).toBe(1);
  expect(filterPromptWorkbenchRows(rows, "READY_FOR_PROMPT").map((row: any) => row.product.id)).toEqual([
    "product-2",
    "product-3",
  ]);
  expect(filterPromptWorkbenchRows(rows, "ALL")).toHaveLength(4);
});

test("prompt workbench collector keeps counts while streaming batches", () => {
  const collector = createPromptWorkbenchPageCollector({
    page: 2,
    pageSize: 1,
    readiness: "READY_FOR_PROMPT",
  });

  collector.addBatch([
    {
      product: { id: "product-1" },
      status: "READY_FOR_PROMPT",
      label: "Ready for Prompt",
      reasons: [],
      isBulkEnqueueEligible: true,
    } as any,
    {
      product: { id: "product-2" },
      status: "NEEDS_REVIEW",
      label: "Needs Review",
      reasons: [],
      isBulkEnqueueEligible: false,
    } as any,
  ]);

  collector.addBatch([
    {
      product: { id: "product-3" },
      status: "READY_FOR_PROMPT",
      label: "Ready for Prompt",
      reasons: [],
      isBulkEnqueueEligible: true,
    } as any,
    {
      product: { id: "product-4" },
      status: "PROMPT_GENERATED",
      label: "Prompt Generated",
      reasons: [],
      isBulkEnqueueEligible: false,
    } as any,
  ]);

  const result = collector.finish();

  expect(result.totalCount).toBe(2);
  expect(result.counts.total).toBe(4);
  expect(result.counts.READY_FOR_PROMPT).toBe(2);
  expect(result.counts.NEEDS_REVIEW).toBe(1);
  expect(result.counts.PROMPT_GENERATED).toBe(1);
  expect(result.rows.map((row) => row.product.id)).toEqual(["product-3"]);
});

test("content variant prompt codes stay distinct for the same product", () => {
  const heroPromptCode = buildContentVariantPromptCode("PROD-1", "hero_hook");
  const detailPromptCode = buildContentVariantPromptCode("PROD-1", "detail_proof");

  expect(heroPromptCode).toBe("PROMPT-PROD-1-HERO_HOOK");
  expect(detailPromptCode).toBe("PROMPT-PROD-1-DETAIL_PROOF");
  expect(heroPromptCode).not.toBe(detailPromptCode);
});

test("regeneration scopes expose complete generation instructions", () => {
  expect(REGENERATION_SCOPES.map((scope) => scope.key)).toEqual([
    "full_pack",
    "stronger_hook",
    "voiceover_only",
    "i2v_motion_only",
    "caption_tags_only",
    "grounding_fix",
  ]);
  expect(isRegenerationScopeKey("voiceover_only")).toBe(true);
  expect(isRegenerationScopeKey("unknown")).toBe(false);
  expect(getRegenerationScope("caption_tags_only").generationInstruction).toContain("complete valid prompt pack");
  expect(getRegenerationScope("unknown").key).toBe("full_pack");
});

test("intake upload validation accepts common JPG variants", () => {
  expect(() => assertUploadedImage(new File(["x"], "mobile.jpg", { type: "image/jpeg" }), "Screenshot Shopee")).not.toThrow();
  expect(() => assertUploadedImage(new File(["x"], "mobile.jpg", { type: "image/jpg" }), "Screenshot TikTok")).not.toThrow();
  expect(() => assertUploadedImage(new File(["x"], "mobile.jpg", { type: "image/pjpeg" }), "Foto Produk Utama")).not.toThrow();
  expect(() => assertUploadedImage(new File(["x"], "mobile.jpg", { type: "" }), "Foto Produk Utama")).not.toThrow();
  expect(() => assertUploadedImage(new File(["x"], "mobile.avif", { type: "image/avif" }), "Screenshot Shopee")).not.toThrow();
});

test("intake upload validation still rejects non-image files", () => {
  expect(() => assertUploadedImage(new File(["x"], "notes.txt", { type: "text/plain" }), "Screenshot Shopee")).toThrow(
    "Screenshot Shopee must be JPG, JPEG, PNG, WEBP, HEIC, HEIF, or AVIF.",
  );
});

test("AVIF evidence images are transcoded to Gemini-supported WEBP", async () => {
  const avifBuffer = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .avif()
    .toBuffer();

  const prepared = await prepareGeminiCompatibleUploadImage(
    new File([new Uint8Array(avifBuffer)], "shopee.avif", { type: "image/avif" }),
  );

  expect(prepared?.mimeType).toBe("image/webp");
  expect(prepared?.buffer.byteLength).toBeGreaterThan(0);
});

test("intake vision parser preserves combined marketplace evidence", () => {
  const parsed = parseIntakeVisionOutput(
    JSON.stringify({
      nama_produk: "Tas selempang",
      keyword_cari_etalase: "Tas",
      deskripsi_visual: "Tas compact untuk mobile.",
      use_case: "Harian",
      pain_point: "Berat",
      selling_angle: "Ringan",
      target_viewer: "Wanita aktif",
      product_title: "Tas selempang premium",
      marketplace: "Shopee + TikTok",
      category: "Fashion",
      rating_text: "4.9",
      sold_count_text: "120",
      price_text: "Rp99.000",
      shop_name: "Toko A",
      visible_product_attributes: ["Kulit sintetis"],
      risk_notes: [],
      confidence_notes: ["Analisis bytes"],
    }),
  );

  expect(parsed.marketplace).toBe("Shopee + TikTok");
});

test("prompt pack storage uses server prompt context instead of model echo", () => {
  const serverPromptContext = {
    mode: "server_context",
    affiliate_profile: {
      i2i_prompt_rules: "keep product shape",
      caption_rules: "short caption",
    },
  } satisfies JsonObject;
  const output = buildPromptPackFixture();

  const payload = buildPromptPackStoragePayload(output, serverPromptContext);

  expect(payload.personalization_json.prompt_context).toEqual(serverPromptContext);
  expect(payload.personalization_json.upload_copy).toEqual(output.upload_copy);
});

test("prompt pack editor storage rejects prose prompt fields", () => {
  const pack = buildPromptPackStoragePayload(buildPromptPackFixture());
  const promptSet = readPromptPackEditorPromptSet(pack);

  expect(() =>
    buildPromptPackEditorStoragePayload(
      {
        ...promptSet,
        clips: {
          ...promptSet.clips,
          clip_1: {
            ...promptSet.clips.clip_1,
            i2i_first_frame: "legacy prose prompt",
          },
        },
      },
      pack.personalization_json,
    ),
  ).toThrow("clip_1.i2i_first_frame must be valid copy prompt JSON.");
});

test("prompt pack editor storage round-trips legacy prompts without drive_url", () => {
  const legacyPack = {
    i2i_prompts_json: {
      clip_1: {
        first_frame: { prompt_text: "Legacy first frame 1" },
        last_frame: { prompt_text: "Legacy last frame 1" },
      },
      clip_2: {
        first_frame: { prompt_text: "Legacy first frame 2" },
        last_frame: { prompt_text: "Legacy last frame 2" },
      },
    },
    i2v_prompts_json: {
      clip_1: { prompt_text: "Legacy clip 1" },
      clip_2: { prompt_text: "Legacy clip 2" },
    },
    personalization_json: {
      caption: "Legacy caption",
      tags: "#legacy #tas",
      seed_character: {
        locked: true,
        notes: "Keep character locked",
        drive_item_ref_id: "character-ref",
      },
      environment: {
        locked: true,
        notes: "Keep environment locked",
        drive_item_ref_id: "environment-ref",
      },
    },
  };

  const promptSet = readPromptPackEditorPromptSet(legacyPack);

  expect(promptSet.clips.clip_1.i2i_first_frame_json.schema_version).toBe(PROMPT_PACK_COPY_SCHEMA_VERSION);
  expect(promptSet.clips.clip_1.i2i_first_frame_json.image_inputs).toEqual([
    "@character",
    "@environment",
    "@Product",
  ]);
  expect(promptSet.clips.clip_1.i2i_last_frame_json.image_inputs).toEqual(["@firstframe"]);
  expect(promptSet.clips.clip_1.i2v_prompt_json.frame_inputs).toEqual(["@firstframe", "@lastframe"]);
  expect(promptSet.clips.clip_1.i2v_prompt_json.duration_seconds).toBe(PROMPT_PACK_I2V_DURATION_SECONDS);
  expect(promptSet.clips.clip_1.i2v_prompt).not.toContain("visual_references");
  expect(promptSet.clips.clip_1.i2v_prompt).not.toContain("prompt_rules");

  expect(() =>
    buildPromptPackEditorStoragePayload(
      {
        clips: promptSet.clips,
        caption: promptSet.caption,
        tags: promptSet.tags,
      },
      legacyPack.personalization_json,
    ),
  ).not.toThrow();
});

test("structured I2V copy prompt uses only first frame and preserves VO audio", () => {
  const clip = buildTestI2VPrompt(
    "clip_1",
    'from @firstframe to @lastframe with last frame remains legacy compatibility only. VO: "Cek detail produk ini."',
  );
  clip.motion_prompt = "continue from @firstframe to @lastframe with no final frame jump";
  clip.camera_motion = "avoid ending frame snap";
  clip.timeline = [
    {
      time: "00:00-00:02",
      action: 'start from @firstframe to @lastframe. VO: "Cek detail produk ini."',
    },
    {
      time: "00:02-00:04",
      action: "continue the same first-frame setup",
    },
    {
      time: "00:04-00:06",
      action: "show a readable product detail",
    },
    {
      time: "00:06-00:08",
      action: "resolve with @lastframe as a last-frame compatibility marker",
    },
  ];
  clip.negative_prompt = "avoid @lastframe or last-frame dependency";

  const copyPrompt = buildStructuredI2VPromptForCopy(clip);

  expect(copyPrompt.schema_version).toBe(PROMPT_PACK_COPY_SCHEMA_VERSION);
  expect(copyPrompt.slot).toBe("clip_1");
  expect(copyPrompt.stage).toBe("i2v");
  expect(copyPrompt.model).toBe(PROMPT_PACK_I2V_COPY_MODEL);
  expect(copyPrompt.duration_seconds).toBe(PROMPT_PACK_I2V_DURATION_SECONDS);
  expect(copyPrompt.aspect_ratio).toBe(PROMPT_PACK_I2V_COPY_ASPECT_RATIO);
  expect(copyPrompt.reference_image).toBe("@firstframe");
  expect(copyPrompt.prompt.timeline).toHaveLength(4);
  expect(copyPrompt.prompt.timeline.map((segment) => segment.time)).toEqual([...PROMPT_PACK_I2V_TIMELINE_WINDOWS]);
  expect(copyPrompt.prompt.timeline[0].action).toContain("@firstframe");
  expect(copyPrompt.prompt.timeline[0].action).toContain("Product must be visible immediately");
  expect(copyPrompt.prompt.timeline[0].action).toContain("VO hook starts");
  expect(copyPrompt.prompt.timeline[3].action).toContain("@firstframe");
  expect(copyPrompt.prompt.audio).toMatchObject({
    type: "native",
    voiceover_timing: "00:00-00:02",
    voiceover_text: "Cek detail produk ini dalam dua detik pertama.",
    voice_style: "natural Indonesian UGC",
    sfx_cues: "soft product handling",
    ambient_cues: "quiet indoor room tone",
  });
  expectNoLegacyI2VCopyReference(copyPrompt);
});

test("structured I2V copy prompt renders no-speech audio for old packs without VO", () => {
  const clip = buildTestI2VPrompt("clip_2", "old i2v prompt from @firstframe to @lastframe");
  delete clip.audio;

  const copyPrompt = buildStructuredI2VPromptForCopy(clip);

  expect(copyPrompt.reference_image).toBe("@firstframe");
  expect(copyPrompt.prompt.timeline).toHaveLength(4);
  expect(copyPrompt.prompt.timeline[0].action).toContain("No speech");
  expect(copyPrompt.prompt.audio).toEqual({
    type: "native",
    voiceover_timing: "none",
    voiceover_text: "no speech; no voiceover; no lip-sync",
    voice_style: "no speech; no voiceover; no lip-sync",
    sfx_cues: "subtle native ambience only",
    ambient_cues: "subtle native ambience only",
  });
  expectNoLegacyI2VCopyReference(copyPrompt);
});

test("flow stage manifest jobs split frame and video execution", () => {
  const pack = buildPromptPackStoragePayload(buildPromptPackFixture());
  const promptSet = readPromptPackEditorPromptSet(pack);
  const jobs = buildFlowStageManifestJobs({
    batchCode: "BATCH-01",
    productCode: "PROD-01",
    promptCode: "PROMPT-01",
    promptSet,
  });

  expect(jobs.map((job) => job.stage)).toEqual([
    "FIRST_FRAME",
    "FIRST_FRAME",
    "LAST_FRAME",
    "LAST_FRAME",
    "VIDEO",
    "VIDEO",
  ]);
  expect(jobs).toHaveLength(6);
  expect(jobs[0].input_handles).toEqual(["@character", "@environment", "@product"]);
  expect(jobs[2].input_handles).toEqual(["@firstframe"]);
  expect(jobs[4].input_handles).toEqual(["@firstframe", "@lastframe"]);
  expect(jobs[2].depends_on_job_codes).toEqual([jobs[0].job_code]);
  expect(jobs[4].depends_on_job_codes).toEqual([jobs[0].job_code, jobs[2].job_code]);
  expect(jobs[0].output_file_name).toContain("_FIRSTFRAME.png");
  expect(jobs[2].output_file_name).toContain("_LASTFRAME.png");
  expect(jobs[4].output_file_name).toContain(".mp4");
  expect(flowStageDrivePurpose("FIRST_FRAME")).toBe("I2I_RESULT");
  expect(flowStageDrivePurpose("VIDEO")).toBe("FINAL_VIDEO");
});

test("prompt pack parser rejects missing product status", () => {
  const output = buildPromptPackCompactFixture() as any;
  delete output.product_analysis.product.status;

  expect(() =>
    parsePromptPackGenerationOutput(JSON.stringify(output), {
      fallbackProductStatus: "IMAGE_ANALYZED",
      serverPromptContext: buildPromptPackServerContextFixture(),
    }),
  ).toThrow("product_analysis.product.status must be a non-empty string.");
});

test("prompt pack parser rejects mismatched product status", () => {
  expect(() =>
    parsePromptPackGenerationOutput(JSON.stringify(buildPromptPackCompactFixture({ productStatus: "DRAFT" })), {
      fallbackProductStatus: "IMAGE_ANALYZED",
      serverPromptContext: buildPromptPackServerContextFixture(),
    }),
  ).toThrow("product_analysis.product.status must match the source product status (IMAGE_ANALYZED).");
});

test("prompt pack parser rejects mismatched source image echo", () => {
  expect(() =>
    parsePromptPackGenerationOutput(
      JSON.stringify(
        buildPromptPackCompactFixture({
        sourceImage: {
          id: "source-image-id",
          is_primary: true,
          status: "DETACHED",
          source_type: "GOOGLE_DRIVE",
          drive_item_ref_id: "drive-item-id",
          analysis_json: null,
        },
      }),
      ),
      {
        fallbackProductStatus: "IMAGE_ANALYZED",
        serverPromptContext: buildPromptPackServerContextFixture(),
      fallbackSourceImage: {
        id: "source-image-id",
        is_primary: true,
        status: "ATTACHED",
        source_type: "GOOGLE_DRIVE",
        drive_item_ref_id: "drive-item-id",
        analysis_json: null,
      },
      },
    ),
  ).toThrow("product_analysis.source_image.status must match the source image value (ATTACHED).");
});

test("prompt pack parser rejects over-limit clip voiceover text", () => {
  const output = buildPromptPackCompactFixture() as any;
  output.i2v_prompts.clip_1.audio.voiceover_text = "x".repeat(PROMPT_PACK_VO_MAX_CHARS + 1);

  expect(() =>
    parsePromptPackGenerationOutput(JSON.stringify(output), {
      fallbackProductStatus: "IMAGE_ANALYZED",
      serverPromptContext: buildPromptPackServerContextFixture(),
    }),
  ).toThrow(`i2v_prompts.clip_1.audio.voiceover_text must be ${PROMPT_PACK_VO_MAX_CHARS} characters or fewer.`);
});

test("prompt pack parser accepts max-length clip voiceover text", () => {
  const output = buildPromptPackCompactFixture() as any;
  const voiceoverText = "x".repeat(PROMPT_PACK_VO_MAX_CHARS);
  output.i2v_prompts.clip_1.audio.voiceover_text = voiceoverText;

  const parsed = parsePromptPackGenerationOutput(JSON.stringify(output), {
    fallbackProductStatus: "IMAGE_ANALYZED",
    serverPromptContext: buildPromptPackServerContextFixture(),
  });

  expect(parsed.i2v_prompts.clip_1.audio?.voiceover_text).toBe(voiceoverText);
  expect(parsed.i2v_prompts.clip_1.audio?.voiceover_timing).toBe("00:00-00:02");
});

test("prompt pack parser rejects invalid clip voiceover timing", () => {
  const output = buildPromptPackCompactFixture() as any;
  output.i2v_prompts.clip_1.audio.voiceover_timing = "00:00-00:03";

  expect(() =>
    parsePromptPackGenerationOutput(JSON.stringify(output), {
      fallbackProductStatus: "IMAGE_ANALYZED",
      serverPromptContext: buildPromptPackServerContextFixture(),
    }),
  ).toThrow("i2v_prompts.clip_1.audio.voiceover_timing must equal 00:00-00:02.");
});

test("prompt pack parser rejects over-limit Shopee caption tags", () => {
  const output = buildPromptPackCompactFixture() as any;
  output.upload_copy.shopee_caption_tags = "x".repeat(PROMPT_PACK_SHOPEE_COPY_MAX_CHARS + 1);

  expect(() =>
    parsePromptPackGenerationOutput(JSON.stringify(output), {
      fallbackProductStatus: "IMAGE_ANALYZED",
      serverPromptContext: buildPromptPackServerContextFixture(),
    }),
  ).toThrow(`upload_copy.shopee_caption_tags must be ${PROMPT_PACK_SHOPEE_COPY_MAX_CHARS} characters or fewer.`);
});

test("prompt pack parser accepts max-length Shopee caption tags", () => {
  const output = buildPromptPackCompactFixture() as any;
  const captionTags = "x".repeat(PROMPT_PACK_SHOPEE_COPY_MAX_CHARS);
  output.upload_copy.shopee_caption_tags = captionTags;

  const parsed = parsePromptPackGenerationOutput(JSON.stringify(output), {
    fallbackProductStatus: "IMAGE_ANALYZED",
    serverPromptContext: buildPromptPackServerContextFixture(),
  });

  expect(parsed.upload_copy.shopee_caption_tags).toBe(captionTags);
});

test("prompt pack parser recovers JSON from wrapped Gemini text", () => {
  const serverPromptContext = buildPromptPackServerContextFixture();
  const parsed = parsePromptPackGenerationOutput(
    `
    \`\`\`json
    ${JSON.stringify(buildPromptPackCompactFixture())}
    \`\`\`
  `,
    {
      fallbackProductStatus: "IMAGE_ANALYZED",
      serverPromptContext,
    },
  );

  expect(parsed.caption).toBe("Caption");
  expect(parsed.target_marketplace).toBe("Shopee + TikTok");
});

test("prompt pack parser keeps old compact output compatible", () => {
  const output = buildPromptPackCompactFixture() as any;
  delete output.upload_copy;

  for (const clipKey of ["clip_1", "clip_2"] as const) {
    delete output.i2v_prompts[clipKey].audio;
  }

  const parsed = parsePromptPackGenerationOutput(JSON.stringify(output), {
    fallbackProductStatus: "IMAGE_ANALYZED",
    serverPromptContext: buildPromptPackServerContextFixture(),
  });

  expect(parsed.upload_copy.shopee_caption_tags).toBe("Caption #tas #shopee");
  expect(parsed.i2v_prompts.clip_1.audio).toBeUndefined();
});

test("prompt pack parser rehydrates compact Gemini output with server context", () => {
  const serverPromptContext = buildPromptPackServerContextFixture();
  const parsed = parsePromptPackGenerationOutput(JSON.stringify(buildPromptPackCompactFixture()), {
    fallbackProductStatus: "IMAGE_ANALYZED",
    serverPromptContext,
  });

  expect(parsed.prompt_context).toEqual(serverPromptContext);
  expect(parsed.target_marketplace).toBe("Shopee + TikTok");
  expect(parsed.upload_copy).toEqual({
    shopee_caption: "Caption",
    shopee_tags: "#tas #shopee",
    shopee_caption_tags: "Caption #tas #shopee",
  });
  expect(parsed.seed_character).toEqual({
    locked: true,
    notes: "Lock the character silhouette.",
    drive_item_ref_id: "character-ref",
  });
  expect(parsed.environment).toEqual({
    locked: false,
    notes: "Use the default background.",
    drive_item_ref_id: "environment-ref",
  });
  expect(parsed.prompt_context.reference_cards).toHaveLength(3);
  expect(parsed.i2i_prompts.clip_1.first_frame.schema_version).toBe(PROMPT_PACK_COPY_SCHEMA_VERSION);
  expect(parsed.i2i_prompts.clip_1.first_frame.stage).toBe("i2i_first_frame");
  expect(parsed.i2i_prompts.clip_1.first_frame.image_inputs).toEqual([
    "@character",
    "@environment",
    "@product.png",
  ]);
  expect(parsed.i2i_prompts.clip_1.first_frame.prompt_text).toContain("single-frame image");
  expect(parsed.i2i_prompts.clip_1.first_frame.prompt_text).toContain("one clear composition");
  expect(parsed.i2i_prompts.clip_1.first_frame.prompt_text).not.toContain("2x2");
  expect(parsed.i2i_prompts.clip_1.first_frame.prompt_text.toLowerCase()).not.toContain("storyboard");
  expect(parsed.i2i_prompts.clip_1.first_frame.must_keep).toEqual(expect.arrayContaining([
    expect.stringContaining("Use @character, @environment"),
    expect.stringContaining("keep product shape"),
  ]));
  expect(parsed.i2i_prompts.clip_1.first_frame.must_avoid.length).toBeGreaterThan(0);
  expect(parsed.i2i_prompts.clip_1.first_frame.must_avoid.join(" ")).not.toContain("{");
  expect(parsed.i2i_prompts.clip_1.last_frame.image_inputs).toEqual(["@firstframe"]);
  expect(parsed.i2i_prompts.clip_1.last_frame.prompt_text).toContain("Legacy compatibility");
  expect(parsed.i2v_prompts.clip_2.schema_version).toBe(PROMPT_PACK_COPY_SCHEMA_VERSION);
  expect(parsed.i2v_prompts.clip_2.frame_inputs).toEqual(["@firstframe", "@lastframe"]);
  expect(parsed.i2v_prompts.clip_2.duration_seconds).toBe(PROMPT_PACK_I2V_DURATION_SECONDS);
  expect(parsed.i2v_prompts.clip_2.timeline.map((segment) => segment.time)).toEqual([
    "00:00-00:02",
    "00:02-00:04",
    "00:04-00:06",
    "00:06-00:08",
  ]);
  expect(parsed.i2v_prompts.clip_2.prompt_text).toContain("@firstframe as the single starting image");
  expect(parsed.i2v_prompts.clip_2.continuity).toContain("single starting image");
  expect(parsed.i2v_prompts.clip_2.prompt_text).not.toContain("3x3");
  expect(parsed.i2v_prompts.clip_2.prompt_text).not.toContain("2x2");
  expect(parsed.i2v_prompts.clip_2.prompt_text.toLowerCase()).not.toContain("storyboard");
  expect(parsed.i2v_prompts.clip_2.prompt_text.toLowerCase()).not.toContain("panels");
  expect(parsed.i2v_prompts.clip_2.negative_prompt).toContain("no extra props");
  expect(parsed.i2v_prompts.clip_2.audio).toEqual({
    voiceover_text: "Detailnya jelas untuk bahan pertimbangan checkout.",
    voiceover_timing: "00:00-00:02",
    voice_style: "natural Indonesian UGC",
    sfx_cues: "soft camera handling",
    ambient_cues: "quiet indoor room tone",
  });
  expect(JSON.stringify(parsed.i2v_prompts.clip_2)).not.toContain("visual_references");
  expect(JSON.stringify(parsed.i2v_prompts.clip_2)).not.toContain("prompt_rules");
});

test("prompt pack parser accepts legacy Gemini output contract", () => {
  const parsed = parsePromptPackGenerationOutput(JSON.stringify(buildLegacyPromptPackFixture()), {
    fallbackProductStatus: "IMAGE_ANALYZED",
    serverPromptContext: buildPromptPackServerContextFixture(),
  });

  expect(parsed.prompt_context).toEqual(buildPromptPackServerContextFixture());
  expect(parsed.target_marketplace).toBe("Shopee + TikTok");
  expect(parsed.seed_character).toEqual({
    locked: false,
    notes: "",
    drive_item_ref_id: null,
  });
});

test("Gemini failure policy separates retryable and quarantined statuses", () => {
  const rateLimited = getGeminiFailureDisposition(Object.assign(new Error("Gemini rate limit reached."), {
    status: 429,
    retryAfterSeconds: 12,
  }));
  expect(rateLimited.kind).toBe("RATE_LIMITED");
  expect(rateLimited.retryableTask).toBe(true);
  expect(rateLimited.markGroupCooldown).toBe(true);
  expect(rateLimited.excludeQuotaGroup).toBe(true);
  expect(rateLimited.nextStatus).toBe("COOLDOWN");

  const authFailure = getGeminiFailureDisposition(Object.assign(new Error("Gemini access denied."), { status: 403 }));
  expect(authFailure.kind).toBe("AUTH_MISCONFIG");
  expect(authFailure.markKeyError).toBe(true);
  expect(authFailure.excludeKeyId).toBe(true);
  expect(authFailure.retryableTask).toBe(false);

  const modelFailure = getGeminiFailureDisposition(Object.assign(new Error("Gemini model was not found."), { status: 404 }));
  expect(modelFailure.kind).toBe("MODEL_NOT_FOUND");
  expect(modelFailure.markGroupError).toBe(true);
  expect(modelFailure.excludeQuotaGroup).toBe(true);
  expect(modelFailure.retryableTask).toBe(false);

  const upstreamFailure = getGeminiFailureDisposition(Object.assign(new Error("Gemini request timed out."), { status: 408 }));
  expect(upstreamFailure.kind).toBe("TRANSIENT_UPSTREAM");
  expect(upstreamFailure.retryableTask).toBe(true);
  expect(upstreamFailure.excludeQuotaGroup).toBe(true);
});

test("Gemini error sanitizer preserves upstream invalid argument message", () => {
  expect(
    sanitizeGeminiStatusMessage(400, "Gemini request failed.", "Schema is too large or too deep."),
  ).toBe("Schema is too large or too deep.");
  expect(sanitizeGeminiStatusMessage(401, "Gemini request failed.", "Schema is too large or too deep.")).toBe(
    "Gemini authorization failed.",
  );
});

test("Gemini temporary unavailable status is retryable", () => {
  expect(sanitizeGeminiStatusMessage(500, "Gemini request failed.", "Upstream outage")).toBe(
    "Gemini service is temporarily unavailable.",
  );
  expect(isGeminiTemporaryUnavailableMessage("Gemini service is temporarily unavailable.")).toBe(true);
});

test("route toaster replays identical toasts after dismissal", async ({ page }) => {
  await page.goto("/settings/account");

  const createTokenButton = page.getByRole("button", { name: "Buat token" });
  const saveHashButton = page.getByRole("button", { name: "Simpan hash" });
  const successToast = page.locator('.toast[data-tone="success"]');

  await createTokenButton.click();
  await expect(page.locator("pre.json-block")).toContainText('"raw_token"');
  await saveHashButton.click();
  await expect(successToast).toContainText("App API Token saved");
  await expect
    .poll(() => new URL(page.url()).searchParams.has("message"), {
      message: "route feedback param is cleared after queueing the toast",
    })
    .toBe(false);
  await expect(page.locator(".activity-banner")).toHaveCount(0);
  await page.getByRole("button", { name: "Tutup notifikasi" }).click();
  await expect(successToast).toHaveCount(0);
  await page.reload();
  await expect(successToast).toHaveCount(0);

  await createTokenButton.click();
  await expect(page.locator("pre.json-block")).toContainText('"raw_token"');
  await saveHashButton.click();
  await expect(page.locator('.toast[data-tone="success"]').last()).toContainText("App API Token saved");
});

test("route toaster maps important mobile feedback to a non-blocking sheet toast", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings?error=Google%20Drive%20connection%20failed.");

  const dock = page.locator(".feedback-dock");
  const sheet = page.locator(".route-feedback-sheet");
  const bottomNav = page.locator(".bottom-nav");

  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".toast__icon")).toBeVisible();
  await expect(sheet.locator(".toast__title")).toContainText("Gagal");
  await expect(sheet.locator(".toast__message")).toContainText("Google Drive connection failed.");
  await expect(page.locator(".mobile-notification-sheet")).toHaveCount(0);
  await expect(page.locator(".mobile-notification-sheet__backdrop")).toHaveCount(0);
  await expect(dock).toHaveCSS("pointer-events", "none");
  await expect(sheet).toHaveCSS("pointer-events", "auto");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
  const sheetBox = await sheet.boundingBox();
  const bottomNavBox = await bottomNav.boundingBox();
  if (!sheetBox || !bottomNavBox) {
    throw new Error("Expected mobile feedback and bottom nav to have layout boxes.");
  }
  expect(Math.round(sheetBox.x)).toBeGreaterThan(0);
  expect(Math.round(sheetBox.width)).toBeLessThan(390);
  expect(Math.round(sheetBox.y + sheetBox.height)).toBeLessThanOrEqual(Math.round(bottomNavBox.y) + 1);
  await expect
    .poll(() => new URL(page.url()).searchParams.has("error"), {
      message: "route feedback param is cleared after queueing the mobile feedback",
    })
    .toBe(false);
  await expect(sheet).toHaveCount(0, { timeout: 7500 });
});

test("route toaster maps important desktop feedback to a docked expanded toast", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/settings?error=Google%20Drive%20connection%20failed.");

  const dock = page.locator(".feedback-dock");
  const sheet = page.locator(".route-feedback-sheet");

  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".toast__title")).toContainText("Gagal");
  await expect(sheet.locator(".toast__message")).toContainText("Google Drive connection failed.");
  await expect(page.locator(".mobile-notification-sheet")).toHaveCount(0);
  await expect(page.locator(".mobile-notification-sheet__backdrop")).toHaveCount(0);
  await expect(dock).toHaveCSS("pointer-events", "none");
  await expect(sheet).toHaveCSS("pointer-events", "auto");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");

  const sheetBox = await sheet.boundingBox();
  const viewport = page.viewportSize();
  if (!sheetBox || !viewport) {
    throw new Error("Expected desktop notification sheet to have viewport and layout boxes.");
  }

  expect(Math.round(viewport.width - (sheetBox.x + sheetBox.width))).toBeLessThanOrEqual(24);
  expect(Math.round(viewport.height - (sheetBox.y + sheetBox.height))).toBeLessThanOrEqual(32);

  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});
