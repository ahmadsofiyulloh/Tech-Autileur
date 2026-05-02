import { PROMPT_I2I_SLOT_KEYS, PROMPT_I2V_SLOT_KEYS, PROMPT_PACK_OUTPUT_KEYS } from "@/lib/prompts/validation";

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

export type PromptPackGenerationOutput = {
  product_analysis: JsonObject;
  prompt_context: JsonObject;
  i2i_prompts: Record<(typeof PROMPT_I2I_SLOT_KEYS)[number], JsonObject>;
  i2v_prompts: Record<(typeof PROMPT_I2V_SLOT_KEYS)[number], JsonObject>;
  caption_rules: string[];
  hashtag_rules: string[];
  negative_prompt_rules: string[];
  consistency_rules: string[];
  seed_character: PromptPackLockStateJson;
  environment: PromptPackLockStateJson;
};

export type PromptPackStoragePayload = {
  product_analysis_json: JsonObject;
  i2i_prompts_json: Record<(typeof PROMPT_I2I_SLOT_KEYS)[number], JsonObject>;
  i2v_prompts_json: Record<(typeof PROMPT_I2V_SLOT_KEYS)[number], JsonObject>;
  consistency_rules_json: JsonObject;
  negative_rules_json: JsonObject;
  personalization_json: JsonObject;
};

type PromptPackAnalysisJson = {
  mode: string;
  prompt_code: string;
  version: number;
  product: PromptPackProductRecord;
  source_image: PromptPackSourceImageRecord | null;
  coverage: {
    vision_analysis: number;
    i2i_prompts: number;
    i2v_prompts: number;
  };
  vision_analysis: {
    summary: string;
    hero_direction: string;
    scene_constraints: string[];
    risks: string[];
  };
};

type PromptPackPromptSlot = {
  slot: string;
  prompt: string;
};

type PromptPackI2iSlot = PromptPackPromptSlot & {
  composition: string;
};

type PromptPackI2vSlot = PromptPackPromptSlot & {
  motion_notes: string;
};

type PromptPackConsistencyRulesJson = {
  consistency_rules: string[];
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
    mime_type:
      typeof record.mime_type === "string" && record.mime_type.trim().length > 0 ? record.mime_type.trim() : null,
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
      i2i_prompts: requireNumber(coverage.i2i_prompts, "product_analysis.coverage.i2i_prompts"),
      i2v_prompts: requireNumber(coverage.i2v_prompts, "product_analysis.coverage.i2v_prompts"),
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

function requirePromptSlotJson(
  value: unknown,
  label: string,
  slotKey: string,
  extraField: "composition" | "motion_notes",
) {
  const record = requireRecord(value, label);
  const slot = requireString(record.slot, `${label}.slot`);
  const prompt = requireString(record.prompt, `${label}.prompt`);
  const extra = requireString(record[extraField], `${label}.${extraField}`);

  if (slot !== slotKey) {
    throw new Error(`${label}.slot must equal ${slotKey}.`);
  }

  return {
    slot,
    prompt,
    [extraField]: extra,
  } as PromptPackI2iSlot | PromptPackI2vSlot;
}

function requirePromptSlotMap(
  value: unknown,
  label: string,
  slotKeys: readonly string[],
  extraField: "composition" | "motion_notes",
) {
  const record = requireRecord(value, label);
  requireExactKeys(record, slotKeys, label);
  const result = {} as Record<string, JsonObject>;

  for (const slotKey of slotKeys) {
    const slotValue = record[slotKey];
    result[slotKey] = requirePromptSlotJson(slotValue, `${label}.${slotKey}`, slotKey, extraField) as JsonObject;
  }

  return result;
}

function requireLockStateJson(value: unknown, label: string) {
  const record = requireRecord(value, label);
  requireExactKeys(record, ["locked", "notes", "drive_item_ref_id"], label);

  return {
    locked: requireBoolean(record.locked, `${label}.locked`),
    notes: requireString(record.notes, `${label}.notes`),
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

function requirePromptRulesArray(value: unknown, label: string) {
  return requireStringArray(value, label);
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

export function parsePromptPackGenerationOutput(rawText: string): PromptPackGenerationOutput {
  const jsonText = recoverJsonText(rawText);
  const parsed: unknown = JSON.parse(jsonText);
  const record = requireRecord(parsed, "Gemini output");
  requireExactKeys(record, PROMPT_PACK_OUTPUT_KEYS, "Gemini output");

  return {
    product_analysis: requirePromptAnalysisJson(record.product_analysis),
    prompt_context: requirePromptContextJson(record.prompt_context),
    i2i_prompts: requirePromptSlotMap(record.i2i_prompts, "i2i_prompts", PROMPT_I2I_SLOT_KEYS, "composition") as PromptPackGenerationOutput["i2i_prompts"],
    i2v_prompts: requirePromptSlotMap(record.i2v_prompts, "i2v_prompts", PROMPT_I2V_SLOT_KEYS, "motion_notes") as PromptPackGenerationOutput["i2v_prompts"],
    caption_rules: requirePromptRulesArray(record.caption_rules, "caption_rules"),
    hashtag_rules: requirePromptRulesArray(record.hashtag_rules, "hashtag_rules"),
    negative_prompt_rules: requirePromptRulesArray(record.negative_prompt_rules, "negative_prompt_rules"),
    consistency_rules: requirePromptRulesArray(record.consistency_rules, "consistency_rules"),
    seed_character: requireLockStateJson(record.seed_character, "seed_character"),
    environment: requireLockStateJson(record.environment, "environment"),
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
      caption_rules: output.caption_rules,
      hashtag_rules: output.hashtag_rules,
      seed_character: output.seed_character,
      environment: output.environment,
    },
  };
}
