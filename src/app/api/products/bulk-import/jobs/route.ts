import { createProductBulkImportJob } from "@/lib/server/product-bulk-import";
import { apiAuthenticationErrorResponse, requireApiUser } from "@/lib/server/api-auth";
import { fail, ok } from "@/lib/server/api-response";

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
    await requireApiUser();

    const formData = await request.formData();
    const snapshot = await createProductBulkImportJob(readBulkFile(formData));

    return ok(snapshot);
  } catch (error) {
    const authResponse = apiAuthenticationErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return fail(error instanceof Error ? error.message : "Bulk import gagal.", 400);
  }
}
