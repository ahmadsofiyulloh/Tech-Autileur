import { recoverJsonText } from "@/lib/json/recover-json";
import {
  PROMPT_CLIP_KEYS,
  PROMPT_PACK_COMPACT_OUTPUT_KEYS,
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

type PromptPackSourceImageRecord = {
  id: string;
  is_primary: boolean;
  status: string;
  source_type: string;
  drive_item_ref_id: string;
  analysis_json: JsonObject | null;
};

type PromptPackLockStateJson = {
  locked: boolean;
  notes: string;
  drive_item_ref_id: string | null;
};

export type PromptPackVisualReferenceKind = "CHARACTER" | "ENVIRONMENT" | "PRODUCT";

export type PromptPackVisualReferenceRole = "primary_subject" | "supporting_reference" | "background_anchor";

export type PromptPackVisualReferenceJson = {
  kind: PromptPackVisualReferenceKind;
  label: string;
  mention: string;
  role: PromptPackVisualReferenceRole;
  summary: string;
  must_keep: string[];
  must_avoid: string[];
  instruction: string;
  drive_item_ref_id: string | null;
  drive_url: string | null;
  drive_path: string | null;
  analysis_json: JsonObject | null;
};

export type PromptPackPromptRulesJson = {
  i2i_prompt_rules: string[];
  i2v_prompt_rules: string[];
  caption_rules: string[];
  hashtag_rules: string[];
  negative_prompt_rules: string[];
  product_positioning_notes: string[];
};

export type PromptPackI2IFramePromptJson = {
  slot: PromptClipKey;
  frame: "first_frame" | "last_frame";
  prompt_text: string;
  visual_references: PromptPackVisualReferenceJson[];
  prompt_rules: PromptPackPromptRulesJson;
};

export type PromptPackI2IClipJson = {
  slot: PromptClipKey;
  first_frame: PromptPackI2IFramePromptJson;
  last_frame: PromptPackI2IFramePromptJson;
};

export type PromptPackI2VPromptJson = {
  slot: PromptClipKey;
  prompt_text: string;
  visual_references: PromptPackVisualReferenceJson[];
  prompt_rules: PromptPackPromptRulesJson;
  continuity: {
    first_frame_hint: string;
    last_frame_hint: string;
  };
};

export type PromptPackGenerationOutput = {
  product_analysis: JsonObject;
  prompt_context: JsonObject;
  i2i_prompts: Record<PromptClipKey, PromptPackI2IClipJson>;
  i2v_prompts: Record<PromptClipKey, PromptPackI2VPromptJson>;
  caption: string;
  tags: string;
  target_marketplace: typeof PROMPT_TARGET_MARKETPLACE;
  negative_prompt_rules: string[];
  consistency_rules: string[];
  seed_character: PromptPackLockStateJson;
  environment: PromptPackLockStateJson;
};

type PromptPackCompactFramePromptJson = {
  slot: PromptClipKey;
  frame: "first_frame" | "last_frame";
  prompt_text: string;
};

type PromptPackCompactI2IClipJson = {
  slot: PromptClipKey;
  first_frame: PromptPackCompactFramePromptJson;
  last_frame: PromptPackCompactFramePromptJson;
};

type PromptPackCompactI2VPromptJson = {
  slot: PromptClipKey;
  prompt_text: string;
  continuity: {
    first_frame_hint: string;
    last_frame_hint: string;
  };
};

type PromptPackCompactGenerationOutput = {
  product_analysis: JsonObject;
  i2i_prompts: Record<PromptClipKey, PromptPackCompactI2IClipJson>;
  i2v_prompts: Record<PromptClipKey, PromptPackCompactI2VPromptJson>;
  caption: string;
  tags: string;
  negative_prompt_rules: string[];
  consistency_rules: string[];
};

export type PromptPackStoragePayload = {
  product_analysis_json?: JsonObject | null;
  i2i_prompts_json: Record<PromptClipKey, PromptPackI2IClipJson>;
  i2v_prompts_json: Record<PromptClipKey, PromptPackI2VPromptJson>;
  consistency_rules_json?: JsonObject | null;
  negative_rules_json?: JsonObject | null;
  personalization_json: JsonObject;
};

export type PromptPackEditorClip = {
  i2i_first_frame_json: PromptPackI2IFramePromptJson;
  i2i_last_frame_json: PromptPackI2IFramePromptJson;
  i2v_prompt_json: PromptPackI2VPromptJson;
  i2i_first_frame: string;
  i2i_last_frame: string;
  i2v_prompt: string;
};

type PromptPackEditorClipInput = {
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

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]) {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && expectedKeys.every((key) => key in value);
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

function resolveBooleanWithFallback(value: unknown, label: string, fallbackValue?: boolean | null) {
  const fallback = typeof fallbackValue === "boolean" ? fallbackValue : null;

  if (typeof value === "boolean") {
    if (fallback !== null && value !== fallback) {
      throw new Error(`${label} must match the source image flag (${fallback}).`);
    }

    return value;
  }

  throw new Error(`${label} must be a boolean.`);
}

const PROMPT_RULE_TEXT_KEYS = [
  "i2i_prompt_rules",
  "i2v_prompt_rules",
  "caption_rules",
  "hashtag_rules",
  "negative_prompt_rules",
  "product_positioning_notes",
  "must_keep",
  "must_avoid",
] as const;

const PROMPT_REFERENCE_TEXT_KEYS = [
  "mention",
  "summary",
  "instruction",
  "prompt_text",
  "text",
  "value",
  "label",
  "name",
  "subject",
  "hero_direction",
  "use_case",
  "pain_point",
  "selling_angle",
  "target_viewer",
  "drive_item_name",
] as const;

function compactText(value: unknown, maxLength = 220) {
  if (typeof value !== "string") {
    return "";
  }

  const compacted = value.replace(/\s+/g, " ").trim();

  if (!compacted) {
    return "";
  }

  return compacted.length > maxLength ? `${compacted.slice(0, Math.max(maxLength - 3, 0)).trimEnd()}...` : compacted;
}

function readJsonLikeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    const flattened: string[] = value.flatMap((item) => readJsonLikeStringArray(item));
    const joined = flattened.join("\n").trim();

    if (
      joined &&
      ((joined.startsWith("{") && joined.endsWith("}")) || (joined.startsWith("[") && joined.endsWith("]")))
    ) {
      try {
        return readJsonLikeStringArray(JSON.parse(joined));
      } catch {
        // Fall through to the flattened strings below.
      }
    }

    return flattened.filter((item: string, index: number, items: string[]) => items.indexOf(item) === index);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        return readJsonLikeStringArray(JSON.parse(trimmed));
      } catch {
        // Fall through to line splitting.
      }
    }

    return trimmed
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  if (!isRecord(value)) {
    return [];
  }

  const collected: string[] = [...PROMPT_RULE_TEXT_KEYS, ...PROMPT_REFERENCE_TEXT_KEYS].flatMap((key) =>
    readJsonLikeStringArray(value[key]),
  );

  return collected.filter((item: string, index: number, items: string[]) => items.indexOf(item) === index);
}

function normalizePromptReferenceRole(kind: PromptPackVisualReferenceKind): PromptPackVisualReferenceRole {
  if (kind === "PRODUCT") {
    return "primary_subject";
  }

  if (kind === "ENVIRONMENT") {
    return "background_anchor";
  }

  return "supporting_reference";
}

