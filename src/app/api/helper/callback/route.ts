import type { NextRequest } from "next/server";
import { fail, ok, unauthorized } from "@/lib/server/api-response";
import { processHelperCallback } from "@/lib/server/helper-callback";
import { API_RATE_LIMITS, rateLimitResponseForRequest } from "@/lib/server/rate-limit";
import { toSafeErrorMessage } from "@/lib/server/safe-error";

function readBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");

  if (!header) {
    throw new Error("Authorization header wajib diisi.");
  }

  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new Error("Authorization header harus memakai Bearer token.");
  }

  const token = match[1].trim();

  if (!token) {
    throw new Error("Bearer token wajib diisi.");
  }

  return token;
}

function isHelperCallbackAuthError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return message.includes("authorization header") || message.includes("bearer") || message.includes("token");
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimitResponseForRequest(request, API_RATE_LIMITS.helperCallback);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const token = readBearerToken(request);
    const payload = await request.json();
    const result = await processHelperCallback(token, payload);

    return ok(result, 200);
  } catch (error) {
    if (isHelperCallbackAuthError(error)) {
      return unauthorized();
    }

    const message = toSafeErrorMessage(error, {
      context: "api.helper.callback",
      fallbackMessage: "Helper callback gagal.",
    });

    return fail(message, 400);
  }
}
