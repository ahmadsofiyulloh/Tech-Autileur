import { runProductBulkImportJob } from "@/lib/server/product-bulk-import";
import { apiAuthenticationErrorResponse, requireApiUser } from "@/lib/server/api-auth";
import { fail, ok } from "@/lib/server/api-response";
import { API_RATE_LIMITS, rateLimitResponseForRequest } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireApiUser();

    const rateLimitResponse = rateLimitResponseForRequest(request, API_RATE_LIMITS.bulkImportJobRun);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { jobId } = await context.params;
    const snapshot = await runProductBulkImportJob(jobId);

    return ok(snapshot);
  } catch (error) {
    const authResponse = apiAuthenticationErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return fail(error instanceof Error ? error.message : "Bulk import gagal.", 400);
  }
}
