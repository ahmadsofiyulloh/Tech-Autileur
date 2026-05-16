import { getActiveProductBulkImportJob } from "@/lib/server/product-bulk-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await getActiveProductBulkImportJob();

    return Response.json({ snapshot });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Bulk import gagal.",
      },
      {
        status: 400,
      },
    );
  }
}
