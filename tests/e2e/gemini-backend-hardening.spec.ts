import { expect, test } from "@playwright/test";
import {
  PROMPT_PACK_GEMINI_KEY_PRIORITY,
  getGeminiQuotaGroupKey,
} from "../../src/lib/gemini/routing";
import {
  GEMINI_INTAKE_VISION_RESPONSE_SCHEMA,
  GEMINI_PROMPT_PACK_RESPONSE_SCHEMA,
} from "../../src/lib/gemini/json-schemas";
import { parseIntakeVisionOutput } from "../../src/lib/intake/vision-contract";
import {
  buildPromptPackEditorStoragePayload,
  buildPromptPackStoragePayload,
  parsePromptPackGenerationOutput,
  readPromptPackEditorPromptSet,
  type PromptPackGenerationOutput,
  type JsonObject,
} from "../../src/lib/prompts/prompt-pack-contract";
import { isGeminiTemporaryUnavailableMessage, sanitizeGeminiStatusMessage } from "../../src/lib/gemini/error-message";
import { isAffiliateProfileSchemaMissingError } from "../../src/lib/affiliate-profiles/schema-errors";
import {
  getAffiliateProfileAssetAnalysisState,
  isAffiliateProfileAssetAnalysisReady,
  isAffiliateProfilePromptReady,
} from "../../src/lib/affiliate-profiles/readiness";
import { assertUploadedImage, prepareGeminiCompatibleUploadImage } from "../../src/lib/intake/upload-validation";
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
        drive_item: null;
        analysis_json: JsonObject | null;
      }
    | null;
};

function buildPromptPackFixture(options?: PromptPackFixtureOptions) {
  const sharedVisualReferences = [
    {
      kind: "CHARACTER",
      label: "Character",
      drive_item_ref_id: "character-ref",
      drive_url: "https://example.com/character.png",
      drive_path: "/assets/character.png",
      analysis_json: null,
    },
    {
      kind: "ENVIRONMENT",
      label: "Environment",
      drive_item_ref_id: "environment-ref",
      drive_url: "https://example.com/environment.png",
      drive_path: "/assets/environment.png",
      analysis_json: null,
    },
    {
      kind: "PRODUCT",
      label: "Product",
      drive_item_ref_id: "product-ref",
      drive_url: "https://example.com/product.png",
      drive_path: "/assets/product.png",
      analysis_json: null,
    },
  ] satisfies PromptPackGenerationOutput["i2i_prompts"]["clip_1"]["first_frame"]["visual_references"];
  const sharedPromptRules = {
    i2i_prompt_rules: ["keep product shape"],
    i2v_prompt_rules: ["keep motion smooth"],
    caption_rules: ["short caption"],
    hashtag_rules: ["#tas"],
    negative_prompt_rules: ["no extra props"],
    product_positioning_notes: ["highlight the bag silhouette"],
  } satisfies PromptPackGenerationOutput["i2i_prompts"]["clip_1"]["first_frame"]["prompt_rules"];

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
    },
    i2i_prompts: {
      clip_1: {
        slot: "clip_1",
        first_frame: {
          slot: "clip_1",
          frame: "first_frame",
          prompt_text: "first",
          visual_references: sharedVisualReferences,
          prompt_rules: sharedPromptRules,
        },
        last_frame: {
          slot: "clip_1",
          frame: "last_frame",
          prompt_text: "last",
          visual_references: sharedVisualReferences,
          prompt_rules: sharedPromptRules,
        },
      },
      clip_2: {
        slot: "clip_2",
        first_frame: {
          slot: "clip_2",
          frame: "first_frame",
          prompt_text: "first",
          visual_references: sharedVisualReferences,
          prompt_rules: sharedPromptRules,
        },
        last_frame: {
          slot: "clip_2",
          frame: "last_frame",
          prompt_text: "last",
          visual_references: sharedVisualReferences,
          prompt_rules: sharedPromptRules,
        },
      },
    },
    i2v_prompts: {
      clip_1: {
        slot: "clip_1",
        prompt_text: "motion one",
        visual_references: sharedVisualReferences,
        prompt_rules: sharedPromptRules,
        continuity: {
          first_frame_hint: "start",
          last_frame_hint: "end",
        },
      },
      clip_2: {
        slot: "clip_2",
        prompt_text: "motion two",
        visual_references: sharedVisualReferences,
        prompt_rules: sharedPromptRules,
        continuity: {
          first_frame_hint: "start",
          last_frame_hint: "end",
        },
      },
    },
    caption: "Caption",
    tags: "#tas #shopee",
    target_marketplace: "Shopee + TikTok",
    negative_prompt_rules: ["no extra props"],
    consistency_rules: ["same product silhouette"],
    seed_character: { locked: false, notes: "", drive_item_ref_id: null },
    environment: { locked: false, notes: "", drive_item_ref_id: null },
  } satisfies PromptPackGenerationOutput;
}

function buildPromptPackServerContextFixture(): JsonObject {
  return {
    mode: "server_injected",
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
        i2i_prompt_rules: ["keep product shape"],
        i2v_prompt_rules: ["keep motion smooth"],
        caption_rules: ["short caption"],
        hashtag_rules: ["#tas"],
        negative_prompt_rules: ["no extra props"],
        product_positioning_notes: ["highlight the bag silhouette"],
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
        continuity: {
          first_frame_hint: "start",
          last_frame_hint: "end",
        },
      },
      clip_2: {
        slot: "clip_2",
        prompt_text: "motion two",
        continuity: {
          first_frame_hint: "start",
          last_frame_hint: "end",
        },
      },
    },
    caption: "Caption",
    tags: "#tas #shopee",
    negative_prompt_rules: ["no extra props"],
    consistency_rules: ["same product silhouette"],
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
    "continuity",
  ]);
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
            drive_item: null,
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
          drive_item: null,
          analysis_json: null,
        },
      },
    ),
  ).toThrow("product_analysis.source_image.status must match the source image value (ATTACHED).");
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

test("prompt pack parser rehydrates compact Gemini output with server context", () => {
  const serverPromptContext = buildPromptPackServerContextFixture();
  const parsed = parsePromptPackGenerationOutput(JSON.stringify(buildPromptPackCompactFixture()), {
    fallbackProductStatus: "IMAGE_ANALYZED",
    serverPromptContext,
  });

  expect(parsed.prompt_context).toEqual(serverPromptContext);
  expect(parsed.target_marketplace).toBe("Shopee + TikTok");
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
  expect(parsed.i2i_prompts.clip_1.first_frame.visual_references.map((reference) => reference.kind)).toEqual([
    "CHARACTER",
    "ENVIRONMENT",
    "PRODUCT",
  ]);
  expect(parsed.i2i_prompts.clip_1.first_frame.visual_references[0].drive_url).toBe("https://example.com/character.png");
  expect(parsed.i2i_prompts.clip_1.first_frame.prompt_rules.i2i_prompt_rules).toEqual(["keep product shape"]);
  expect(parsed.i2v_prompts.clip_2.visual_references[2].drive_path).toBe("/assets/product.png");
  expect(parsed.i2v_prompts.clip_2.prompt_rules.caption_rules).toEqual(["short caption"]);
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
