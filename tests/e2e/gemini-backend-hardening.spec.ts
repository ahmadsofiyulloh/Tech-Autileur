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
  buildPromptPackStoragePayload,
  type PromptPackGenerationOutput,
  type JsonObject,
} from "../../src/lib/prompts/prompt-pack-contract";

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
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.additionalProperties).toBe(false);
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.required).toContain("negative_prompt_rules");
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.required).toContain("prompt_context");
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
  const output = {
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
        status: "IMAGE_ANALYZED",
      },
      source_image: null,
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
      clip_1: { slot: "clip_1", first_frame: "first", last_frame: "last" },
      clip_2: { slot: "clip_2", first_frame: "first", last_frame: "last" },
    },
    i2v_prompts: {
      clip_1: { slot: "clip_1", prompt: "motion one" },
      clip_2: { slot: "clip_2", prompt: "motion two" },
    },
    caption: "Caption",
    tags: "#tas #shopee",
    target_marketplace: "Shopee + TikTok",
    negative_prompt_rules: ["no extra props"],
    consistency_rules: ["same product silhouette"],
    seed_character: { locked: false, notes: "", drive_item_ref_id: null },
    environment: { locked: false, notes: "", drive_item_ref_id: null },
  } satisfies PromptPackGenerationOutput;

  const payload = buildPromptPackStoragePayload(output, serverPromptContext);

  expect(payload.personalization_json.prompt_context).toEqual(serverPromptContext);
});
