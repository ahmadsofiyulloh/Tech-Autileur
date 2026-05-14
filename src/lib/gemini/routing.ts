import type { GeminiKeyRole, GeminiModelName } from "@/lib/gemini/validation";

const PACIFIC_TIME_ZONE = "America/Los_Angeles";

export const VISION_MODEL_NAMES = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const satisfies readonly GeminiModelName[];

export const VISION_GEMINI_KEY_PRIORITY = ["VISION_ANALYSIS", "FALLBACK"] as const satisfies readonly GeminiKeyRole[];
export const PROMPT_PACK_GEMINI_KEY_PRIORITY = [
  "I2V_PROMPT",
  "I2I_PROMPT",
  "CONSISTENCY_CHECK",
  "PROMPT_REPAIR",
  "FALLBACK",
] as const satisfies readonly GeminiKeyRole[];

function cleanText(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeGeminiProjectLabel(value: string | null | undefined) {
  return cleanText(value)?.toLowerCase() ?? null;
}

export function getGeminiQuotaGroupKey(input: { id: string; model_name: string; project_label: string | null }) {
  const projectLabel = normalizeGeminiProjectLabel(input.project_label);

  if (projectLabel) {
    return `project:${projectLabel}::model:${input.model_name}`;
  }

  return `key:${input.id}`;
}

function readPositiveLimit(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function hasConfiguredGeminiQuotaLimits(input: {
  rpm_limit: number | null | undefined;
  rpd_limit: number | null | undefined;
  tpm_limit: number | null | undefined;
}) {
  return (
    readPositiveLimit(input.rpm_limit) !== null &&
    readPositiveLimit(input.rpd_limit) !== null &&
    readPositiveLimit(input.tpm_limit) !== null
  );
}

export function startOfCurrentDayInTimeZone(now: Date, timeZone = PACIFIC_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  const zonedMidnight = `${parts.year}-${parts.month}-${parts.day}T00:00:00`;
  const offsetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    hour: "2-digit",
    minute: "2-digit",
  });
  const offsetPart = offsetFormatter.formatToParts(now).find((part) => part.type === "timeZoneName")?.value ?? "GMT-08:00";
  const offset = offsetPart.replace("GMT", "");

  return new Date(`${zonedMidnight}${offset}`);
}
