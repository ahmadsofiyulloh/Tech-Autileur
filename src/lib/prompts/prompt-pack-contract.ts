import {
  PROMPT_CLIP_KEYS,
  PROMPT_PACK_OUTPUT_KEYS,
  PROMPT_TARGET_MARKETPLACE,
  normalizeHashtagString,
  type PromptClipKey,
} from "@/lib/prompts/validation";

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[];
export type JsonObject = Record<string, JsonValue>;

type PromptPackProductRecord = {
  id: string;
  product_code: string;
  product_name: string;
  niche: string | null;
  marketplace: string | null;
  marketplace_product_link: string | null;
  status: string;
};

type PromptPackSourceDriveItemRecord = {
  id: string;
  name: string;
  drive_path: string;
  drive_url: string;
  mime_type: string | null;
};

type PromptPackSourceImageRecord = {
  id: string;
  is_primary: boolean;
  status: string;
  source_type: string;
  drive_item_ref_id: string;
  drive_item: PromptPackSourceDriveItemRecord | null;
};

type PromptPackLockStateJson = {
  locked: boolean;
  notes: string;
  drive_item_ref_id: string | null;
};

export type PromptPackI2IPromptJson = {
  slot: PromptClipKey;
  first_frame: string;
  last_frame: string;
};

export type PromptPackI2VPromptJson = {
  slot: PromptClipKey;
  prompt: string;
};

export type PromptPackGenerationOutput = {
  product_analysis: JsonObject;
  prompt_context: JsonObject;
  i2i_prompts: Record<PromptClipKey, PromptPackI2IPromptJson>;
  i2v_prompts: Record<PromptClipKey, PromptPackI2VPromptJson>;
  caption: string;
  tags: string;
  target_marketplace: typeof PROMPT_TARGET_MARKETPLACE;
  negative_prompt_rules: string[];
  consistency_rules: string[];
  seed_character: PromptPackLockStateJson;
  environment: PromptPackLockStateJson;
};

export type PromptPackStoragePayload = {
  product_analysis_json?: JsonObject | null;
  i2i_prompts_json: Record<PromptClipKey, PromptPackI2IPromptJson>;
  i2v_prompts_json: Record<PromptClipKey, PromptPackI2VPromptJson>;
  consistency_rules_json?: JsonObject | null;
  negative_rules_json?: JsonObject | null;
  personalization_json: JsonObject;
};

export type PromptPackEditorClip = {
  i2i_first_frame: string;
  i2i_last_frame: string;
  i2v_prompt: string;
};

export type PromptPackEditorPromptSet = {
  clips: Record<PromptClipKey, PromptPackEditorClip>;
  caption: string;
  tags: string;
  target_marketplace: typeof PROMPT_TARGET_MARKETPLACE;
  prompt_context: JsonValue | null;
  seed_character: PromptPackLockStateJson;
  environment: PromptPackLockStateJson;
};

type PromptPackAnalysisJson = {
  mode: string;
  prompt_code: string;
  version: number;
  product: PromptPackProductRecord;
  source_image: PromptPackSourceImageRecord | null;
  coverage: {
    vision_analysis: number;
    prompt_clips: number;
  };
  vision_analysis: {
    summary: string;
    hero_direction: string;
    scene_constraints: string[];
    risks: string[];
  };
};

type PromptPackConsistencyRulesJson = {
  consistency_rules: string[];
};

const EMPTY_LOCK_STATE: PromptPackLockStateJson = {
  locked: false,
  notes: "",
  drive_item_ref_id: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return value;
}

function requireExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[], label: string) {
  const keys = Object.keys(value);

  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => key in value)) {
    throw new Error(`${label} must contain exactly these keys: ${expectedKeys.join(", ")}.`);
  }
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function requireOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requireNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a number.`);
  }

  return value;
}

function requireBoolean(value: unknown, label: string) {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function requireStringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }

  return value.map((item) => item.trim());
}

function requireMaybeDriveItem(value: unknown, label: string) {
  if (value === null || value === undefined) {
    return null;
  }

  const record = requireRecord(value, label);

  return {
    id: requireString(record.id, `${label}.id`),
    name: requireString(record.name, `${label}.name`),
    drive_path: requireString(record.drive_path, `${label}.drive_path`),
    drive_url: requireString(record.drive_url, `${label}.drive_url`),
    mime_type: typeof record.mime_type === "string" && record.mime_type.trim().length > 0 ? record.mime_type.trim() : null,
  };
}

function requireMaybeSourceImage(value: unknown, label: string) {
  if (value === null || value === undefined) {
    return null;
  }

  const record = requireRecord(value, label);

  return {
    id: requireString(record.id, `${label}.id`),
    is_primary: typeof record.is_primary === "boolean" ? record.is_primary : false,
    status: requireString(record.status, `${label}.status`),
    source_type: requireString(record.source_type, `${label}.source_type`),
    drive_item_ref_id: requireString(record.drive_item_ref_id, `${label}.drive_item_ref_id`),
    drive_item: requireMaybeDriveItem(record.drive_item, `${label}.drive_item`),
  };
}

function requirePromptAnalysisJson(value: unknown) {
  const record = requireRecord(value, "product_analysis");
  const product = requireRecord(record.product, "product_analysis.product");
  const coverage = requireRecord(record.coverage, "product_analysis.coverage");
  const visionAnalysis = requireRecord(record.vision_analysis, "product_analysis.vision_analysis");

  return {
    mode: requireString(record.mode, "product_analysis.mode"),
    prompt_code: requireString(record.prompt_code, "product_analysis.prompt_code"),
    version: requireNumber(record.version, "product_analysis.version"),
    product: {
      id: requireString(product.id, "product_analysis.product.id"),
      product_code: requireString(product.product_code, "product_analysis.product.product_code"),
      product_name: requireString(product.product_name, "product_analysis.product.product_name"),
      niche: typeof product.niche === "string" ? product.niche.trim() : null,
      marketplace: typeof product.marketplace === "string" ? product.marketplace.trim() : null,
      marketplace_product_link:
        typeof product.marketplace_product_link === "string" ? product.marketplace_product_link.trim() : null,
      status: requireString(product.status, "product_analysis.product.status"),
    },
    source_image: requireMaybeSourceImage(record.source_image, "product_analysis.source_image"),
    coverage: {
      vision_analysis: requireNumber(coverage.vision_analysis, "product_analysis.coverage.vision_analysis"),
      prompt_clips: requireNumber(coverage.prompt_clips, "product_analysis.coverage.prompt_clips"),
    },
    vision_analysis: {
      summary: requireString(visionAnalysis.summary, "product_analysis.vision_analysis.summary"),
      hero_direction: requireString(visionAnalysis.hero_direction, "product_analysis.vision_analysis.hero_direction"),
      scene_constraints: requireStringArray(visionAnalysis.scene_constraints, "product_analysis.vision_analysis.scene_constraints"),
      risks: requireStringArray(visionAnalysis.risks, "product_analysis.vision_analysis.risks"),
    },
  } as PromptPackAnalysisJson;
}

function requirePromptContextJson(value: unknown) {
  return requireRecord(value, "prompt_context") as JsonObject;
}

function requirePromptClipKey(value: unknown, label: string) {
  const clipKey = requireString(value, label);

  if (!(PROMPT_CLIP_KEYS as readonly string[]).includes(clipKey)) {
    throw new Error(`${label} must be one of: ${PROMPT_CLIP_KEYS.join(", ")}.`);
  }

  return clipKey as PromptClipKey;
}

function requireI2IPromptJson(value: unknown, label: string, clipKey: PromptClipKey) {
  const record = requireRecord(value, label);
  const slot = requirePromptClipKey(record.slot, `${label}.slot`);

  if (slot !== clipKey) {
    throw new Error(`${label}.slot must equal ${clipKey}.`);
  }

  return {
    slot,
    first_frame: requireString(record.first_frame, `${label}.first_frame`),
    last_frame: requireString(record.last_frame, `${label}.last_frame`),
  } satisfies PromptPackI2IPromptJson;
}

function requireI2VPromptJson(value: unknown, label: string, clipKey: PromptClipKey) {
  const record = requireRecord(value, label);
  const slot = requirePromptClipKey(record.slot, `${label}.slot`);

  if (slot !== clipKey) {
    throw new Error(`${label}.slot must equal ${clipKey}.`);
  }

  return {
    slot,
    prompt: requireString(record.prompt, `${label}.prompt`),
  } satisfies PromptPackI2VPromptJson;
}

function requireI2IPromptMap(value: unknown) {
  const record = requireRecord(value, "i2i_prompts");
  requireExactKeys(record, PROMPT_CLIP_KEYS, "i2i_prompts");

  return PROMPT_CLIP_KEYS.reduce(
    (result, clipKey) => ({
      ...result,
      [clipKey]: requireI2IPromptJson(record[clipKey], `i2i_prompts.${clipKey}`, clipKey),
    }),
    {} as Record<PromptClipKey, PromptPackI2IPromptJson>,
  );
}

function requireI2VPromptMap(value: unknown) {
  const record = requireRecord(value, "i2v_prompts");
  requireExactKeys(record, PROMPT_CLIP_KEYS, "i2v_prompts");

  return PROMPT_CLIP_KEYS.reduce(
    (result, clipKey) => ({
      ...result,
      [clipKey]: requireI2VPromptJson(record[clipKey], `i2v_prompts.${clipKey}`, clipKey),
    }),
    {} as Record<PromptClipKey, PromptPackI2VPromptJson>,
  );
}

function requireLockStateJson(value: unknown, label: string) {
  const record = requireRecord(value, label);
  requireExactKeys(record, ["locked", "notes", "drive_item_ref_id"], label);

  return {
    locked: requireBoolean(record.locked, `${label}.locked`),
    notes: requireOptionalString(record.notes),
    drive_item_ref_id:
      record.drive_item_ref_id === null
        ? null
        : requireString(record.drive_item_ref_id, `${label}.drive_item_ref_id`),
  } as PromptPackLockStateJson;
}

function requireConsistencyRulesJson(value: unknown) {
  const record = requireRecord(value, "consistency_rules");

  return {
    consistency_rules: requireStringArray(record.consistency_rules, "consistency_rules.consistency_rules"),
  } as PromptPackConsistencyRulesJson;
}

function extractJsonText(rawText: string) {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error("Gemini output was empty.");
  }

  if (trimmed.startsWith("```")) {
    const firstNewLine = trimmed.indexOf("\n");
    const lastFence = trimmed.lastIndexOf("```");

    if (firstNewLine >= 0 && lastFence > firstNewLine) {
      const inner = trimmed.slice(firstNewLine + 1, lastFence).trim();

      if (inner) {
        return inner;
      }
    }
  }

  return trimmed;
}

