import type { PromptReadinessStatus } from "@/lib/prompts/prompt-readiness-projection";
import type { PromptWorkbenchReadinessCounts, PromptWorkbenchReadinessFilter } from "@/lib/prompts/prompt-workbench";

export type PromptWorkbenchProjectionRowLike = {
  product: {
    id: string;
  };
  status: PromptReadinessStatus;
};

export function createPromptWorkbenchPageCollector<T extends PromptWorkbenchProjectionRowLike>(input: {
  page: number;
  pageSize: number;
  readiness: PromptWorkbenchReadinessFilter;
}) {
  const counts: PromptWorkbenchReadinessCounts = {
    NEEDS_EVIDENCE: 0,
    NEEDS_METADATA: 0,
    NEEDS_REVIEW: 0,
    READY_FOR_PROMPT: 0,
    PROMPT_QUEUED: 0,
    PROMPT_GENERATED: 0,
    PROMPT_FAILED: 0,
    total: 0,
  };
  const rows: T[] = [];
  const filteredRowStart = (input.page - 1) * input.pageSize;
  const filteredRowEnd = filteredRowStart + input.pageSize;
  let filteredRowIndex = 0;

  return {
    addBatch(batchRows: readonly T[]) {
      for (const row of batchRows) {
        counts.total += 1;
        counts[row.status] += 1;

        if (input.readiness !== "ALL" && row.status !== input.readiness) {
          continue;
        }

        if (filteredRowIndex >= filteredRowStart && filteredRowIndex < filteredRowEnd) {
          rows.push(row);
        }

        filteredRowIndex += 1;
      }
    },
    finish() {
      return {
        counts: { ...counts },
        rows: [...rows],
        totalCount: filteredRowIndex,
      };
    },
  };
}
