import "server-only";

import { NextResponse } from "next/server";
import type { JsonApiFailure, JsonApiSuccess } from "@/lib/api-response-contract";

const DEFAULT_ERROR_CODE_BY_STATUS: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
};

const UNAUTHORIZED_MESSAGE = "Authentication required.";
const RATE_LIMITED_MESSAGE = "Too many requests. Try again later.";

function errorCodeForStatus(status: number) {
  return DEFAULT_ERROR_CODE_BY_STATUS[status] ?? "API_ERROR";
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data } satisfies JsonApiSuccess<T>, { status });
}

export function fail(message: string, status = 400, code = errorCodeForStatus(status)) {
  return NextResponse.json({ ok: false, error: { message, code } } satisfies JsonApiFailure, { status });
}

export function unauthorized() {
  return fail(UNAUTHORIZED_MESSAGE, 401, "UNAUTHORIZED");
}

export function rateLimited(retryAfterSeconds?: number) {
  const init: ResponseInit = { status: 429 };

  if (retryAfterSeconds) {
    init.headers = {
      "Retry-After": String(retryAfterSeconds),
    };
  }

  return NextResponse.json(
    { ok: false, error: { message: RATE_LIMITED_MESSAGE, code: "RATE_LIMITED" } } satisfies JsonApiFailure,
    init,
  );
}
