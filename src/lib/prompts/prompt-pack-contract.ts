import { PROMPT_I2I_SLOT_KEYS, PROMPT_I2V_SLOT_KEYS } from "@/lib/prompts/validation";

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

export type PromptPackGenerationOutput = {
  product_analysis_json: JsonObject;
  i2i_prompts_json: Record<(typeof PROMPT_I2I_SLOT_KEYS)[number], JsonObject>;
  i2v_prompts_json: Record<(typeof PROMPT_I2V_SLOT_KEYS)[number], JsonObject>;
  consistency_rules_json: JsonObject;
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
  mode: string;
  prompt_code: string;
  version: number;
  product_name: string;
  rules: string[];
  notes?: string[];
};

export type PromptPackGenerationContract = {
  product_analysis_json: PromptPackAnalysisJson;
  i2i_prompts_json: Record<(typeof PROMPT_I2I_SLOT_KEYS)[number], PromptPackI2iSlot>;
  i2v_prompts_json: Record<(typeof PROMPT_I2V_SLOT_KEYS)[number], PromptPackI2vSlot>;
  consistency_rules_json: PromptPackConsistencyRulesJson;
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
  const record = requireRecord(value, "product_analysis_json");
  const product = requireRecord(record.product, "product_analysis_json.product");
  const coverage = requireRecord(record.coverage, "product_analysis_json.coverage");
  const visionAnalysis = requireRecord(record.vision_analysis, "product_analysis_json.vision_analysis");

  return {
    mode: requireString(record.mode, "product_analysis_json.mode"),
    prompt_code: requireString(record.prompt_code, "product_analysis_json.prompt_code"),
    version: requireNumber(record.version, "product_analysis_json.version"),
    product: {
      id: requireString(product.id, "product_analysis_json.product.id"),
      product_code: requireString(product.product_code, "product_analysis_json.product.product_code"),
      product_name: requireString(product.product_name, "product_analysis_json.product.product_name"),
      niche: typeof product.niche === "string" ? product.niche.trim() : null,
      marketplace: typeof product.marketplace === "string" ? product.marketplace.trim() : null,
      marketplace_product_link:
        typeof product.marketplace_product_link === "string" ? product.marketplace_product_link.trim() : null,
      status: requireString(product.status, "product_analysis_json.product.status"),
    },
    source_image: requireMaybeSourceImage(record.source_image, "product_analysis_json.source_image"),
    coverage: {
      vision_analysis: requireNumber(coverage.vision_analysis, "product_analysis_json.coverage.vision_analysis"),
      i2i_prompts: requireNumber(coverage.i2i_prompts, "product_analysis_json.coverage.i2i_prompts"),
      i2v_prompts: requireNumber(coverage.i2v_prompts, "product_analysis_json.coverage.i2v_prompts"),
    },
    vision_analysis: {
      summary: requireString(visionAnalysis.summary, "product_analysis_json.vision_analysis.summary"),
      hero_direction: requireString(visionAnalysis.hero_direction, "product_analysis_json.vision_analysis.hero_direction"),
      scene_constraints: requireStringArray(visionAnalysis.scene_constraints, "product_analysis_json.vision_analysis.scene_constraints"),
      risks: requireStringArray(visionAnalysis.risks, "product_analysis_json.vision_analysis.risks"),
    },
  } as PromptPackAnalysisJson;
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

function requirePromptSlotMap(value: unknown, label: string, slotKeys: readonly string[], extraField: "composition" | "motion_notes") {
  const record = requireRecord(value, label);
  const result = {} as Record<string, JsonObject>;

  for (const slotKey of slotKeys) {
    const slotValue = record[slotKey];
    result[slotKey] = requirePromptSlotJson(slotValue, `${label}.${slotKey}`, slotKey, extraField) as JsonObject;
  }

  return result;
}

function requireConsistencyRulesJson(value: unknown) {
  const record = requireRecord(value, "consistency_rules_json");

  return {
    mode: requireString(record.mode, "consistency_rules_json.mode"),
    prompt_code: requireString(record.prompt_code, "consistency_rules_json.prompt_code"),
    version: requireNumber(record.version, "consistency_rules_json.version"),
    product_name: requireString(record.product_name, "consistency_rules_json.product_name"),
    rules: requireStringArray(record.rules, "consistency_rules_json.rules"),
    ...(record.notes !== undefined
      ? { notes: requireStringArray(record.notes, "consistency_rules_json.notes") }
      : {}),
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

export function parsePromptPackGenerationOutput(rawText: string): PromptPackGenerationContract {
  const jsonText = recoverJsonText(rawText);
  const parsed: unknown = JSON.parse(jsonText);
  const record = requireRecord(parsed, "Gemini output");

  return {
    product_analysis_json: requirePromptAnalysisJson(record.product_analysis_json),
    i2i_prompts_json: requirePromptSlotMap(
      record.i2i_prompts_json,
      "i2i_prompts_json",
      PROMPT_I2I_SLOT_KEYS,
      "composition",
    ) as PromptPackGenerationContract["i2i_prompts_json"],
    i2v_prompts_json: requirePromptSlotMap(
      record.i2v_prompts_json,
      "i2v_prompts_json",
      PROMPT_I2V_SLOT_KEYS,
      "motion_notes",
    ) as PromptPackGenerationContract["i2v_prompts_json"],
    consistency_rules_json: requireConsistencyRulesJson(record.consistency_rules_json),
  };
}