function normalizePromptReferenceMention(value: unknown, fallbackLabel: string) {
  const text = compactText(value, 160);

  if (!text) {
    return `@${fallbackLabel}`;
  }

  return text.startsWith("@") ? text : `@${text}`;
}

function readPromptReferenceName(record: Record<string, unknown> | null | undefined, fallbackLabel: string) {
  if (!record) {
    return fallbackLabel;
  }

  const mention = compactText(record.mention, 160);

  if (mention) {
    return mention.startsWith("@") ? mention : `@${mention}`;
  }

  const driveItemName = compactText(record.drive_item_name, 160);

  if (driveItemName) {
    return `@${driveItemName}`;
  }

  const nestedDriveItem = isRecord(record.drive_item) ? (record.drive_item as Record<string, unknown>) : null;
  const nestedDriveItemName = compactText(nestedDriveItem?.name, 160);

  if (nestedDriveItemName) {
    return `@${nestedDriveItemName}`;
  }

  const label = compactText(record.label, 160) || fallbackLabel;
  return label.startsWith("@") ? label : `@${label}`;
}

function readPromptReferenceSummary(
  record: Record<string, unknown> | null | undefined,
  fallbackValue: string,
  extraValues: Array<string | null | undefined> = [],
) {
  const summaryCandidates = [
    readStringFromRecord(record, "summary"),
    readStringFromRecord(record, "prompt_text"),
    readStringFromRecord(record, "text"),
    readStringFromRecord(record, "value"),
    readStringFromRecord(record, "subject"),
  ];

  if (isRecord(record?.analysis)) {
    summaryCandidates.push(readStringFromRecord(record.analysis as Record<string, unknown>, "summary"));
    summaryCandidates.push(readStringFromRecord(record.analysis as Record<string, unknown>, "subject"));
  }

  if (isRecord(record?.vision_analysis)) {
    summaryCandidates.push(readStringFromRecord(record.vision_analysis as Record<string, unknown>, "summary"));
    summaryCandidates.push(readStringFromRecord(record.vision_analysis as Record<string, unknown>, "hero_direction"));
  }

  if (isRecord(record?.analysis_json)) {
    const analysisJson = record.analysis_json as Record<string, unknown>;
    if (isRecord(analysisJson.analysis)) {
      summaryCandidates.push(readStringFromRecord(analysisJson.analysis as Record<string, unknown>, "summary"));
      summaryCandidates.push(readStringFromRecord(analysisJson.analysis as Record<string, unknown>, "subject"));
    }
    summaryCandidates.push(readStringFromRecord(analysisJson, "summary"));
    summaryCandidates.push(readStringFromRecord(analysisJson, "drive_item_name"));
  }

  summaryCandidates.push(...extraValues.filter((item): item is string => typeof item === "string" && item.length > 0));

  return compactText(summaryCandidates.find((item) => compactText(item)) || fallbackValue);
}

function readPromptReferenceRuleLines(record: Record<string, unknown> | null | undefined, key: "must_keep" | "must_avoid") {
  if (!record) {
    return [];
  }

  const promptRules = isRecord(record.prompt_rules) ? (record.prompt_rules as Record<string, unknown>) : null;
  return readJsonLikeStringArray(promptRules?.[key]).slice(0, 6);
}

function readPromptReferenceInstruction(input: {
  mention: string;
  kind: PromptPackVisualReferenceKind;
  role: PromptPackVisualReferenceRole;
  summary: string;
  mustKeep: string[];
  mustAvoid: string[];
}) {
  const subjectPhrase =
    input.role === "primary_subject"
      ? "primary subject"
      : input.role === "background_anchor"
        ? "background anchor"
        : "supporting reference";
  const keepText = input.mustKeep.length ? `Keep ${input.mustKeep.slice(0, 3).join(", ")}.` : "";
  const avoidText = input.mustAvoid.length ? `Avoid ${input.mustAvoid.slice(0, 3).join(", ")}.` : "";
  const summaryText = input.summary ? `${input.summary}.` : "";

  return compactText(
    [
      `Use ${input.mention} as the ${subjectPhrase} for ${input.kind.toLowerCase()}-driven image-to-image generation.`,
      summaryText,
      keepText,
      avoidText,
    ]
      .filter((item) => item.length > 0)
      .join(" "),
    260,
  );
}

function requireStringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }

  return value.map((item) => item.trim());
}

function readLegacyStringArray(value: unknown) {
  return readJsonLikeStringArray(value);
}

