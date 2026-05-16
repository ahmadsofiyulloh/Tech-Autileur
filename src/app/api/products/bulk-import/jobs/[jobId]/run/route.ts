import { runProductBulkImportJob } from "@/lib/server/product-bulk-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const snapshot = await runProductBulkImportJob(jobId);

    return Response.json(snapshot);
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
