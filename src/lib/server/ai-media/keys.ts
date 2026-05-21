import "server-only";

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

import { isEncryptionAuthenticationError } from "@/lib/server/encryption-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import type { AiMediaKeyMetadataProjection, ExternalApiKeyRow } from "./contracts";
import { testMagnificApiKey } from "./magnific-client";
import { projectKeyMetadata } from "./projections";

// =============================================================================
// Encryption (same AES-256-GCM pattern as gemini-crypto.ts)
// =============================================================================

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;

function normalizeKeyMaterial(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Missing required environment variable: APP_ENCRYPTION_KEY");

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  if (/^[A-Za-z0-9+/=_-]+$/.test(trimmed)) {
    const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
    const buffer = Buffer.from(normalized, "base64");
    if (buffer.length === KEY_BYTES) return buffer;
  }

  throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes.");
}

function getEncryptionKey() {
  const rawKey = process.env.APP_ENCRYPTION_KEY;
  if (!rawKey) throw new Error("Missing required environment variable: APP_ENCRYPTION_KEY");
  const key = normalizeKeyMaterial(rawKey);
  if (key.length !== KEY_BYTES) throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes.");
  return key;
}

function encryptExternalApiKey(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptExternalApiKey(payload: string): string {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(":");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Invalid encrypted external API key payload.");
  }
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

// =============================================================================
// Key Code Generation
// =============================================================================

function generateKeyCode(): string {
  return `ext_${randomBytes(8).toString("hex")}`;
}

// =============================================================================
// Key Snapshot (read)
// =============================================================================

export type MagnificKeySnapshot = {
  exists: boolean;
  key: AiMediaKeyMetadataProjection | null;
  keyId: string | null;
  label: string;
};

/**
 * Load the primary Magnific key metadata for the authenticated user.
 * If multiple keys exist, resolves the most recently updated ACTIVE one,
 * or the most recently updated one overall.
 */
export async function getMagnificKeySnapshot(): Promise<MagnificKeySnapshot> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { exists: false, key: null, keyId: null, label: "" };
  }

  const { data, error } = await supabase
    .from("external_api_keys")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "magnific")
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ExternalApiKeyRow[];
  if (!rows.length) {
    return { exists: false, key: null, keyId: null, label: "" };
  }

  const activeRow = rows.find((r) => r.status === "ACTIVE") ?? rows[0];
  return {
    exists: true,
    key: projectKeyMetadata(activeRow),
    keyId: activeRow.id,
    label: activeRow.label,
  };
}

// =============================================================================
// List All Keys (for settings board)
// =============================================================================

/**
 * Load all non-disabled Magnific keys for the authenticated user.
 * Returns projected metadata suitable for the settings UI.
 */
export async function listMagnificKeys(): Promise<AiMediaKeyMetadataProjection[]> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("external_api_keys")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "magnific")
    .neq("status", "DISABLED")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ExternalApiKeyRow[];
  return rows.map(projectKeyMetadata);
}

// =============================================================================
// Disable Key (soft-delete)
// =============================================================================

export async function disableMagnificKey(input: {
  keyId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Autentikasi diperlukan." };
  }

  const { error } = await supabase
    .from("external_api_keys")
    .update({ status: "DISABLED" })
    .eq("id", input.keyId)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================================================
// Create Key
// =============================================================================

export async function createMagnificKey(input: {
  label: string;
  rawApiKey: string;
}): Promise<{ success: true; key: AiMediaKeyMetadataProjection } | { success: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Autentikasi diperlukan." };
  }

  const keyCode = generateKeyCode();
  const encryptedApiKey = encryptExternalApiKey(input.rawApiKey);

  const { data: keyRow, error: keyError } = await supabase
    .from("external_api_keys")
    .insert({
      user_id: user.id,
      provider: "magnific",
      key_code: keyCode,
      label: input.label,
      status: "ACTIVE",
      requests_today: 0,
      metadata_json: {},
    })
    .select("*")
    .single();

  if (keyError) {
    return { success: false, error: keyError.message };
  }

  const row = keyRow as ExternalApiKeyRow;

  // Write encrypted secret using service role (secrets table denies authenticated access)
  const serviceClient = createSupabaseServiceRoleClient();
  const { error: secretError } = await serviceClient
    .from("external_api_key_secrets")
    .insert({
      user_id: user.id,
      external_api_key_id: row.id,
      encrypted_api_key: encryptedApiKey,
      encryption_version: "v1",
    });

  if (secretError) {
    // Roll back the key row if secret write fails
    await supabase.from("external_api_keys").delete().eq("id", row.id).eq("user_id", user.id);
    return { success: false, error: "Gagal menyimpan secret." };
  }

  return { success: true, key: projectKeyMetadata(row) };
}

