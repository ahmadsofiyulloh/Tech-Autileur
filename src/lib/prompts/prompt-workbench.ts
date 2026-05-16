import { PROMPT_READINESS_STATUS_LABELS } from "@/lib/prompts/prompt-readiness-projection";
import type { PromptReadinessProjectionRow } from "@/lib/server/prompt-readiness";
import type { PromptReadinessStatus } from "@/lib/prompts/prompt-readiness-projection";

export type PromptWorkbenchReadinessFilter = "ALL" | PromptReadinessStatus;

export type PromptWorkbenchReadinessCounts = Record<PromptReadinessStatus, number> & {
  total: number;
};

export const PROMPT_WORKBENCH_MOBILE_PAGE_SIZE = 20;
export const PROMPT_WORKBENCH_DESKTOP_PAGE_SIZE = 25;
export const PROMPT_WORKBENCH_PAGE_SIZE = PROMPT_WORKBENCH_DESKTOP_PAGE_SIZE;

export const PROMPT_WORKBENCH_READINESS_FILTERS: Array<{
  key: PromptWorkbenchReadinessFilter;
  label: string;
}> = [
  { key: "ALL", label: "Semua" },
  { key: "NEEDS_EVIDENCE", label: PROMPT_READINESS_STATUS_LABELS.NEEDS_EVIDENCE },
  { key: "NEEDS_METADATA", label: PROMPT_READINESS_STATUS_LABELS.NEEDS_METADATA },
  { key: "NEEDS_REVIEW", label: PROMPT_READINESS_STATUS_LABELS.NEEDS_REVIEW },
  { key: "READY_FOR_PROMPT", label: PROMPT_READINESS_STATUS_LABELS.READY_FOR_PROMPT },
  { key: "PROMPT_QUEUED", label: PROMPT_READINESS_STATUS_LABELS.PROMPT_QUEUED },
  { key: "PROMPT_GENERATED", label: PROMPT_READINESS_STATUS_LABELS.PROMPT_GENERATED },
  { key: "PROMPT_FAILED", label: PROMPT_READINESS_STATUS_LABELS.PROMPT_FAILED },
];

function readText(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0].trim() : "";
  }

  return typeof value === "string" ? value.trim() : "";
}

export function normalizePromptWorkbenchSearch(value: string | string[] | undefined) {
  return readText(value)
    .replace(/[^A-Za-z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function normalizePromptWorkbenchPage(value: string | string[] | undefined) {
  const normalized = readText(value);

  if (!normalized) {
    return 1;
  }

  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export function normalizePromptWorkbenchReadinessFilter(
  value: string | string[] | undefined,
): PromptWorkbenchReadinessFilter {
  const normalized = readText(value).toUpperCase().replace(/[\s-]+/g, "_");

  if (!normalized || normalized === "ALL") {
    return "ALL";
  }

  return normalized in PROMPT_READINESS_STATUS_LABELS
    ? (normalized as PromptWorkbenchReadinessFilter)
    : "ALL";
}

export function filterPromptWorkbenchRows(
  rows: readonly PromptReadinessProjectionRow[],
  filter: PromptWorkbenchReadinessFilter,
) {
  if (filter === "ALL") {
    return [...rows];
  }

  return rows.filter((row) => row.status === filter);
}

export function countPromptWorkbenchRows(rows: readonly PromptReadinessProjectionRow[]): PromptWorkbenchReadinessCounts {
  const counts: PromptWorkbenchReadinessCounts = {
    NEEDS_EVIDENCE: 0,
    NEEDS_METADATA: 0,
    NEEDS_REVIEW: 0,
    READY_FOR_PROMPT: 0,
    PROMPT_QUEUED: 0,
    PROMPT_GENERATED: 0,
    PROMPT_FAILED: 0,
    total: rows.length,
  };

  for (const row of rows) {
    counts[row.status as PromptReadinessStatus] += 1;
  }

  return counts;
}