function recoverJsonText(rawText: string) {
  const initial = extractJsonText(rawText);

  try {
    JSON.parse(initial);
    return initial;
  } catch {
    const firstBrace = initial.indexOf("{");
    const lastBrace = initial.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = initial.slice(firstBrace, lastBrace + 1).trim();

      if (sliced) {
        try {
          JSON.parse(sliced);
          return sliced;
        } catch {
          // Fall through to the sanitized error below.
        }
      }
    }
  }

  throw new Error("Gemini output did not contain valid JSON.");
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function readPromptField(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!isRecord(value)) {
    return "";
  }

  return readString(value.prompt);
}

function readLegacyPrompt(record: Record<string, unknown>, key: string) {
  return readPromptField(record[key]);
}

function readI2IClip(record: Record<string, unknown>, clipKey: PromptClipKey) {
  const current = readRecord(record[clipKey]);
  const legacyPrefix = clipKey === "clip_1" ? "clip_01" : "clip_02";

  return {
    i2i_first_frame:
      readString(current.first_frame) ||
      readString(current.i2i_first_frame) ||
      readLegacyPrompt(record, `${legacyPrefix}_start_frame`),
    i2i_last_frame:
      readString(current.last_frame) ||
      readString(current.i2i_last_frame) ||
      readLegacyPrompt(record, `${legacyPrefix}_last_frame`),
  };
}

function readI2VClip(record: Record<string, unknown>, clipKey: PromptClipKey) {
  const current = readRecord(record[clipKey]);
  const legacyKey = clipKey === "clip_1" ? "clip_01" : "clip_02";

  return readPromptField(current) || readPromptField(record[legacyKey]);
}

function readTagsFromPersonalization(record: Record<string, unknown>) {
  const direct = readString(record.tags);

  if (direct) {
    return normalizeHashtagString(direct);
  }

  if (Array.isArray(record.hashtag_rules)) {
    return normalizeHashtagString(record.hashtag_rules.filter((item): item is string => typeof item === "string").join(" "));
  }

  return "";
}

function readLockState(value: unknown) {
  if (!isRecord(value)) {
    return EMPTY_LOCK_STATE;
  }

  return {
    locked: typeof value.locked === "boolean" ? value.locked : false,
    notes: readString(value.notes),
    drive_item_ref_id: typeof value.drive_item_ref_id === "string" ? value.drive_item_ref_id : null,
  } satisfies PromptPackLockStateJson;
}

function jsonRecordOrEmpty(value: unknown): JsonObject {
  if (!isRecord(value)) {
    return {};
  }

  return value as JsonObject;
}

function toI2IStorageClip(clipKey: PromptClipKey, clip: PromptPackEditorClip) {
  return {
    slot: clipKey,
    first_frame: clip.i2i_first_frame.trim(),
    last_frame: clip.i2i_last_frame.trim(),
  } satisfies PromptPackI2IPromptJson;
}

function toI2VStorageClip(clipKey: PromptClipKey, clip: PromptPackEditorClip) {
  return {
    slot: clipKey,
    prompt: clip.i2v_prompt.trim(),
  } satisfies PromptPackI2VPromptJson;
}

