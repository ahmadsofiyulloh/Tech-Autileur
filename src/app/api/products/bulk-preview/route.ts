import { previewProductBulkImport } from "@/lib/server/product-bulk-import";
import { apiAuthenticationErrorResponse, requireApiUser } from "@/lib/server/api-auth";
import { fail, ok } from "@/lib/server/api-response";
import { toSafeErrorMessage } from "@/lib/server/safe-error";

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
    const result = await previewProductBulkImport(readBulkFile(formData));

    return ok(result);
  } catch (error) {
    const authResponse = apiAuthenticationErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return fail(
      toSafeErrorMessage(error, {
        context: "api.products.bulk-preview",
        fallbackMessage: "Preview bulk import gagal.",
      }),
      400,
    );
  }
}
