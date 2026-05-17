import { getProductBulkImportJob } from "@/lib/server/product-bulk-import";
import { fail, ok, unauthorized } from "@/lib/server/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const snapshot = await getProductBulkImportJob(jobId);

    return ok(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk import gagal.";

    return message.includes("Authentication") ? unauthorized() : fail(message, 400);
  }
}
