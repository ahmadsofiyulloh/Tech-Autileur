import { runNextPromptQueueTask } from "@/lib/server/prompt-queue";
import { apiAuthenticationErrorResponse, requireApiUser } from "@/lib/server/api-auth";
import { fail, ok } from "@/lib/server/api-response";
import { API_RATE_LIMITS, rateLimitResponseForRequest } from "@/lib/server/rate-limit";
import { toSafeErrorMessage } from "@/lib/server/safe-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireApiUser();

    const rateLimitResponse = rateLimitResponseForRequest(request, API_RATE_LIMITS.promptQueueRunNext);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const result = await runNextPromptQueueTask();
    const status = result.started ? 200 : result.reason === "RUNNING" ? 202 : 200;

    return ok(result, status);
  } catch (error) {
    const authResponse = apiAuthenticationErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    const message = toSafeErrorMessage(error, {
      context: "api.prompts.queue.run-next",
      fallbackMessage: "Antrian prompt gagal dijalankan.",
    });

    return fail(message, 400);
  }
}
