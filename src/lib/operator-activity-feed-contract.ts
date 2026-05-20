export type ActivityFeedTone = "info" | "success" | "warning" | "error";

export type ActivityFeedItem = {
  id: string;
  occurredAt: string;
  tone: ActivityFeedTone;
  category: string;
  title: string;
  message: string;
  href?: string;
};

export type OperatorActivityFeedResponse = {
  generatedAt: string;
  items: ActivityFeedItem[];
};

export const OPERATOR_ACTIVITY_FEED_DEFAULT_LIMIT = 12;
export const OPERATOR_ACTIVITY_FEED_MAX_LIMIT = 50;

export function normalizeOperatorActivityFeedLimit(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;

  if (!Number.isInteger(parsed)) {
    return OPERATOR_ACTIVITY_FEED_DEFAULT_LIMIT;
  }

  return Math.min(Math.max(parsed, 1), OPERATOR_ACTIVITY_FEED_MAX_LIMIT);
}
