import { getActiveProductBulkImportJob } from "@/lib/server/product-bulk-import";
import { fail, ok, unauthorized } from "@/lib/server/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await getActiveProductBulkImportJob();

    return ok({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk import gagal.";

    return message.includes("Authentication") ? unauthorized() : fail(message, 400);
  }
}
