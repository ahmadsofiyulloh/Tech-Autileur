import { apiAuthenticationErrorResponse, requireApiUser } from "@/lib/server/api-auth";
import { fail, ok } from "@/lib/server/api-response";
import { loadOperatorShellContextForUser } from "@/lib/server/operator-shell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { user } = await requireApiUser();
    const shellContext = await loadOperatorShellContextForUser(user.id);

    return ok(shellContext);
  } catch (error) {
    const authResponse = apiAuthenticationErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    return fail(error instanceof Error ? error.message : "Tidak dapat memuat konteks shell.");
  }
}
