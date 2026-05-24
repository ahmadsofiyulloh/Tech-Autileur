import { INTAKE_VISION_PROMPT_VERSION, INTAKE_VISION_SCHEMA_VERSION } from "@/lib/intake/vision-contract";
import {
  PROMPT_PACK_I2V_TIMELINE_WINDOWS,
  PROMPT_PACK_SHOPEE_COPY_MAX_CHARS,
  PROMPT_PACK_VO_MAX_CHARS,
} from "@/lib/prompts/prompt-pack-contract";

type JsonSchema = {
  type: string | readonly string[];
  required?: readonly string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  additionalProperties?: boolean;
  enum?: readonly string[];
  description?: string;
  maxLength?: number;
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
      description: "Image or extraction quality flags such as blurry, cropped, rotated, low_resolution, occluded, missing_source_image, or none.",
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
      description: "Operator-reviewed Indonesian product name inferred from visible evidence or structured source facts. Must be non-empty.",
    },
    keyword_cari_etalase: {
      ...stringSchema,
      description: "Short Indonesian shelf/search keyword derived from visible product context. Must be non-empty.",
    },
    deskripsi_visual: {
      ...stringSchema,
      description: "Short Indonesian visual description from the product image. Must be non-empty.",
    },
    use_case: {
      ...stringSchema,
      description: "Specific Indonesian usage moment for this product. Must be non-empty.",
    },
    pain_point: {
      ...stringSchema,
      description: "Specific buyer problem this product helps solve. Must be non-empty.",
    },
    selling_angle: {
      ...stringSchema,
      description: "Strongest grounded product angle for affiliate content. Must be non-empty.",
    },
    target_viewer: {
      ...stringSchema,
      description: "Concrete Indonesian viewer persona likely to care about this product. Must be non-empty.",
    },
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