function readLegacyStringArrayFromRecord(record: Record<string, unknown> | null | undefined, key: string) {
  return readLegacyStringArray(record?.[key]);
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

function resolveStringWithFallback(value: unknown, label: string, fallbackValue?: string | null) {
  const actual = requireOptionalString(value);
  const fallback = requireOptionalString(fallbackValue);

  if (!actual) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  if (fallback && actual !== fallback) {
    throw new Error(`${label} must match the source image value (${fallback}).`);
  }

  return actual;
}

function requireMaybeSourceImage(
  value: unknown,
  label: string,
  fallbackValue?: PromptPackSourceImageRecord | null,
) {
  if (value === null || value === undefined) {
    if (fallbackValue) {
      throw new Error(`${label} must echo the selected source image.`);
    }

    return null;
  }

  const record = requireRecord(value, label);
  const fallback = fallbackValue ?? null;

  return {
    id: resolveStringWithFallback(record.id, `${label}.id`, fallback?.id),
    is_primary: resolveBooleanWithFallback(record.is_primary, `${label}.is_primary`, fallback?.is_primary),
    status: resolveStringWithFallback(record.status, `${label}.status`, fallback?.status),
    source_type: resolveStringWithFallback(record.source_type, `${label}.source_type`, fallback?.source_type),
    drive_item_ref_id: resolveStringWithFallback(
      record.drive_item_ref_id,
      `${label}.drive_item_ref_id`,
      fallback?.drive_item_ref_id,
    ),
    analysis_json: readJsonObject(record.analysis_json) ?? fallback?.analysis_json ?? null,
  };
}

function resolveProductStatus(value: unknown, label: string, fallbackValue?: string | null) {
  const status = requireOptionalString(value);
  const fallbackStatus = requireOptionalString(fallbackValue);

  if (!status) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  if (fallbackStatus && status !== fallbackStatus) {
    throw new Error(`${label} must match the source product status (${fallbackStatus}).`);
  }

  return status;
}

function requirePromptAnalysisJson(
  value: unknown,
  fallbackProductStatus?: string | null,
  fallbackSourceImage?: PromptPackSourceImageRecord | null,
) {
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
      status: resolveProductStatus(product.status, "product_analysis.product.status", fallbackProductStatus),
    },
    source_image: requireMaybeSourceImage(record.source_image, "product_analysis.source_image", fallbackSourceImage),
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

function readJsonObject(value: unknown) {
  return isRecord(value) ? (value as JsonObject) : null;
}

function readStringFromRecord(record: Record<string, unknown> | null | undefined, key: string) {
  if (!record) {
    return "";
  }

  return readOptionalString(record[key]);
}

function buildPromptRulesFromContext(context: JsonObject | null) {
  const affiliateProfile = isRecord(context?.affiliate_profile) ? (context.affiliate_profile as Record<string, unknown>) : null;
  const rules = isRecord(affiliateProfile?.rules) ? (affiliateProfile?.rules as Record<string, unknown>) : null;

  return {
    i2i_prompt_rules: readLegacyStringArrayFromRecord(rules, "i2i_prompt_rules"),
    i2v_prompt_rules: readLegacyStringArrayFromRecord(rules, "i2v_prompt_rules"),
    caption_rules: readLegacyStringArrayFromRecord(rules, "caption_rules"),
    hashtag_rules: readLegacyStringArrayFromRecord(rules, "hashtag_rules"),
    negative_prompt_rules: readLegacyStringArrayFromRecord(rules, "negative_prompt_rules"),
    product_positioning_notes: readLegacyStringArrayFromRecord(rules, "product_positioning_notes"),
  } satisfies PromptPackPromptRulesJson;
}

function buildFallbackPromptText(input: {
  kind: "I2I" | "I2V";
  clipKey: PromptClipKey;
  frame?: "first_frame" | "last_frame";
  productName: string;
  promptCode: string;
  version: number;
  visualReferences: PromptPackVisualReferenceJson[];
  rules: PromptPackPromptRulesJson;
  continuity?: { first_frame_hint: string; last_frame_hint: string };
}) {
  const referenceLabel = input.visualReferences
    .map((reference) => reference.instruction || `${reference.mention} (${reference.role})`)
    .filter((item) => item.length > 0)
    .join(" ");
  const ruleCount =
    input.kind === "I2I"
      ? input.rules.i2i_prompt_rules.length
      : input.rules.i2v_prompt_rules.length;
  const ruleLabel = ruleCount ? `${ruleCount} rules` : "no account rules";

  if (input.kind === "I2I") {
    return compactText(
      `${input.productName} ${input.promptCode} v${input.version} ${input.frame ?? "first_frame"}. ${referenceLabel} Follow ${ruleLabel}.`,
      360,
    );
  }

  return compactText(
    `${input.productName} ${input.promptCode} v${input.version}. ${referenceLabel} Keep continuity ${input.continuity?.first_frame_hint || "first frame"} -> ${input.continuity?.last_frame_hint || "last frame"} with ${ruleLabel}.`,
    360,
  );
}

function buildPromptFramePromptJson(input: {
  clipKey: PromptClipKey;
  frame: "first_frame" | "last_frame";
  promptText?: string | null;
  visualReferences: PromptPackVisualReferenceJson[];
  rules: PromptPackPromptRulesJson;
  productName: string;
  promptCode: string;
  version: number;
}) {
  return {
    slot: input.clipKey,
    frame: input.frame,
    prompt_text: readString(input.promptText) || buildFallbackPromptText({
      kind: "I2I",
      clipKey: input.clipKey,
      frame: input.frame,
      productName: input.productName,
      promptCode: input.promptCode,
      version: input.version,
      visualReferences: input.visualReferences,
      rules: input.rules,
    }),
    visual_references: input.visualReferences,
    prompt_rules: input.rules,
  } satisfies PromptPackI2IFramePromptJson;
}

function buildPromptI2VPromptJson(input: {
  clipKey: PromptClipKey;
  promptText?: string | null;
  visualReferences: PromptPackVisualReferenceJson[];
  rules: PromptPackPromptRulesJson;
  productName: string;
  promptCode: string;
  version: number;
  continuity?: { first_frame_hint: string; last_frame_hint: string };
}) {
  return {
    slot: input.clipKey,
    prompt_text: readString(input.promptText) || buildFallbackPromptText({
      kind: "I2V",
      clipKey: input.clipKey,
      productName: input.productName,
      promptCode: input.promptCode,
      version: input.version,
      visualReferences: input.visualReferences,
      rules: input.rules,
      continuity: input.continuity,
    }),
    visual_references: input.visualReferences,
    prompt_rules: input.rules,
    continuity: input.continuity ?? { first_frame_hint: "", last_frame_hint: "" },
  } satisfies PromptPackI2VPromptJson;
}

function requirePromptClipKey(value: unknown, label: string) {
  const clipKey = requireString(value, label);

  if (!(PROMPT_CLIP_KEYS as readonly string[]).includes(clipKey)) {
    throw new Error(`${label} must be one of: ${PROMPT_CLIP_KEYS.join(", ")}.`);
  }

  return clipKey as PromptClipKey;
}

const PROMPT_VISUAL_REFERENCE_ORDER: PromptPackVisualReferenceKind[] = ["CHARACTER", "ENVIRONMENT", "PRODUCT"];

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function parseRecordValue(value: unknown) {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseRequiredPromptRecord(value: unknown, label: string) {
  const record = parseRecordValue(value);

  if (!record) {
    throw new Error(`${label} must be valid copy prompt JSON.`);
  }

  return record;
}

function stringifyPromptJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function readPromptField(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!isRecord(value)) {
    return "";
  }

  return readString(value.prompt_text) || readString(value.prompt) || readString(value.text);
}

function readPromptRulesSnapshot(record: Record<string, unknown> | null | undefined): PromptPackPromptRulesJson {
  const rules = isRecord(record?.prompt_rules)
    ? (record?.prompt_rules as Record<string, unknown>)
    : isRecord(record?.rules)
      ? (record?.rules as Record<string, unknown>)
      : record;

  return {
    i2i_prompt_rules: readLegacyStringArrayFromRecord(rules, "i2i_prompt_rules"),
    i2v_prompt_rules: readLegacyStringArrayFromRecord(rules, "i2v_prompt_rules"),
    caption_rules: readLegacyStringArrayFromRecord(rules, "caption_rules"),
    hashtag_rules: readLegacyStringArrayFromRecord(rules, "hashtag_rules"),
    negative_prompt_rules: readLegacyStringArrayFromRecord(rules, "negative_prompt_rules"),
    product_positioning_notes: readLegacyStringArrayFromRecord(rules, "product_positioning_notes"),
  };
}

function readPromptRulesFromPersonalization(record: Record<string, unknown> | null | undefined) {
  const context = isRecord(record?.prompt_context) ? (record?.prompt_context as JsonObject) : null;

  if (context) {
    return buildPromptRulesFromContext(context);
  }

  return readPromptRulesSnapshot(record);
}

function buildPromptReferenceCard(input: {
  kind: PromptPackVisualReferenceKind;
  label: string;
  mention: string;
  role?: PromptPackVisualReferenceRole;
  summary?: string;
  mustKeep?: string[];
  mustAvoid?: string[];
  instruction?: string;
  driveItemRefId?: string | null;
  driveUrl?: string | null;
  drivePath?: string | null;
  analysisJson?: JsonObject | null;
}) {
  const role = input.role ?? normalizePromptReferenceRole(input.kind);
  const summary = compactText(input.summary, 260) || compactText(input.label, 260) || input.kind;
  const mustKeep = (input.mustKeep ?? []).map((item) => compactText(item, 160)).filter((item) => item.length > 0).slice(0, 6);
  const mustAvoid = (input.mustAvoid ?? []).map((item) => compactText(item, 160)).filter((item) => item.length > 0).slice(0, 6);
  const instruction =
    compactText(input.instruction, 260) ||
    readPromptReferenceInstruction({
      mention: input.mention,
      kind: input.kind,
      role,
      summary,
      mustKeep,
      mustAvoid,
    });

  return {
    kind: input.kind,
    label: compactText(input.label, 120) || input.kind,
    mention: normalizePromptReferenceMention(input.mention, input.label || input.kind.toLowerCase()),
    role,
    summary,
    must_keep: mustKeep,
    must_avoid: mustAvoid,
    instruction,
    drive_item_ref_id: input.driveItemRefId ?? null,
    drive_url: input.driveUrl ?? null,
    drive_path: input.drivePath ?? null,
    analysis_json: input.analysisJson ?? null,
  } satisfies PromptPackVisualReferenceJson;
}

function readPromptReferenceCardSnapshot(
  value: unknown,
  fallback: PromptPackVisualReferenceJson,
): PromptPackVisualReferenceJson {
  const record = readJsonObject(value) ?? {};
  const cardRecord = record as Record<string, unknown>;
  const mustKeep = readJsonLikeStringArray(cardRecord.must_keep).slice(0, 6);
  const mustAvoid = readJsonLikeStringArray(cardRecord.must_avoid).slice(0, 6);

  return buildPromptReferenceCard({
    kind:
      typeof cardRecord.kind === "string" && isPromptVisualReferenceKind(cardRecord.kind)
        ? cardRecord.kind
        : fallback.kind,
    label: compactText(cardRecord.label, 120) || fallback.label,
    mention: compactText(cardRecord.mention, 160) || fallback.mention,
    role:
      typeof cardRecord.role === "string" &&
      ["primary_subject", "supporting_reference", "background_anchor"].includes(cardRecord.role)
        ? (cardRecord.role as PromptPackVisualReferenceRole)
        : fallback.role,
    summary: compactText(cardRecord.summary, 260) || fallback.summary,
    mustKeep: mustKeep.length ? mustKeep : fallback.must_keep,
    mustAvoid: mustAvoid.length ? mustAvoid : fallback.must_avoid,
    instruction: compactText(cardRecord.instruction, 260) || fallback.instruction,
    driveItemRefId:
      typeof cardRecord.drive_item_ref_id === "string" && cardRecord.drive_item_ref_id.trim().length > 0
        ? cardRecord.drive_item_ref_id.trim()
        : fallback.drive_item_ref_id,
    driveUrl: readStringFromRecord(cardRecord, "drive_url") || fallback.drive_url,
    drivePath: readStringFromRecord(cardRecord, "drive_path") || fallback.drive_path,
    analysisJson: readJsonObject(cardRecord.analysis_json) ?? fallback.analysis_json,
  });
}

function buildPromptReferenceCardsFromRawContext(context: JsonObject | null) {
  const affiliateProfile = isRecord(context?.affiliate_profile) ? (context.affiliate_profile as Record<string, unknown>) : null;
  const seedCharacter = isRecord(affiliateProfile?.seed_character) ? (affiliateProfile.seed_character as Record<string, unknown>) : null;
  const environment = isRecord(affiliateProfile?.environment) ? (affiliateProfile.environment as Record<string, unknown>) : null;
  const sourceImage = isRecord(context?.source_image) ? (context.source_image as Record<string, unknown>) : null;
  const reviewedPromptEssentials = isRecord(context?.reviewed_gemini_metadata)
    ? (context.reviewed_gemini_metadata as Record<string, unknown>)
    : null;
  const product = isRecord(context?.product) ? (context.product as Record<string, unknown>) : null;
  const seedCharacterAnalysis = isRecord(seedCharacter?.analysis_json) ? (seedCharacter.analysis_json as Record<string, unknown>) : null;
  const environmentAnalysis = isRecord(environment?.analysis_json) ? (environment.analysis_json as Record<string, unknown>) : null;

  const characterMention = readPromptReferenceName(seedCharacter, "character");
  const environmentMention = readPromptReferenceName(environment, "environment");
  const sourceImageMention = readPromptReferenceName(sourceImage, "product");
  const productSummary =
    readStringFromRecord(reviewedPromptEssentials, "deskripsi_visual") ||
    readStringFromRecord(reviewedPromptEssentials, "nama_produk") ||
    readStringFromRecord(product, "product_name") ||
    "Product reference";
  const productMustKeep = [
    readStringFromRecord(reviewedPromptEssentials, "nama_produk") || readStringFromRecord(product, "product_name"),
    readStringFromRecord(reviewedPromptEssentials, "keyword_cari_etalase"),
    readStringFromRecord(reviewedPromptEssentials, "deskripsi_visual"),
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  return [
    buildPromptReferenceCard({
      kind: "CHARACTER",
      label: "Character",
      mention: characterMention,
      role: "supporting_reference",
      summary:
        readPromptReferenceSummary(seedCharacterAnalysis, "Character reference", [
          readStringFromRecord(seedCharacterAnalysis, "summary"),
          readStringFromRecord(seedCharacterAnalysis, "subject"),
          readStringFromRecord(seedCharacter, "notes"),
        ]) || "Character reference",
      mustKeep: readPromptReferenceRuleLines(seedCharacter, "must_keep"),
      mustAvoid: readPromptReferenceRuleLines(seedCharacter, "must_avoid"),
      driveItemRefId: readStringFromRecord(seedCharacter, "drive_item_ref_id") || null,
      driveUrl: null,
      drivePath: null,
      analysisJson: null,
    }),
    buildPromptReferenceCard({
      kind: "ENVIRONMENT",
      label: "Environment",
      mention: environmentMention,
      role: "background_anchor",
      summary:
        readPromptReferenceSummary(environmentAnalysis, "Environment reference", [
          readStringFromRecord(environmentAnalysis, "summary"),
          readStringFromRecord(environmentAnalysis, "subject"),
          readStringFromRecord(environment, "notes"),
        ]) || "Environment reference",
      mustKeep: readPromptReferenceRuleLines(environment, "must_keep"),
      mustAvoid: readPromptReferenceRuleLines(environment, "must_avoid"),
      driveItemRefId: readStringFromRecord(environment, "drive_item_ref_id") || null,
      driveUrl: null,
      drivePath: null,
      analysisJson: null,
    }),
    buildPromptReferenceCard({
      kind: "PRODUCT",
      label: "Product",
      mention: sourceImageMention,
      role: "primary_subject",
      summary: productSummary,
      mustKeep: productMustKeep.slice(0, 6),
      mustAvoid: readPromptReferenceRuleLines(sourceImage, "must_avoid"),
      instruction: readPromptReferenceInstruction({
        mention: sourceImageMention,
        kind: "PRODUCT",
        role: "primary_subject",
        summary: productSummary,
        mustKeep: productMustKeep.slice(0, 3),
        mustAvoid: readPromptReferenceRuleLines(sourceImage, "must_avoid"),
      }),
      driveItemRefId: readStringFromRecord(sourceImage, "drive_item_ref_id") || null,
      driveUrl: null,
      drivePath: null,
      analysisJson: null,
    }),
  ] satisfies PromptPackVisualReferenceJson[];
}

export function buildPromptReferenceCardsFromContext(context: JsonObject | null) {
  const fallbackCards = buildPromptReferenceCardsFromRawContext(context);
  const explicitCards = Array.isArray(context?.reference_cards) ? (context.reference_cards as unknown[]) : null;

  if (!explicitCards) {
    return fallbackCards;
  }

  return PROMPT_VISUAL_REFERENCE_ORDER.map((kind, index) =>
    readPromptReferenceCardSnapshot(
      explicitCards[index],
      fallbackCards[index] ?? fallbackCards.find((item) => item.kind === kind) ?? fallbackCards[0],
    ),
  );
}

function isPromptVisualReferenceKind(value: string): value is PromptPackVisualReferenceKind {
  return (PROMPT_VISUAL_REFERENCE_ORDER as readonly string[]).includes(value);
}

function readPromptVisualReferencesFromContext(context: JsonObject | null) {
  return buildPromptReferenceCardsFromContext(context);
}

function readPromptVisualReferencesSnapshot(
  value: unknown,
  fallback: PromptPackVisualReferenceJson[],
): PromptPackVisualReferenceJson[] {
  if (Array.isArray(value) && value.length) {
    return PROMPT_VISUAL_REFERENCE_ORDER.map((kind, index) => {
      const nextValue = value[index];
      const record = isRecord(nextValue) ? nextValue : {};
      const fallbackCard =
        fallback[index] ??
        buildPromptReferenceCard({
          kind,
          label: kind.charAt(0) + kind.slice(1).toLowerCase(),
          mention: `@${kind.charAt(0) + kind.slice(1).toLowerCase()}`,
          role: normalizePromptReferenceRole(kind),
          summary: kind.charAt(0) + kind.slice(1).toLowerCase(),
          mustKeep: [],
          mustAvoid: [],
          instruction: "",
          driveItemRefId: null,
          driveUrl: null,
          drivePath: null,
          analysisJson: null,
        });

      return readPromptReferenceCardSnapshot(record, fallbackCard);
    });
  }

  return fallback;
}

function readPromptRulesSnapshotFromValue(value: unknown, fallback: PromptPackPromptRulesJson) {
  if (!isRecord(value)) {
    return fallback;
  }

  const rules = isRecord(value.prompt_rules) ? (value.prompt_rules as Record<string, unknown>) : value;

  return {
    i2i_prompt_rules: readLegacyStringArrayFromRecord(rules, "i2i_prompt_rules"),
    i2v_prompt_rules: readLegacyStringArrayFromRecord(rules, "i2v_prompt_rules"),
    caption_rules: readLegacyStringArrayFromRecord(rules, "caption_rules"),
    hashtag_rules: readLegacyStringArrayFromRecord(rules, "hashtag_rules"),
    negative_prompt_rules: readLegacyStringArrayFromRecord(rules, "negative_prompt_rules"),
    product_positioning_notes: readLegacyStringArrayFromRecord(rules, "product_positioning_notes"),
  };
}

function requirePromptRulesJson(value: unknown, label: string) {
  const record = requireRecord(value, label);

  function requireNormalizedRuleArray(ruleValue: unknown, ruleLabel: string, maxLength: number) {
    const items = readJsonLikeStringArray(ruleValue)
      .map((item) => compactText(item, maxLength))
      .filter((item): item is string => item.length > 0);

    if (!items.length) {
      throw new Error(`${ruleLabel} must be an array of non-empty strings.`);
    }

    return items;
  }

  return {
    i2i_prompt_rules: requireNormalizedRuleArray(record.i2i_prompt_rules, `${label}.i2i_prompt_rules`, 240),
    i2v_prompt_rules: requireNormalizedRuleArray(record.i2v_prompt_rules, `${label}.i2v_prompt_rules`, 240),
    caption_rules: requireNormalizedRuleArray(record.caption_rules, `${label}.caption_rules`, 240),
    hashtag_rules: requireNormalizedRuleArray(record.hashtag_rules, `${label}.hashtag_rules`, 120),
    negative_prompt_rules: requireNormalizedRuleArray(record.negative_prompt_rules, `${label}.negative_prompt_rules`, 240),
    product_positioning_notes: requireNormalizedRuleArray(record.product_positioning_notes, `${label}.product_positioning_notes`, 240),
  } satisfies PromptPackPromptRulesJson;
}

function requirePromptVisualReferenceJson(value: unknown, label: string, expectedKind: PromptPackVisualReferenceKind) {
  const record = requireRecord(value, label);
  const kind = requireString(record.kind, `${label}.kind`);

  if (kind !== expectedKind) {
    throw new Error(`${label}.kind must equal ${expectedKind}.`);
  }

  const fallbackLabel = requireString(record.label, `${label}.label`);
  const mention = readStringFromRecord(record, "mention") || `@${fallbackLabel}`;
  const role =
    typeof record.role === "string" && ["primary_subject", "supporting_reference", "background_anchor"].includes(record.role)
      ? (record.role as PromptPackVisualReferenceRole)
      : normalizePromptReferenceRole(expectedKind);

  return buildPromptReferenceCard({
    kind,
    label: fallbackLabel,
    mention,
    role,
    summary: readStringFromRecord(record, "summary") || fallbackLabel,
    mustKeep: readJsonLikeStringArray(record.must_keep),
    mustAvoid: readJsonLikeStringArray(record.must_avoid),
    instruction: readStringFromRecord(record, "instruction"),
    driveItemRefId: readStringFromRecord(record, "drive_item_ref_id") || null,
    driveUrl: readStringFromRecord(record, "drive_url") || null,
    drivePath: readStringFromRecord(record, "drive_path") || null,
    analysisJson: readJsonObject(record.analysis_json),
  });
}

function requirePromptVisualReferencesJson(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length !== PROMPT_VISUAL_REFERENCE_ORDER.length) {
    throw new Error(`${label} must contain exactly ${PROMPT_VISUAL_REFERENCE_ORDER.length} visual references.`);
  }

  return PROMPT_VISUAL_REFERENCE_ORDER.map((kind, index) => requirePromptVisualReferenceJson(value[index], `${label}[${index}]`, kind));
}

function readPromptPackServerContext(options: { serverPromptContext?: JsonObject | null } | undefined, record: Record<string, unknown>) {
  if (isRecord(options?.serverPromptContext)) {
    return options.serverPromptContext as JsonObject;
  }

  const promptContext = isRecord(record.prompt_context) ? (record.prompt_context as JsonObject) : null;
  return promptContext;
}

function buildPromptPackServerState(context: JsonObject) {
  const affiliateProfile = isRecord(context.affiliate_profile) ? (context.affiliate_profile as Record<string, unknown>) : null;

  return {
    promptContext: context,
    promptRules: buildPromptRulesFromContext(context),
    visualReferences: readPromptVisualReferencesFromContext(context),
    seedCharacter: readLockState(affiliateProfile?.seed_character),
    environment: readLockState(affiliateProfile?.environment),
  };
}

function requireCompactI2IFramePromptJson(
  value: unknown,
  label: string,
  clipKey: PromptClipKey,
  frame: "first_frame" | "last_frame",
  promptRules: PromptPackPromptRulesJson,
  visualReferences: PromptPackVisualReferenceJson[],
  productName: string,
  promptCode: string,
  version: number,
) {
  const record = requireRecord(value, label);
  const slot = requirePromptClipKey(record.slot, `${label}.slot`);

  if (slot !== clipKey) {
    throw new Error(`${label}.slot must equal ${clipKey}.`);
  }

  const nextFrame = requireString(record.frame, `${label}.frame`);

  if (nextFrame !== frame) {
    throw new Error(`${label}.frame must equal ${frame}.`);
  }

  return buildPromptFramePromptJson({
    clipKey,
    frame,
    promptText: requireString(record.prompt_text, `${label}.prompt_text`),
    visualReferences,
    rules: promptRules,
    productName,
    promptCode,
    version,
  });
}

function requireCompactI2IPromptJson(
  value: unknown,
  label: string,
  clipKey: PromptClipKey,
  promptRules: PromptPackPromptRulesJson,
  visualReferences: PromptPackVisualReferenceJson[],
  productName: string,
  promptCode: string,
  version: number,
) {
  const record = requireRecord(value, label);
  requireExactKeys(record, ["slot", "first_frame", "last_frame"], label);
  const slot = requirePromptClipKey(record.slot, `${label}.slot`);

  if (slot !== clipKey) {
    throw new Error(`${label}.slot must equal ${clipKey}.`);
  }

  return {
    slot,
    first_frame: requireCompactI2IFramePromptJson(
      record.first_frame,
      `${label}.first_frame`,
      clipKey,
      "first_frame",
      promptRules,
      visualReferences,
      productName,
      promptCode,
      version,
    ),
    last_frame: requireCompactI2IFramePromptJson(
      record.last_frame,
      `${label}.last_frame`,
      clipKey,
      "last_frame",
      promptRules,
      visualReferences,
      productName,
      promptCode,
      version,
    ),
  } satisfies PromptPackI2IClipJson;
}

function requireCompactI2VPromptJson(
  value: unknown,
  label: string,
  clipKey: PromptClipKey,
  promptRules: PromptPackPromptRulesJson,
  visualReferences: PromptPackVisualReferenceJson[],
  productName: string,
  promptCode: string,
  version: number,
) {
  const record = requireRecord(value, label);
  requireExactKeys(record, ["slot", "prompt_text", "continuity"], label);
  const slot = requirePromptClipKey(record.slot, `${label}.slot`);

  if (slot !== clipKey) {
    throw new Error(`${label}.slot must equal ${clipKey}.`);
  }

  const continuity = isRecord(record.continuity) ? (record.continuity as Record<string, unknown>) : {};

  return buildPromptI2VPromptJson({
    clipKey,
    promptText: requireString(record.prompt_text, `${label}.prompt_text`),
    visualReferences,
    rules: promptRules,
    productName,
    promptCode,
    version,
    continuity: {
      first_frame_hint: requireString(continuity.first_frame_hint, `${label}.continuity.first_frame_hint`),
      last_frame_hint: requireString(continuity.last_frame_hint, `${label}.continuity.last_frame_hint`),
    },
  });
}

function requireCompactI2IPromptMap(
  value: unknown,
  promptRules: PromptPackPromptRulesJson,
  visualReferences: PromptPackVisualReferenceJson[],
  productName: string,
  promptCode: string,
  version: number,
) {
  const record = requireRecord(value, "i2i_prompts");
  requireExactKeys(record, PROMPT_CLIP_KEYS, "i2i_prompts");

  return PROMPT_CLIP_KEYS.reduce(
    (result, clipKey) => ({
      ...result,
      [clipKey]: requireCompactI2IPromptJson(
        record[clipKey],
        `i2i_prompts.${clipKey}`,
        clipKey,
        promptRules,
        visualReferences,
        productName,
        promptCode,
        version,
      ),
    }),
    {} as Record<PromptClipKey, PromptPackI2IClipJson>,
  );
}

function requireCompactI2VPromptMap(
  value: unknown,
  promptRules: PromptPackPromptRulesJson,
  visualReferences: PromptPackVisualReferenceJson[],
  productName: string,
  promptCode: string,
  version: number,
) {
  const record = requireRecord(value, "i2v_prompts");
  requireExactKeys(record, PROMPT_CLIP_KEYS, "i2v_prompts");

  return PROMPT_CLIP_KEYS.reduce(
    (result, clipKey) => ({
      ...result,
      [clipKey]: requireCompactI2VPromptJson(
        record[clipKey],
        `i2v_prompts.${clipKey}`,
        clipKey,
        promptRules,
        visualReferences,
        productName,
        promptCode,
        version,
      ),
    }),
    {} as Record<PromptClipKey, PromptPackI2VPromptJson>,
  );
}

function requireI2IFramePromptJson(value: unknown, label: string, clipKey: PromptClipKey, frame: "first_frame" | "last_frame") {
  const record = requireRecord(value, label);
  const slot = requirePromptClipKey(record.slot, `${label}.slot`);

  if (slot !== clipKey) {
    throw new Error(`${label}.slot must equal ${clipKey}.`);
  }

  const nextFrame = requireString(record.frame, `${label}.frame`);

  if (nextFrame !== frame) {
    throw new Error(`${label}.frame must equal ${frame}.`);
  }

  return {
    slot,
    frame: nextFrame,
    prompt_text: requireString(record.prompt_text, `${label}.prompt_text`),
    visual_references: requirePromptVisualReferencesJson(record.visual_references, `${label}.visual_references`),
    prompt_rules: requirePromptRulesJson(record.prompt_rules, `${label}.prompt_rules`),
  } satisfies PromptPackI2IFramePromptJson;
}

function requireI2IPromptJson(value: unknown, label: string, clipKey: PromptClipKey) {
  const record = requireRecord(value, label);
  const slot = requirePromptClipKey(record.slot, `${label}.slot`);

  if (slot !== clipKey) {
    throw new Error(`${label}.slot must equal ${clipKey}.`);
  }

  return {
    slot,
    first_frame: requireI2IFramePromptJson(record.first_frame, `${label}.first_frame`, clipKey, "first_frame"),
    last_frame: requireI2IFramePromptJson(record.last_frame, `${label}.last_frame`, clipKey, "last_frame"),
  } satisfies PromptPackI2IClipJson;
}

function requireI2VPromptJson(value: unknown, label: string, clipKey: PromptClipKey) {
  const record = requireRecord(value, label);
  const slot = requirePromptClipKey(record.slot, `${label}.slot`);

  if (slot !== clipKey) {
    throw new Error(`${label}.slot must equal ${clipKey}.`);
  }

  const continuity = isRecord(record.continuity) ? (record.continuity as Record<string, unknown>) : {};

  return {
    slot,
    prompt_text: requireString(record.prompt_text, `${label}.prompt_text`),
    visual_references: requirePromptVisualReferencesJson(record.visual_references, `${label}.visual_references`),
    prompt_rules: requirePromptRulesJson(record.prompt_rules, `${label}.prompt_rules`),
    continuity: {
      first_frame_hint: requireString(continuity.first_frame_hint, `${label}.continuity.first_frame_hint`),
      last_frame_hint: requireString(continuity.last_frame_hint, `${label}.continuity.last_frame_hint`),
    },
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
    {} as Record<PromptClipKey, PromptPackI2IClipJson>,
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

function readLegacyI2IFramePromptJson(
  promptText: string,
  clipKey: PromptClipKey,
  frame: "first_frame" | "last_frame",
  visualReferences: PromptPackVisualReferenceJson[],
  rules: PromptPackPromptRulesJson,
  productName: string,
  promptCode: string,
  version: number,
) {
  return buildPromptFramePromptJson({
    clipKey,
    frame,
    promptText,
    visualReferences,
    rules,
    productName,
    promptCode,
    version,
  });
}

function readLegacyI2VPromptJson(
  promptText: string,
  clipKey: PromptClipKey,
  visualReferences: PromptPackVisualReferenceJson[],
  rules: PromptPackPromptRulesJson,
  productName: string,
  promptCode: string,
  version: number,
  continuity: { first_frame_hint: string; last_frame_hint: string },
) {
  return buildPromptI2VPromptJson({
    clipKey,
    promptText,
    visualReferences,
    rules,
    productName,
    promptCode,
    version,
    continuity,
  });
}

function readTagsFromPersonalization(record: Record<string, unknown>) {
  const direct = readString(record.tags);

  if (direct) {
    return normalizeHashtagString(direct);
  }

  const legacyHashtagRules = readLegacyStringArray(record.hashtag_rules);

  if (legacyHashtagRules.length) {
    return normalizeHashtagString(legacyHashtagRules.join(" "));
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

function buildPromptSetVisualReferences(personalization: Record<string, unknown> | null | undefined) {
  const context = isRecord(personalization?.prompt_context) ? (personalization?.prompt_context as JsonObject) : null;

  if (context) {
    return readPromptVisualReferencesFromContext(context);
  }

  const seedCharacter = readLockState(personalization?.seed_character);
  const environment = readLockState(personalization?.environment);

  return [
    buildPromptReferenceCard({
      kind: "CHARACTER",
      label: "Character",
      mention: "@Character",
      role: "supporting_reference",
      summary: "Character reference",
      mustKeep: [],
      mustAvoid: [],
      driveItemRefId: seedCharacter.drive_item_ref_id,
      driveUrl: null,
      drivePath: null,
      analysisJson: null,
    }),
    buildPromptReferenceCard({
      kind: "ENVIRONMENT",
      label: "Environment",
      mention: "@Environment",
      role: "background_anchor",
      summary: "Environment reference",
      mustKeep: [],
      mustAvoid: [],
      driveItemRefId: environment.drive_item_ref_id,
      driveUrl: null,
      drivePath: null,
      analysisJson: null,
    }),
    buildPromptReferenceCard({
      kind: "PRODUCT",
      label: "Product",
      mention: "@Product",
      role: "primary_subject",
      summary: "Product reference",
      mustKeep: [],
      mustAvoid: [],
      driveItemRefId: null,
      driveUrl: null,
      drivePath: null,
      analysisJson: null,
    }),
  ] satisfies PromptPackVisualReferenceJson[];
}

function buildPromptSetRules(personalization: Record<string, unknown> | null | undefined) {
  return readPromptRulesFromPersonalization(personalization);
}

function readPromptFrameSnapshot(
  value: unknown,
  fallback: {
    clipKey: PromptClipKey;
    frame: "first_frame" | "last_frame";
    visualReferences: PromptPackVisualReferenceJson[];
    rules: PromptPackPromptRulesJson;
    productName: string;
    promptCode: string;
    version: number;
  },
) {
  const record = parseRecordValue(value);

  if (record) {
    const promptText =
      readPromptField(record.prompt_text) ||
      readPromptField(record.prompt) ||
      readPromptField(record.text) ||
      readPromptField(record[`${fallback.frame}`]);

    const visualReferences = readPromptVisualReferencesSnapshot(record.visual_references, fallback.visualReferences);
    const rules = readPromptRulesSnapshotFromValue(record.prompt_rules, fallback.rules);

    return buildPromptFramePromptJson({
      clipKey: fallback.clipKey,
      frame: fallback.frame,
      promptText,
      visualReferences,
      rules,
      productName: fallback.productName,
      promptCode: fallback.promptCode,
      version: fallback.version,
    });
  }

  return buildPromptFramePromptJson({
    clipKey: fallback.clipKey,
    frame: fallback.frame,
    promptText: readPromptField(value),
    visualReferences: fallback.visualReferences,
    rules: fallback.rules,
    productName: fallback.productName,
    promptCode: fallback.promptCode,
    version: fallback.version,
  });
}

function readPromptI2VSnapshot(
  value: unknown,
  fallback: {
    clipKey: PromptClipKey;
    visualReferences: PromptPackVisualReferenceJson[];
    rules: PromptPackPromptRulesJson;
    productName: string;
    promptCode: string;
    version: number;
    continuity: { first_frame_hint: string; last_frame_hint: string };
  },
) {
  const record = parseRecordValue(value);

  if (record) {
    const promptText = readPromptField(record.prompt_text) || readPromptField(record.prompt);
    const visualReferences = readPromptVisualReferencesSnapshot(record.visual_references, fallback.visualReferences);
    const rules = readPromptRulesSnapshotFromValue(record.prompt_rules, fallback.rules);
    const continuityRecord = isRecord(record.continuity) ? (record.continuity as Record<string, unknown>) : {};
    const continuity = {
      first_frame_hint: readPromptField(continuityRecord.first_frame_hint) || fallback.continuity.first_frame_hint,
      last_frame_hint: readPromptField(continuityRecord.last_frame_hint) || fallback.continuity.last_frame_hint,
    };

    return buildPromptI2VPromptJson({
      clipKey: fallback.clipKey,
      promptText,
      visualReferences,
      rules,
      productName: fallback.productName,
      promptCode: fallback.promptCode,
      version: fallback.version,
      continuity,
    });
  }

  return buildPromptI2VPromptJson({
    clipKey: fallback.clipKey,
    promptText: readPromptField(value),
    visualReferences: fallback.visualReferences,
    rules: fallback.rules,
    productName: fallback.productName,
    promptCode: fallback.promptCode,
    version: fallback.version,
    continuity: fallback.continuity,
  });
}

function readI2IClip(
  record: Record<string, unknown>,
  personalization: Record<string, unknown>,
  clipKey: PromptClipKey,
  productName = "",
  promptCode = "",
  version = 1,
) {
  const current = parseRecordValue(record[clipKey]) ?? {};
  const legacyPrefix = clipKey === "clip_1" ? "clip_01" : "clip_02";
  const visualReferences = buildPromptSetVisualReferences(personalization);
  const rules = buildPromptSetRules(personalization);

  return {
    i2i_first_frame_json: readPromptFrameSnapshot(current.first_frame ?? current.i2i_first_frame ?? record[`${legacyPrefix}_start_frame`], {
      clipKey,
      frame: "first_frame",
      visualReferences,
      rules,
      productName,
      promptCode,
      version,
    }),
    i2i_last_frame_json: readPromptFrameSnapshot(current.last_frame ?? current.i2i_last_frame ?? record[`${legacyPrefix}_last_frame`], {
      clipKey,
      frame: "last_frame",
      visualReferences,
      rules,
      productName,
      promptCode,
      version,
    }),
  };
}

function readI2VClip(
  record: Record<string, unknown>,
  personalization: Record<string, unknown>,
  clipKey: PromptClipKey,
  productName = "",
  promptCode = "",
  version = 1,
) {
  const current = parseRecordValue(record[clipKey]) ?? {};
  const legacyKey = clipKey === "clip_1" ? "clip_01" : "clip_02";
  const visualReferences = buildPromptSetVisualReferences(personalization);
  const rules = buildPromptSetRules(personalization);
  const continuity = {
    first_frame_hint: `Use ${PROMPT_CLIP_KEYS.indexOf(clipKey) + 1} frame opening`,
    last_frame_hint: `Use ${PROMPT_CLIP_KEYS.indexOf(clipKey) + 1} frame ending`,
  };

  return readPromptI2VSnapshot(current, {
    clipKey,
    visualReferences,
    rules,
    productName,
    promptCode,
    version,
    continuity,
  });
}

function toI2IStorageClip(clipKey: PromptClipKey, clip: PromptPackEditorClipInput) {
  const firstFrame = requireI2IFramePromptJson(
    parseRequiredPromptRecord(clip.i2i_first_frame, `${clipKey}.i2i_first_frame`),
    `${clipKey}.first_frame`,
    clipKey,
    "first_frame",
  );
  const lastFrame = requireI2IFramePromptJson(
    parseRequiredPromptRecord(clip.i2i_last_frame, `${clipKey}.i2i_last_frame`),
    `${clipKey}.last_frame`,
    clipKey,
    "last_frame",
  );

  return {
    slot: clipKey,
    first_frame: firstFrame,
    last_frame: lastFrame,
  } satisfies PromptPackI2IClipJson;
}

function toI2VStorageClip(clipKey: PromptClipKey, clip: PromptPackEditorClipInput) {
  return requireI2VPromptJson(
    parseRequiredPromptRecord(clip.i2v_prompt, `${clipKey}.i2v_prompt`),
    `${clipKey}.i2v_prompt`,
    clipKey,
  );
}

function parseCompactPromptPackGenerationOutput(
  record: Record<string, unknown>,
  options?: {
    fallbackProductStatus?: string | null;
    fallbackSourceImage?: PromptPackSourceImageRecord | null;
    serverPromptContext?: JsonObject | null;
  },
): PromptPackGenerationOutput {
  const serverPromptContext = readPromptPackServerContext(options, record);

  if (!serverPromptContext) {
    throw new Error("Gemini compact output requires server prompt context.");
  }

  const serverState = buildPromptPackServerState(serverPromptContext);
  const productAnalysis = requirePromptAnalysisJson(
    record.product_analysis,
    options?.fallbackProductStatus,
    options?.fallbackSourceImage,
  );
  const productName = productAnalysis.product.product_name;
  const promptCode = productAnalysis.prompt_code;
  const version = productAnalysis.version;

  return {
    product_analysis: productAnalysis,
    prompt_context: serverState.promptContext,
    i2i_prompts: requireCompactI2IPromptMap(
      record.i2i_prompts,
      serverState.promptRules,
      serverState.visualReferences,
      productName,
      promptCode,
      version,
    ),
    i2v_prompts: requireCompactI2VPromptMap(
      record.i2v_prompts,
      serverState.promptRules,
      serverState.visualReferences,
      productName,
      promptCode,
      version,
    ),
    caption: requireString(record.caption, "caption"),
    tags: normalizeHashtagString(requireString(record.tags, "tags")),
    target_marketplace: PROMPT_TARGET_MARKETPLACE,
    negative_prompt_rules: requireStringArray(record.negative_prompt_rules, "negative_prompt_rules"),
    consistency_rules: requireStringArray(record.consistency_rules, "consistency_rules"),
    seed_character: serverState.seedCharacter,
    environment: serverState.environment,
  };
}

function parseLegacyPromptPackGenerationOutput(
  record: Record<string, unknown>,
  options?: {
    fallbackProductStatus?: string | null;
    fallbackSourceImage?: PromptPackSourceImageRecord | null;
  },
): PromptPackGenerationOutput {
  requireExactKeys(record, PROMPT_PACK_OUTPUT_KEYS, "Gemini output");

  const targetMarketplace = requireString(record.target_marketplace, "target_marketplace");

  if (targetMarketplace !== PROMPT_TARGET_MARKETPLACE) {
    throw new Error(`target_marketplace must equal ${PROMPT_TARGET_MARKETPLACE}.`);
  }

  return {
    product_analysis: requirePromptAnalysisJson(
      record.product_analysis,
      options?.fallbackProductStatus,
      options?.fallbackSourceImage,
    ),
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

export function parsePromptPackGenerationOutput(
  rawText: string,
  options?: {
    fallbackProductStatus?: string | null;
    fallbackSourceImage?: PromptPackSourceImageRecord | null;
    serverPromptContext?: JsonObject | null;
  },
): PromptPackGenerationOutput {
  const jsonText = recoverJsonText(rawText);
  const parsed: unknown = JSON.parse(jsonText);
  const record = requireRecord(parsed, "Gemini output");

  if (hasExactKeys(record, PROMPT_PACK_COMPACT_OUTPUT_KEYS)) {
    return parseCompactPromptPackGenerationOutput(record, options);
  }

  if (hasExactKeys(record, PROMPT_PACK_OUTPUT_KEYS)) {
    return parseLegacyPromptPackGenerationOutput(record, options);
  }

  throw new Error("Gemini output must use the compact prompt-pack JSON contract.");
}

export function readPromptPackEditorPromptSet(input: {
  i2i_prompts_json?: unknown;
  i2v_prompts_json?: unknown;
  personalization_json?: unknown;
}): PromptPackEditorPromptSet {
  const i2iPrompts = readRecord(input.i2i_prompts_json);
  const i2vPrompts = readRecord(input.i2v_prompts_json);
  const personalization = readRecord(input.personalization_json);
  const promptContext = isRecord(personalization.prompt_context) ? (personalization.prompt_context as JsonObject) : null;
  const productName =
    promptContext && isRecord(promptContext.product) ? readString((promptContext.product as Record<string, unknown>).product_name) : "";

  const clips = PROMPT_CLIP_KEYS.reduce(
    (result, clipKey) => {
      const i2iClip = readI2IClip(i2iPrompts, personalization, clipKey, productName);
      const i2vClip = readI2VClip(i2vPrompts, personalization, clipKey, productName);

      return {
        ...result,
        [clipKey]: {
          ...i2iClip,
          i2v_prompt_json: i2vClip,
          i2i_first_frame: stringifyPromptJson(i2iClip.i2i_first_frame_json),
          i2i_last_frame: stringifyPromptJson(i2iClip.i2i_last_frame_json),
          i2v_prompt: stringifyPromptJson(i2vClip),
        },
      };
    },
    {} as Record<PromptClipKey, PromptPackEditorClip>,
  );

  return {
    clips,
    caption:
      readString(personalization.caption) ||
      readLegacyStringArray(personalization.caption_rules).join("\n"),
    tags: readTagsFromPersonalization(personalization),
    target_marketplace: PROMPT_TARGET_MARKETPLACE,
    prompt_context: promptContext,
    seed_character: readLockState(personalization.seed_character),
    environment: readLockState(personalization.environment),
  };
}

export function buildPromptPackEditorStoragePayload(
  input: {
    clips: Record<PromptClipKey, PromptPackEditorClipInput>;
    caption: string;
    tags: string;
  },
  existingPersonalization?: unknown,
): PromptPackStoragePayload {
  const existing = jsonRecordOrEmpty(existingPersonalization);
  const promptContext = isRecord(existing.prompt_context) ? (existing.prompt_context as JsonObject) : null;
  const i2iPrompts = PROMPT_CLIP_KEYS.reduce(
    (result, clipKey) => ({
      ...result,
      [clipKey]: toI2IStorageClip(clipKey, input.clips[clipKey]),
    }),
    {} as Record<PromptClipKey, PromptPackI2IClipJson>,
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
      prompt_context: promptContext,
      caption: input.caption.trim(),
      tags: normalizeHashtagString(input.tags),
      target_marketplace: PROMPT_TARGET_MARKETPLACE,
      seed_character: isRecord(existing.seed_character) ? (existing.seed_character as JsonObject) : EMPTY_LOCK_STATE,
      environment: isRecord(existing.environment) ? (existing.environment as JsonObject) : EMPTY_LOCK_STATE,
    },
  };
}

export function buildPromptPackStoragePayload(
  output: PromptPackGenerationOutput,
  promptContextOverride?: JsonObject | null,
): PromptPackStoragePayload {
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
      prompt_context: promptContextOverride ?? output.prompt_context,
      caption: output.caption,
      tags: normalizeHashtagString(output.tags),
      target_marketplace: PROMPT_TARGET_MARKETPLACE,
      seed_character: output.seed_character,
      environment: output.environment,
    },
  };
}
