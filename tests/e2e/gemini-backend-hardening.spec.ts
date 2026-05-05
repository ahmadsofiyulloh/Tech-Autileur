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
  parsePromptPackGenerationOutput,
  type PromptPackGenerationOutput,
  type JsonObject,
} from "../../src/lib/prompts/prompt-pack-contract";
import { assertUploadedImage, prepareGeminiCompatibleUploadImage } from "../../src/lib/intake/upload-validation";
import sharp from "sharp";

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
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.required).toContain("negative_prompt_rules");
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.required).toContain("prompt_context");
  expect(GEMINI_PROMPT_PACK_RESPONSE_SCHEMA.properties?.product_analysis?.properties?.product?.required).toContain("status");
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

test("prompt pack parser backfills missing product status from the source product", () => {
  const parsed = parsePromptPackGenerationOutput(
    JSON.stringify({
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
    }),
    {
      fallbackProductStatus: "IMAGE_ANALYZED",
    },
  );

  const productAnalysis = parsed.product_analysis as { product: { status: string } };

  expect(productAnalysis.product.status).toBe("IMAGE_ANALYZED");
});

test("prompt pack parser rejects mismatched product status", () => {
  expect(() =>
    parsePromptPackGenerationOutput(
      JSON.stringify({
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
            status: "DRAFT",
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
      }),
      {
        fallbackProductStatus: "IMAGE_ANALYZED",
      },
    ),
  ).toThrow("product_analysis.product.status must match the source product status (IMAGE_ANALYZED).");
});

test("prompt pack parser rejects mismatched source image echo", () => {
  expect(() =>
    parsePromptPackGenerationOutput(
      JSON.stringify({
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
          source_image: {
            id: "source-image-id",
            is_primary: true,
            status: "DETACHED",
            source_type: "GOOGLE_DRIVE",
            drive_item_ref_id: "drive-item-id",
            drive_item: null,
          },
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
      }),
      {
        fallbackProductStatus: "IMAGE_ANALYZED",
        fallbackSourceImage: {
          id: "source-image-id",
          is_primary: true,
          status: "ATTACHED",
          source_type: "GOOGLE_DRIVE",
          drive_item_ref_id: "drive-item-id",
          drive_item: null,
        },
      },
    ),
  ).toThrow("product_analysis.source_image.status must match the source image value (ATTACHED).");
});

test("prompt pack parser recovers JSON from wrapped Gemini text", () => {
  const parsed = parsePromptPackGenerationOutput(`
    \`\`\`json
    ${JSON.stringify({
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
    })}
    \`\`\`
  `);

  expect(parsed.caption).toBe("Caption");
  expect(parsed.target_marketplace).toBe("Shopee + TikTok");
});