const promptRulesSchema = {
  type: "object",
  required: [
    "i2i_prompt_rules",
    "i2v_prompt_rules",
    "caption_rules",
    "hashtag_rules",
    "negative_prompt_rules",
    "product_positioning_notes",
  ],
  properties: {
    i2i_prompt_rules: stringArraySchema,
    i2v_prompt_rules: stringArraySchema,
    caption_rules: stringArraySchema,
    hashtag_rules: stringArraySchema,
    negative_prompt_rules: stringArraySchema,
    product_positioning_notes: stringArraySchema,
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

const visualReferenceSchema = {
  type: "object",
  required: ["kind", "label", "drive_item_ref_id", "drive_url", "drive_path", "analysis_json"],
  properties: {
    kind: { type: "string", enum: ["CHARACTER", "ENVIRONMENT", "PRODUCT"] },
    label: stringSchema,
    drive_item_ref_id: stringSchema,
    drive_url: stringSchema,
    drive_path: stringSchema,
    analysis_json: {
      type: ["object", "null"],
      additionalProperties: true,
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

function buildI2IFramePromptSchema(slot: "clip_1" | "clip_2", frame: "first_frame" | "last_frame") {
  return {
    type: "object",
    required: ["slot", "frame", "prompt_text", "visual_references", "prompt_rules"],
    properties: {
      slot: { type: "string", enum: [slot] },
      frame: { type: "string", enum: [frame] },
      prompt_text: stringSchema,
      visual_references: {
        type: "array",
        items: visualReferenceSchema,
      },
      prompt_rules: promptRulesSchema,
    },
    additionalProperties: false,
  } as const satisfies JsonSchema;
}

function buildI2IClipPromptSchema(slot: "clip_1" | "clip_2") {
  return {
    type: "object",
    required: ["slot", "first_frame", "last_frame"],
    properties: {
      slot: { type: "string", enum: [slot] },
      first_frame: buildI2IFramePromptSchema(slot, "first_frame"),
      last_frame: buildI2IFramePromptSchema(slot, "last_frame"),
    },
    additionalProperties: false,
  } as const satisfies JsonSchema;
}

const continuityPromptSchema = {
  type: "object",
  required: ["first_frame_hint", "last_frame_hint"],
  properties: {
    first_frame_hint: stringSchema,
    last_frame_hint: stringSchema,
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

function buildI2VPromptSchema(slot: "clip_1" | "clip_2") {
  return {
    type: "object",
    required: ["slot", "prompt_text", "visual_references", "prompt_rules", "continuity"],
    properties: {
      slot: { type: "string", enum: [slot] },
      prompt_text: stringSchema,
      visual_references: {
        type: "array",
        items: visualReferenceSchema,
      },
      prompt_rules: promptRulesSchema,
      continuity: continuityPromptSchema,
    },
    additionalProperties: false,
  } as const satisfies JsonSchema;
}

const promptContextSchema = {
  type: "object",
  required: ["mode"],
  properties: {
    mode: { type: "string", enum: ["server_injected"] },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

function buildCompactI2IFramePromptSchema(slot: "clip_1" | "clip_2", frame: "first_frame" | "last_frame") {
  return {
    type: "object",
    required: ["slot", "frame", "prompt_text"],
    properties: {
      slot: { type: "string", enum: [slot] },
      frame: { type: "string", enum: [frame] },
      prompt_text: stringSchema,
    },
    additionalProperties: false,
  } as const satisfies JsonSchema;
}

function buildCompactI2IClipPromptSchema(slot: "clip_1" | "clip_2") {
  return {
    type: "object",
    required: ["slot", "first_frame", "last_frame"],
    properties: {
      slot: { type: "string", enum: [slot] },
      first_frame: buildCompactI2IFramePromptSchema(slot, "first_frame"),
      last_frame: buildCompactI2IFramePromptSchema(slot, "last_frame"),
    },
    additionalProperties: false,
  } as const satisfies JsonSchema;
}

const compactI2VTimelineSegmentSchema = {
  type: "object",
  required: ["time", "action"],
  properties: {
    time: {
      type: "string",
      enum: PROMPT_PACK_I2V_TIMELINE_WINDOWS,
    },
    action: {
      ...stringSchema,
      description:
        "Veo I2V timeline action for this exact window. Use only @firstframe as the video reference. The 00:00-00:02 action must state that the VO hook starts immediately.",
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

function buildCompactI2VAudioSchema(maxVoChars: number = PROMPT_PACK_VO_MAX_CHARS) {
  return {
    type: "object",
    required: ["voiceover_text", "voiceover_timing", "voice_style", "sfx_cues", "ambient_cues"],
    properties: {
      voiceover_text: {
        ...stringSchema,
        maxLength: maxVoChars,
        description:
          `Short Indonesian spoken UGC hook for 00:00-00:02, grounded in product facts and ${maxVoChars} characters or fewer.`,
      },
      voiceover_timing: { type: "string", enum: ["00:00-00:02", "none"] },
      voice_style: {
        ...stringSchema,
        description: "Natural Indonesian UGC delivery style, not English marketing boilerplate.",
      },
      sfx_cues: {
        ...stringSchema,
        description: "Subtle product-relevant SFX that stays under VO.",
      },
      ambient_cues: {
        ...stringSchema,
        description: "Subtle native ambience that does not overpower VO.",
      },
    },
    additionalProperties: false,
  } as const satisfies JsonSchema;
}

function buildCompactI2VPromptSchema(slot: "clip_1" | "clip_2", maxVoChars?: number) {
  return {
    type: "object",
    required: [
      "slot",
      "prompt_text",
      "duration_seconds",
      "timeline",
      "motion_prompt",
      "camera_motion",
      "continuity",
      "negative_prompt",
      "audio",
    ],
    properties: {
      slot: { type: "string", enum: [slot] },
      prompt_text: {
        ...stringSchema,
        description:
          'Veo image-to-video prompt text. Use only @firstframe as the video reference and include dialogue/audio guidance formatted as VO: "{audio.voiceover_text}".',
      },
      duration_seconds: { type: "number" },
      timeline: {
        type: "array",
        items: compactI2VTimelineSegmentSchema,
      },
      motion_prompt: {
        ...stringSchema,
        description: "Motion guidance that compiles cleanly into structured Veo JSON using only @firstframe.",
      },
      camera_motion: {
        ...stringSchema,
        description: "Camera guidance for one continuous 8-second clip using only @firstframe.",
      },
      continuity: {
        type: "object",
        required: ["first_frame_hint", "last_frame_hint"],
        properties: {
          first_frame_hint: {
            ...stringSchema,
            description: "Continuity guidance anchored to @firstframe.",
          },
          last_frame_hint: {
            ...stringSchema,
            description:
              "Legacy compatibility hint only. Keep it internal and do not make I2V instructions depend on another reference image.",
          },
        },
        additionalProperties: false,
      },
      negative_prompt: {
        ...stringSchema,
        description: "Negative prompt for Veo I2V without unsupported claims or second-reference instructions.",
      },
      audio: buildCompactI2VAudioSchema(maxVoChars),
    },
    additionalProperties: false,
  } as const satisfies JsonSchema;
}

const uploadCopySchema = {
  type: "object",
  required: ["shopee_caption", "shopee_tags", "shopee_caption_tags"],
  properties: {
    shopee_caption: stringSchema,
    shopee_tags: stringSchema,
    shopee_caption_tags: {
      ...stringSchema,
      maxLength: PROMPT_PACK_SHOPEE_COPY_MAX_CHARS,
      description: "Shopee-ready caption plus tags, 150 characters or fewer total.",
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

export const GEMINI_PROMPT_PACK_RESPONSE_SCHEMA = buildGeminiPromptPackResponseSchema();

export function buildGeminiPromptPackResponseSchema(maxVoChars?: number) {
  return {
  type: "object",
  required: [
    "product_analysis",
    "i2i_prompts",
    "i2v_prompts",
    "caption",
    "tags",
    "upload_copy",
    "negative_prompt_rules",
    "consistency_rules",
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
          required: ["id", "is_primary", "status", "source_type", "drive_item_ref_id", "analysis_json"],
          properties: {
            id: stringSchema,
            is_primary: { type: "boolean" },
            status: stringSchema,
            source_type: stringSchema,
            drive_item_ref_id: stringSchema,
            analysis_json: {
              type: ["object", "null"],
              additionalProperties: true,
            },
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
    i2i_prompts: {
      type: "object",
      required: ["clip_1", "clip_2"],
      properties: {
        clip_1: buildCompactI2IClipPromptSchema("clip_1"),
        clip_2: buildCompactI2IClipPromptSchema("clip_2"),
      },
      additionalProperties: false,
    },
    i2v_prompts: {
      type: "object",
      required: ["clip_1", "clip_2"],
      properties: {
        clip_1: buildCompactI2VPromptSchema("clip_1", maxVoChars),
        clip_2: buildCompactI2VPromptSchema("clip_2", maxVoChars),
      },
      additionalProperties: false,
    },
    caption: stringSchema,
    tags: stringSchema,
    upload_copy: uploadCopySchema,
    negative_prompt_rules: stringArraySchema,
    consistency_rules: stringArraySchema,
  },
  additionalProperties: false,
} as const satisfies JsonSchema;
}

const affiliateAssetVisualAnalysisSchema = {
  type: "object",
  required: [
    "summary",
    "subject",
    "style_keywords",
    "scene_keywords",
    "color_keywords",
    "material_keywords",
    "mood_keywords",
    "composition_keywords",
    "ocr_text_lines",
    "quality_flags",
  ],
  properties: {
    summary: stringSchema,
    subject: stringSchema,
    style_keywords: stringArraySchema,
    scene_keywords: stringArraySchema,
    color_keywords: stringArraySchema,
    material_keywords: stringArraySchema,
    mood_keywords: stringArraySchema,
    composition_keywords: stringArraySchema,
    ocr_text_lines: stringArraySchema,
    quality_flags: stringArraySchema,
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

const affiliateAssetPromptRulesSchema = {
  type: "object",
  required: ["must_keep", "must_avoid"],
  properties: {
    must_keep: stringArraySchema,
    must_avoid: stringArraySchema,
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

const affiliateAssetQualitySchema = {
  type: "object",
  required: ["overall_confidence", "review_required", "blocking_flags", "notes"],
  properties: {
    overall_confidence: confidenceSchema,
    review_required: { type: "boolean" },
    blocking_flags: stringArraySchema,
    notes: stringArraySchema,
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

const affiliateAssetAnalysisSchema = {
  type: "object",
  required: [
    "schema_version",
    "prompt_version",
    "asset_kind",
    "profile_code",
    "drive_item_ref_id",
    "drive_item_name",
    "analysis",
    "prompt_rules",
    "quality",
  ],
  properties: {
    schema_version: { type: "string" },
    prompt_version: { type: "string" },
    asset_kind: { type: "string", enum: ["CHARACTER", "ENVIRONMENT"] },
    profile_code: stringSchema,
    drive_item_ref_id: stringSchema,
    drive_item_name: stringSchema,
    analysis: affiliateAssetVisualAnalysisSchema,
    prompt_rules: affiliateAssetPromptRulesSchema,
    quality: affiliateAssetQualitySchema,
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

export const GEMINI_AFFILIATE_PROFILE_ASSET_ANALYSIS_RESPONSE_SCHEMA = affiliateAssetAnalysisSchema;

const shareCaptionBlockSchema = {
  type: "object",
  required: ["role", "label", "content", "char_count", "recommended_max_chars", "copy_ready"],
  properties: {
    role: {
      type: "string",
      enum: [
        "main_caption",
        "first_comment",
        "thread_section",
        "x_reply_with_link",
        "pinterest_pin_title",
        "pinterest_pin_description",
        "pinterest_destination_link",
        "pinterest_alt_text",
        "hashtags",
      ],
      description: "Structural role of this copy block.",
    },
    label: {
      type: "string",
      description: "Human-readable label for this block (e.g. 'Caption', 'Reply dengan Link').",
    },
    content: {
      type: "string",
      description: "The actual copy content for this block.",
    },
    char_count: {
      type: "number",
      description: "Character count of content.",
    },
    recommended_max_chars: {
      type: "number",
      description: "Recommended maximum character count for this block role.",
    },
    copy_ready: {
      type: "boolean",
      description: "True if this block is ready to copy-paste without further editing.",
    },
    warning: {
      type: "string",
      description: "Optional warning if content exceeds recommended limit or has issues.",
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

const shareImagePromptBlockSchema = {
  type: "object",
  required: ["source", "image_inputs", "prompt_text", "must_keep", "must_avoid", "aspect_ratio", "upload_note"],
  properties: {
    source: {
      type: "string",
      enum: ["i2i"],
      description: "Always 'i2i' — image-to-image generation discipline.",
    },
    image_inputs: {
      type: "array",
      items: { type: "string" },
      description: "List of image input descriptions (e.g. product photo angles to use as reference).",
    },
    prompt_text: {
      type: "string",
      description: "The image generation prompt text. Must NOT request: text overlay, price label, discount badge, fake logo, fake UI, unsupported claims, or product shape changes.",
    },
    must_keep: {
      type: "array",
      items: { type: "string" },
      description: "Visual elements that must be preserved from the source image (e.g. product color, brand mark).",
    },
    must_avoid: {
      type: "array",
      items: { type: "string" },
      description: "Elements to explicitly avoid: text overlay, price label, discount badge, fake logo, fake UI, unsupported claims, product shape changes.",
    },
    aspect_ratio: {
      type: "string",
      description: "Target aspect ratio (e.g. '4:5', '1:1', '9:16', '2:3', '16:9').",
    },
    upload_note: {
      type: "string",
      description: "Brief operator note about which product image to upload as i2i reference.",
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

const shareCaptionVariantSchema = {
  type: "object",
  required: ["caption", "angle", "platform"],
  properties: {
    caption: {
      type: "string",
      description: "Indonesian social media caption grounded in product facts and affiliate URL.",
    },
    angle: {
      type: "string",
      enum: ["benefit_focused", "problem_solution", "social_proof", "urgency_scarcity", "educational", "storytelling"],
    },
    platform: {
      type: "string",
      enum: ["facebook", "threads", "x", "pinterest"],
    },
    platform_specific_fields: {
      type: "object",
      properties: {
        reply_with_link: {
          type: "string",
          description: "Untuk X: CTA pendek + link affiliate untuk di-post sebagai reply pertama (max ~100 chars + link). Wajib untuk platform x.",
        },
        pin_title: {
          type: "string",
          description: "Untuk Pinterest: judul pin yang keyword-first (max 100 chars). Wajib untuk platform pinterest.",
        },
        hashtags: {
          type: "array",
          items: { type: "string" },
          description: "Hashtag relevan tanpa simbol #. Facebook: 1-3. X: 0-2. Threads/Pinterest: kosong.",
        },
      },
      additionalProperties: false,
    },
    blocks: {
      type: "array",
      items: shareCaptionBlockSchema,
      description: "Structured copy blocks for this variant. Each block has a role, label, content, and char metadata. Replaces platform_specific_fields for new output.",
    },
    image_prompt: shareImagePromptBlockSchema,
  },
  additionalProperties: false,
} as const satisfies JsonSchema;

export const GEMINI_SHARE_CAPTION_RESPONSE_SCHEMA = {
  type: "object",
  required: ["variants"],
  properties: {
    variants: {
      type: "array",
      items: shareCaptionVariantSchema,
      description: "Array of caption variants matching requested variant_count.",
    },
  },
  additionalProperties: false,
} as const satisfies JsonSchema;
