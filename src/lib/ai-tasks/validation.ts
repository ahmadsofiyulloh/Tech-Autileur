export const AI_TASK_STATUSES = [
  "QUEUED",
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "RETRYING",
  "WAITING_FOR_KEY",
  "CANCELLED",
] as const;

export const AI_TASK_TYPES = [
  "VISION_ANALYSIS",
  "I2I_PROMPT",
  "I2V_PROMPT",
  "CONSISTENCY_CHECK",
  "PROMPT_REPAIR",
  "FALLBACK",
] as const;

export type AiTaskStatus = (typeof AI_TASK_STATUSES)[number];
export type AiTaskType = (typeof AI_TASK_TYPES)[number];

export function isAiTaskStatus(value: string): value is AiTaskStatus {
  return (AI_TASK_STATUSES as readonly string[]).includes(value);
}

export function isAiTaskType(value: string): value is AiTaskType {
  return (AI_TASK_TYPES as readonly string[]).includes(value);
}
