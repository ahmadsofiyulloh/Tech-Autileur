import "server-only";

import { rateLimited } from "@/lib/server/api-response";

type RateLimitConfig = {
  route: string;
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitStore = {
  buckets: Map<string, RateLimitBucket>;
  checks: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const RATE_LIMIT_STORE_KEY = "__techAutileurRateLimitStore";
const CLEANUP_INTERVAL_CHECKS = 100;

export const RATE_LIMITED_ERROR_MESSAGE = "Too many requests. Try again later.";

export const API_RATE_LIMITS = {
  helperCallback: {
    route: "/api/helper/callback",
    limit: 10,
    windowMs: 60_000,
  },
  promptQueueRunNext: {
    route: "/api/prompts/queue/run-next",
    limit: 30,
    windowMs: 60_000,
  },
  bulkImportJobRun: {
    route: "/api/products/bulk-import/jobs/[jobId]/run",
    limit: 30,
    windowMs: 60_000,
  },
  bulkImportJobCancel: {
    route: "/api/products/bulk-import/jobs/[jobId]/cancel",
    limit: 30,
    windowMs: 60_000,
  },
} as const satisfies Record<string, RateLimitConfig>;

type RateLimitGlobal = typeof globalThis & {
  [RATE_LIMIT_STORE_KEY]?: RateLimitStore;
};

function getStore() {
  const rateLimitGlobal = globalThis as RateLimitGlobal;
  rateLimitGlobal[RATE_LIMIT_STORE_KEY] ??= {
    buckets: new Map<string, RateLimitBucket>(),
    checks: 0,
  };

  return rateLimitGlobal[RATE_LIMIT_STORE_KEY];
}

function readFirstHeaderValue(value: string | null) {
  return (
    value
      ?.split(",")
      .map((part) => part.trim())
      .find(Boolean) ?? null
  );
}

export function readRateLimitIp(request: Request) {
  return (
    readFirstHeaderValue(request.headers.get("x-forwarded-for")) ??
    readFirstHeaderValue(request.headers.get("x-real-ip")) ??
    readFirstHeaderValue(request.headers.get("cf-connecting-ip")) ??
    "unknown"
  );
}

function cleanupExpiredBuckets(store: RateLimitStore, now: number) {
  store.checks += 1;

  if (store.checks % CLEANUP_INTERVAL_CHECKS !== 0 && store.buckets.size < 10_000) {
    return;
  }

  for (const [key, bucket] of store.buckets.entries()) {
    if (bucket.resetAt <= now) {
      store.buckets.delete(key);
    }
  }
}

export function consumeRateLimit(request: Request, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const limit = Math.max(1, Math.trunc(config.limit));
  const windowMs = Math.max(1_000, Math.trunc(config.windowMs));
  const store = getStore();
  const key = `${config.route}:${readRateLimitIp(request)}`;

  cleanupExpiredBuckets(store, now);

  let bucket = store.buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = {
      count: 0,
      resetAt: now + windowMs,
    };
    store.buckets.set(key, bucket);
  }

  bucket.count += 1;

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));

  return {
    allowed: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds,
  };
}

export function rateLimitExceededResponse(result: Pick<RateLimitResult, "retryAfterSeconds">) {
  return rateLimited(result.retryAfterSeconds);
}

export function rateLimitResponseForRequest(request: Request, config: RateLimitConfig) {
  const result = consumeRateLimit(request, config);

  if (result.allowed) {
    return null;
  }

  return rateLimitExceededResponse(result);
}
