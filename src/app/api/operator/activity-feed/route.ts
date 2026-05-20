import { normalizeOperatorActivityFeedLimit } from "@/lib/operator-activity-feed-contract";
import { apiAuthenticationErrorResponse } from "@/lib/server/api-auth";
import { ok, fail } from "@/lib/server/api-response";
import { getOperatorActivityFeed } from "@/lib/server/operator-activity-feed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = normalizeOperatorActivityFeedLimit(url.searchParams.get("limit"));
    const items = await getOperatorActivityFeed({ limit });

    return ok({
      generatedAt: new Date().toISOString(),
      items,
    });
  } catch (error) {
    const authResponse = apiAuthenticationErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    return fail(error instanceof Error ? error.message : "Aktivitas gagal dimuat.", 400);
  }
}
