"use server";

import { revalidatePath } from "next/cache";
import {
  createMagnificKey,
  disableMagnificKey,
  testMagnificConnection,
  updateMagnificKey,
} from "@/lib/server/ai-media/keys";

export type MagnificSaveResult = {
  success: boolean;
  error?: string;
};

export type MagnificTestResult = {
  success: boolean;
  error?: string;
};

export async function saveMagnificKeyAction(formData: FormData): Promise<MagnificSaveResult> {
  const intent = (formData.get("intent") as string | null)?.trim() ?? "create";
  const label = (formData.get("label") as string | null)?.trim() ?? "";
  const rawApiKey = (formData.get("api_key") as string | null)?.trim() ?? "";
  const existingKeyId = (formData.get("key_id") as string | null)?.trim() ?? "";

  // --- Disable intent ---
  if (intent === "disable") {
    if (!existingKeyId) {
      return { success: false, error: "Key ID diperlukan." };
    }
    const result = await disableMagnificKey({ keyId: existingKeyId });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    revalidatePath("/settings/magnific");
    revalidatePath("/settings");
    return { success: true };
  }

  // --- Update intent ---
  if (intent === "update") {
    if (!existingKeyId) {
      return { success: false, error: "Key ID diperlukan." };
    }
    if (!label) {
      return { success: false, error: "Nama key wajib." };
    }
    const result = await updateMagnificKey({
      keyId: existingKeyId,
      label,
      rawApiKey: rawApiKey.length >= 8 ? rawApiKey : null,
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    revalidatePath("/settings/magnific");
    revalidatePath("/settings");
    return { success: true };
  }

  // --- Create intent (default) ---
  if (!label) {
    return { success: false, error: "Nama key wajib." };
  }
  if (rawApiKey.length < 8) {
    return { success: false, error: "API key tidak valid." };
  }

  const result = await createMagnificKey({ label, rawApiKey });
  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/settings/magnific");
  revalidatePath("/settings");
  return { success: true };
}

export async function testMagnificKeyAction(formData: FormData): Promise<MagnificTestResult> {
  const keyId = (formData.get("key_id") as string | null)?.trim() ?? "";

  if (!keyId) {
    return { success: false, error: "Simpan key terlebih dahulu." };
  }

  const result = await testMagnificConnection({ keyId });
  revalidatePath("/settings/magnific");
  return result;
}