export function parsePromptPackGenerationOutput(rawText: string): PromptPackGenerationOutput {
  const jsonText = recoverJsonText(rawText);
  const parsed: unknown = JSON.parse(jsonText);
  const record = requireRecord(parsed, "Gemini output");
  requireExactKeys(record, PROMPT_PACK_OUTPUT_KEYS, "Gemini output");

  const targetMarketplace = requireString(record.target_marketplace, "target_marketplace");

  if (targetMarketplace !== PROMPT_TARGET_MARKETPLACE) {
    throw new Error(`target_marketplace must equal ${PROMPT_TARGET_MARKETPLACE}.`);
  }

  return {
    product_analysis: requirePromptAnalysisJson(record.product_analysis),
    prompt_context: requirePromptContextJson(record.prompt_context),
    i2i_prompts: requireI2IPromptMap(record.i2i_prompts),
    i2v_prompts: requireI2VPromptMap(record.i2v_prompts),
    caption: requireString(record.caption, "caption"),
    tags: normalizeHashtagString(requireString(record.tags, "tags")),
    target_marketplace: PROMPT_TARGET_MARKETPLACE,
    negative_prompt_rules: requireStringArray(record.negative_prompt_rules, "negative_prompt_rules"),
    consistency_rules: requireStringArray(record.consistency_rules, "consistency_rules"),
    seed_character: requireLockStateJson(record.seed_character, "seed_character"),
    environment: requireLockStateJson(record.environment, "environment"),
  };
}

export function readPromptPackEditorPromptSet(input: {
  i2i_prompts_json?: unknown;
  i2v_prompts_json?: unknown;
  personalization_json?: unknown;
}): PromptPackEditorPromptSet {
  const i2iPrompts = readRecord(input.i2i_prompts_json);
  const i2vPrompts = readRecord(input.i2v_prompts_json);
  const personalization = readRecord(input.personalization_json);

  const clips = PROMPT_CLIP_KEYS.reduce(
    (result, clipKey) => {
      const i2iClip = readI2IClip(i2iPrompts, clipKey);

      return {
        ...result,
        [clipKey]: {
          ...i2iClip,
          i2v_prompt: readI2VClip(i2vPrompts, clipKey),
        },
      };
    },
    {} as Record<PromptClipKey, PromptPackEditorClip>,
  );

  return {
    clips,
    caption:
      readString(personalization.caption) ||
      (Array.isArray(personalization.caption_rules)
        ? personalization.caption_rules.filter((item): item is string => typeof item === "string").join("\n")
        : ""),
    tags: readTagsFromPersonalization(personalization),
    target_marketplace: PROMPT_TARGET_MARKETPLACE,
    prompt_context: isRecord(personalization.prompt_context) ? (personalization.prompt_context as JsonObject) : null,
    seed_character: readLockState(personalization.seed_character),
    environment: readLockState(personalization.environment),
  };
}

export function buildPromptPackEditorStoragePayload(
  input: Pick<PromptPackEditorPromptSet, "clips" | "caption" | "tags">,
  existingPersonalization?: unknown,
): PromptPackStoragePayload {
  const existing = jsonRecordOrEmpty(existingPersonalization);
  const i2iPrompts = PROMPT_CLIP_KEYS.reduce(
    (result, clipKey) => ({
      ...result,
      [clipKey]: toI2IStorageClip(clipKey, input.clips[clipKey]),
    }),
    {} as Record<PromptClipKey, PromptPackI2IPromptJson>,
  );
  const i2vPrompts = PROMPT_CLIP_KEYS.reduce(
    (result, clipKey) => ({
      ...result,
      [clipKey]: toI2VStorageClip(clipKey, input.clips[clipKey]),
    }),
    {} as Record<PromptClipKey, PromptPackI2VPromptJson>,
  );

  return {
    i2i_prompts_json: i2iPrompts,
    i2v_prompts_json: i2vPrompts,
    personalization_json: {
      ...existing,
      prompt_context: isRecord(existing.prompt_context) ? existing.prompt_context : null,
      caption: input.caption.trim(),
      tags: normalizeHashtagString(input.tags),
      target_marketplace: PROMPT_TARGET_MARKETPLACE,
      seed_character: isRecord(existing.seed_character) ? (existing.seed_character as JsonObject) : EMPTY_LOCK_STATE,
      environment: isRecord(existing.environment) ? (existing.environment as JsonObject) : EMPTY_LOCK_STATE,
    },
  };
}

export function buildPromptPackStoragePayload(output: PromptPackGenerationOutput): PromptPackStoragePayload {
  return {
    product_analysis_json: output.product_analysis,
    i2i_prompts_json: output.i2i_prompts,
    i2v_prompts_json: output.i2v_prompts,
    consistency_rules_json: {
      consistency_rules: output.consistency_rules,
    },
    negative_rules_json: {
      negative_prompt_rules: output.negative_prompt_rules,
    },
    personalization_json: {
      prompt_context: output.prompt_context,
      caption: output.caption,
      tags: normalizeHashtagString(output.tags),
      target_marketplace: PROMPT_TARGET_MARKETPLACE,
      seed_character: output.seed_character,
      environment: output.environment,
    },
  };
}