// =============================================================================
// Update Key
// =============================================================================

export async function updateMagnificKey(input: {
  keyId: string;
  label: string;
  rawApiKey?: string | null;
}): Promise<{ success: true; key: AiMediaKeyMetadataProjection } | { success: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Autentikasi diperlukan." };
  }

  // Update metadata
  const { data: keyRow, error: keyError } = await supabase
    .from("external_api_keys")
    .update({ label: input.label })
    .eq("id", input.keyId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (keyError) {
    return { success: false, error: keyError.message };
  }

  const row = keyRow as ExternalApiKeyRow;

  // Replace secret only if a new raw API key is provided
  if (input.rawApiKey && input.rawApiKey.trim().length > 0) {
    const encryptedApiKey = encryptExternalApiKey(input.rawApiKey.trim());
    const serviceClient = createSupabaseServiceRoleClient();

    const { error: secretError } = await serviceClient
      .from("external_api_key_secrets")
      .upsert(
        {
          user_id: user.id,
          external_api_key_id: row.id,
          encrypted_api_key: encryptedApiKey,
          encryption_version: "v1",
        },
        { onConflict: "external_api_key_id" },
      );

    if (secretError) {
      return { success: false, error: "Gagal memperbarui secret." };
    }
  }

  return { success: true, key: projectKeyMetadata(row) };
}

// =============================================================================
// Test Connection (live Magnific validation)
// =============================================================================

export async function testMagnificConnection(input: {
  keyId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Autentikasi diperlukan." };
  }

  const serviceClient = createSupabaseServiceRoleClient();

  // Verify encrypted secret exists and is decryptable
  const { data: secretRow, error: secretError } = await serviceClient
    .from("external_api_key_secrets")
    .select("encrypted_api_key")
    .eq("external_api_key_id", input.keyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (secretError) {
    return { success: false, error: secretError.message };
  }

  if (!secretRow?.encrypted_api_key) {
    await supabase
      .from("external_api_keys")
      .update({ status: "ERROR", last_error_message: "Secret tidak ditemukan.", last_tested_at: new Date().toISOString() })
      .eq("id", input.keyId)
      .eq("user_id", user.id);
    return { success: false, error: "Secret tidak ditemukan." };
  }

  let rawApiKey: string;
  try {
    rawApiKey = decryptExternalApiKey(secretRow.encrypted_api_key);
  } catch (err) {
    const message = isEncryptionAuthenticationError(err)
      ? "Dekripsi gagal. Simpan ulang API key."
      : "Secret tidak valid.";
    await supabase
      .from("external_api_keys")
      .update({ status: "ERROR", last_error_message: message, last_tested_at: new Date().toISOString() })
      .eq("id", input.keyId)
      .eq("user_id", user.id);
    return { success: false, error: message };
  }

  const testResult = await testMagnificApiKey(rawApiKey);
  if (!testResult.success) {
    await supabase
      .from("external_api_keys")
      .update({
        status: testResult.error.retryable ? "COOLDOWN" : "ERROR",
        cooldown_until: testResult.error.retryable
          ? new Date(Date.now() + (testResult.error.retryAfterSeconds ?? 60) * 1000).toISOString()
          : null,
        last_error_message: testResult.error.message,
        last_tested_at: new Date().toISOString(),
      })
      .eq("id", input.keyId)
      .eq("user_id", user.id);
    return { success: false, error: testResult.error.message };
  }

  await supabase
    .from("external_api_keys")
    .update({ status: "ACTIVE", cooldown_until: null, last_error_message: null, last_tested_at: new Date().toISOString() })
    .eq("id", input.keyId)
    .eq("user_id", user.id);

  return { success: true };
}
