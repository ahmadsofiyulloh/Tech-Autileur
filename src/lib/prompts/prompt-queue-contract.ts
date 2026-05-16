export type PromptQueueTaskStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "RETRYING"
  | "WAITING_FOR_KEY"
  | "CANCELLED"
  | "UNKNOWN";

export type PromptQueueItemCategory = "running" | "waiting" | "failed" | "generated";

export type PromptQueueSummary = {
  queued: number;
  running: number;
  retrying: number;
  waitingForKey: number;
  failed: number;
  generated: number;
  totalTracked: number;
};

export type PromptQueueItem = {
  id: string;
  category: PromptQueueItemCategory;
  promptPack: {
    id: string;
    product_id: string;
    prompt_code: string;
    version: number;
    status: string;
    error_message: string | null;
    created_at: string;
    updated_at: string;
  };
  product: {
    id: string;
    product_code: string;
    product_name: string;
  };
  task: {
    id: string | null;
    status: PromptQueueTaskStatus;
    error_message: string | null;
    retry_count: number;
    max_retries: number;
    started_at: string | null;
    finished_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  geminiKey: {
    id: string | null;
    label: string | null;
    model_name: string | null;
  };
  canCancel: boolean;
  canRetry: boolean;
};

export type PromptQueueSnapshot = {
  generatedAt: string;
  summary: PromptQueueSummary;
  items: PromptQueueItem[];
  nextRunnablePromptPackId: string | null;
  runningPromptPackId: string | null;
};

export const EMPTY_PROMPT_QUEUE_SUMMARY: PromptQueueSummary = {
  queued: 0,
  running: 0,
  retrying: 0,
  waitingForKey: 0,
  failed: 0,
  generated: 0,
  totalTracked: 0,
};
