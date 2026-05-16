import { createProductBulkImportJob } from "@/lib/server/product-bulk-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readBulkFile(formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("File bulk wajib diunggah.");
  }

  return file;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const snapshot = await createProductBulkImportJob(readBulkFile(formData));

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
