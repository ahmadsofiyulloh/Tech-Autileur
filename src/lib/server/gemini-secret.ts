import "server-only";

import { decryptGeminiApiKey } from "@/lib/server/gemini-crypto";
import { isEncryptionAuthenticationError } from "@/lib/server/encryption-errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>;

export type GeminiSecretReadResult = {
  secret: string | null;
  decryptFailed: boolean;
};

export async function readGeminiSecretForKey(
  serviceClient: SupabaseServiceClient,
  userId: string,
  geminiKeyId: string,
) {
  const { data, error } = await serviceClient
    .from("gemini_api_key_secrets")
    .select("encrypted_api_key")
    .eq("gemini_api_key_id", geminiKeyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.encrypted_api_key) {
    return {
      secret: null,
      decryptFailed: false,
    } satisfies GeminiSecretReadResult;
  }

  try {
    return {
      secret: decryptGeminiApiKey(data.encrypted_api_key),
      decryptFailed: false,
    } satisfies GeminiSecretReadResult;
  } catch (error) {
    if (isEncryptionAuthenticationError(error)) {
      return {
        secret: null,
        decryptFailed: true,
      } satisfies GeminiSecretReadResult;
    }

    throw error;
  }
}

export function getGeminiSecretRotationErrorMessage() {
  return "Stored Gemini keys could not be decrypted. Re-save Gemini keys in Settings after APP_ENCRYPTION_KEY rotation.";
}
