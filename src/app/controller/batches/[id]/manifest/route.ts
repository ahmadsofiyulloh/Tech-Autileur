import { NextRequest, NextResponse } from "next/server";
import { getPersistedFlowBatchManifest } from "@/lib/server/flow-manifests";

function manifestFileName(batchCode: string) {
  const safeBatchCode = batchCode.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "flow-batch";

  return `${safeBatchCode}.manifest.json`;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { batch, manifest } = await getPersistedFlowBatchManifest(id);

    return new NextResponse(JSON.stringify(manifest, null, 2), {
      headers: {
        "Content-Disposition": `attachment; filename="${manifestFileName(batch.batch_code)}"`,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manifest tidak tersedia.";

    return NextResponse.json({ error: message }, { status: 404 });
  }
}
