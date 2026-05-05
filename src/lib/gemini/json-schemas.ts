type JsonSchema = {
  type: string | readonly string[];
  required?: readonly string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  additionalProperties?: boolean;
  enum?: readonly string[];
};

const stringSchema = { type: "string" } as const;
const stringArraySchema = {
  type: "array",
  items: stringSchema,
} as const;

export const GEMINI_INTAKE_VISION_RESPONSE_SCHEMA = {
  type: "object",
  required: [
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
  ],
  properties: {
    nama_produk: stringSchema,
    keyword_cari_etalase: stringSchema,
    deskripsi_visual: stringSchema,
    use_case: stringSchema,
    pain_point: stringSchema,
    selling_angle: stringSchema,
    target_viewer: stringSchema,
    product_title: stringSchema,
    marketplace: stringSchema,
    category: stringSchema,
    rating_text: stringSchema,
    sold_count_text: stringSchema,
    price_text: stringSchema,
    shop_name: stringSchema,
    visible_product_attributes: stringArraySchema,
    risk_notes: stringArraySchema,
    confidence_notes: stringArraySchema,
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
          additionalProperties: true,
        },
        source_image: {
          type: ["object", "null"],
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
