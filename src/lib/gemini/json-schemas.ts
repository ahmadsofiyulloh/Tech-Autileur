import { INTAKE_VISION_PROMPT_VERSION, INTAKE_VISION_SCHEMA_VERSION } from "@/lib/intake/vision-contract";

type JsonSchema = {
  type: string | readonly string[];
  required?: readonly string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  additionalProperties?: boolean;
  enum?: readonly string[];
  description?: string;
};

const stringSchema = { type: "string" } as const;
const stringArraySchema = {
  type: "array",
  items: stringSchema,
} as const;
const confidenceSchema = {
  type: "string",
  enum: ["high", "medium", "low"],
} as const;

const ocrExtractedFieldsSchema = {
  type: "object",
  required: ["product_title", "category", "rating_text", "sold_count_text", "price_text", "shop_name"],
  properties: {
    product_title: {
      ...stringSchema,
      description: "Exact product title text visible in this evidence, or empty string if not visible.",
    },
    category: {
      ...stringSchema,
      description: "Exact category or product classification text visible in this evidence, or empty string.",
    },
    rating_text: {
      ...stringSchema,
      description: "Exact rating text visible in this evidence, preserving punctuation and decimal marks.",
    },
    sold_count_text: {
      ...stringSchema,
      description: "Exact sold count text visible in this evidence, preserving abbreviations.",
    },
    price_text: {
      ...stringSchema,
      description: "Exact price text visible in this evidence, preserving currency and separators.",
    },
    shop_name: {
      ...stringSchema,
      description: "Exact shop or account name visible in this evidence, or empty string.",
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

const ocrEvidenceBlockSchema = {
  type: "object",
  required: ["visible_text_lines", "extracted_fields", "confidence", "quality_flags"],
  properties: {
    visible_text_lines: {
      ...stringArraySchema,
      description: "Short exact OCR text lines visible in this image. Do not translate or rewrite marketplace text.",
    },
    extracted_fields: ocrExtractedFieldsSchema,
    confidence: confidenceSchema,
    quality_flags: {
      ...stringArraySchema,
      description: "Image or extraction quality flags such as blurry, cropped, rotated, low_resolution, occluded, or none.",
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

const ocrEvidenceSchema = {
  type: "object",
  required: ["product_image", "shopee_screenshot", "tiktok_screenshot"],
  properties: {
    product_image: ocrEvidenceBlockSchema,
    shopee_screenshot: ocrEvidenceBlockSchema,
    tiktok_screenshot: ocrEvidenceBlockSchema,
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

const extractionQualitySchema = {
  type: "object",
  required: ["overall_confidence", "review_required", "blocking_flags", "notes"],
  properties: {
    overall_confidence: confidenceSchema,
    review_required: { type: "boolean" },
    blocking_flags: {
      ...stringArraySchema,
      description: "Flags that require operator review before prompt generation trusts the OCR.",
    },
    notes: {
      ...stringArraySchema,
      description: "Concise Indonesian notes about uncertainty, missing evidence, or OCR risk.",
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

export const GEMINI_INTAKE_VISION_RESPONSE_SCHEMA = {
  type: "object",
  required: [
    "schema_version",
    "prompt_version",
    "nama_produk",
    "keyword_cari_etalase",
    "deskripsi_visual",
    "use_case",
    "pain_point",
    "selling_angle",
    "target_viewer",
    "product_title",
    "marketplace",
    "category",
    "rating_text",
    "sold_count_text",
    "price_text",
    "shop_name",
    "visible_product_attributes",
    "risk_notes",
    "confidence_notes",
    "ocr_evidence",
    "extraction_quality",
  ],
  properties: {
    schema_version: { type: "string", enum: [INTAKE_VISION_SCHEMA_VERSION] },
    prompt_version: { type: "string", enum: [INTAKE_VISION_PROMPT_VERSION] },
    nama_produk: {
      ...stringSchema,
      description: "Operator-reviewed Indonesian product name inferred from visible evidence.",
    },
    keyword_cari_etalase: {
      ...stringSchema,
      description: "Short Indonesian shelf/search keyword derived from visible product context.",
    },
    deskripsi_visual: {
      ...stringSchema,
      description: "Short Indonesian visual description from the product image.",
    },
    use_case: stringSchema,
    pain_point: stringSchema,
    selling_angle: stringSchema,
    target_viewer: stringSchema,
    product_title: {
      ...stringSchema,
      description: "Best visible product title, copied exactly when shown in marketplace screenshots.",
    },
    marketplace: {
      type: "string",
      enum: ["Shopee + TikTok", "SHOPEE", "TIKTOK", ""],
    },
    category: stringSchema,
    rating_text: {
      ...stringSchema,
      description: "Best marketplace rating text copied exactly, or empty string.",
    },
    sold_count_text: {
      ...stringSchema,
      description: "Best marketplace sold count text copied exactly, or empty string.",
    },
    price_text: {
      ...stringSchema,
      description: "Best marketplace price text copied exactly, or empty string.",
    },
    shop_name: {
      ...stringSchema,
      description: "Best marketplace shop/account name copied exactly, or empty string.",
    },
    visible_product_attributes: stringArraySchema,
    risk_notes: stringArraySchema,
    confidence_notes: stringArraySchema,
    ocr_evidence: ocrEvidenceSchema,
    extraction_quality: extractionQualitySchema,
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

const nullableLockStateSchema = {
  type: "object",
  required: ["locked", "notes", "drive_item_ref_id"],
  properties: {
    locked: { type: "boolean" },
    notes: stringSchema,
    drive_item_ref_id: {
      type: ["string", "null"],
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

export const GEMINI_PROMPT_PACK_RESPONSE_SCHEMA = {
  type: "object",
  required: [
    "product_analysis",
    "prompt_context",
    "i2i_prompts",
    "i2v_prompts",
    "caption",
    "tags",
    "target_marketplace",
    "negative_prompt_rules",
    "consistency_rules",
    "seed_character",
    "environment",
  ],
  properties: {
    product_analysis: {
      type: "object",
      required: ["mode", "prompt_code", "version", "product", "source_image", "coverage", "vision_analysis"],
      properties: {
        mode: stringSchema,
        prompt_code: stringSchema,
        version: { type: "number" },
        product: {
          type: "object",
          required: ["id", "product_code", "product_name", "status"],
          properties: {
            id: stringSchema,
            product_code: stringSchema,
            product_name: stringSchema,
            niche: { type: ["string", "null"] },
            marketplace: { type: ["string", "null"] },
            marketplace_product_link: { type: ["string", "null"] },
            status: stringSchema,
          },
          additionalProperties: true,
        },
        source_image: {
          type: ["object", "null"],
          required: ["id", "is_primary", "status", "source_type", "drive_item_ref_id"],
          properties: {
            id: stringSchema,
            is_primary: { type: "boolean" },
            status: stringSchema,
            source_type: stringSchema,
            drive_item_ref_id: stringSchema,
            drive_item: {
              type: ["object", "null"],
              additionalProperties: true,
            },
          },
          additionalProperties: true,
        },
        coverage: {
          type: "object",
          required: ["vision_analysis", "prompt_clips"],
          properties: {
            vision_analysis: { type: "number" },
            prompt_clips: { type: "number" },
          },
          additionalProperties: false,
        },
        vision_analysis: {
          type: "object",
          required: ["summary", "hero_direction", "scene_constraints", "risks"],
          properties: {
            summary: stringSchema,
            hero_direction: stringSchema,
            scene_constraints: stringArraySchema,
            risks: stringArraySchema,
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    prompt_context: {
      type: "object",
      additionalProperties: true,
    },
    i2i_prompts: {
      type: "object",
      required: ["clip_1", "clip_2"],
      properties: {
        clip_1: {
          type: "object",
          required: ["slot", "first_frame", "last_frame"],
          properties: {
            slot: { type: "string", enum: ["clip_1"] },
            first_frame: stringSchema,
            last_frame: stringSchema,
          },
          additionalProperties: false,
        },
        clip_2: {
          type: "object",
          required: ["slot", "first_frame", "last_frame"],
          properties: {
            slot: { type: "string", enum: ["clip_2"] },
            first_frame: stringSchema,
            last_frame: stringSchema,
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    i2v_prompts: {
      type: "object",
      required: ["clip_1", "clip_2"],
      properties: {
        clip_1: {
          type: "object",
          required: ["slot", "prompt"],
          properties: {
            slot: { type: "string", enum: ["clip_1"] },
            prompt: stringSchema,
          },
          additionalProperties: false,
        },
        clip_2: {
          type: "object",
          required: ["slot", "prompt"],
          properties: {
            slot: { type: "string", enum: ["clip_2"] },
            prompt: stringSchema,
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    caption: stringSchema,
    tags: stringSchema,
    target_marketplace: { type: "string", enum: ["Shopee + TikTok"] },
    negative_prompt_rules: stringArraySchema,
    consistency_rules: stringArraySchema,
    seed_character: nullableLockStateSchema,
    environment: nullableLockStateSchema,
  },
  additionalProperties: false,
} as const satisfies JsonSchema;
