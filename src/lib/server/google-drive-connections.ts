import "server-only";

import { revalidatePath } from "next/cache.js";
import { decryptGoogleDriveRefreshToken, encryptGoogleDriveRefreshToken } from "@/lib/server/google-drive-crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const GOOGLE_DRIVE_CONNECTION_SCOPES = ["https://www.googleapis.com/auth/drive.file"] as const;

export type GoogleDriveConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";

export type GoogleDriveConnectionRecord = {
  id: string;
  user_id: string;
  provider: "google_drive";
  google_account_email: string | null;
  google_account_label: string | null;
  scopes: string[];
  encrypted_refresh_token: string | null;
  status: GoogleDriveConnectionStatus;
  last_connected_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveGoogleDriveConnectionInput = {
  refreshToken?: string | null;
  googleAccountEmail?: string | null;
  googleAccountLabel?: string | null;
  scopes?: readonly string[] | null;
  status?: GoogleDriveConnectionStatus;
  lastError?: string | null;
};

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : "Google Drive connection failed.";
}

export function isGoogleDriveConnectionSchemaMissingError(error: unknown) {
  const message = errorMessage(error).toLowerCase();

  return (
    errorCode(error) === "42P01" ||
    (message.includes("relation") && message.includes("google_drive_connections") && message.includes("does not exist"))
  );
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

function normalizeStoredError(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 500) || "Google Drive connection failed.";
}

export function normalizeGoogleDriveScopes(value: string | readonly string[] | null | undefined) {
  const scopes = typeof value === "string" ? value.split(/\s+/) : value ?? [];

  return [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))];
}

export function hasRequiredGoogleDriveScopes(scopes: string | readonly string[] | null | undefined) {
  const normalizedScopes = new Set(normalizeGoogleDriveScopes(scopes));
  return GOOGLE_DRIVE_CONNECTION_SCOPES.every((scope) => normalizedScopes.has(scope));
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, user };
}

export async function getGoogleDriveConnection() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("google_drive_connections")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as GoogleDriveConnectionRecord | null;
}

export async function getActiveGoogleDriveRefreshToken() {
  const connection = await getGoogleDriveConnection();

  if (connection?.status !== "CONNECTED" || !connection.encrypted_refresh_token) {
    return null;
  }

  return decryptGoogleDriveRefreshToken(connection.encrypted_refresh_token);
}

export async function saveGoogleDriveConnection(input: SaveGoogleDriveConnectionInput) {
  const { supabase, user } = await requireUser();
  const existing = await getGoogleDriveConnection().catch((error) => {
    if (isGoogleDriveConnectionSchemaMissingError(error)) {
      throw error;
    }

    throw new Error(errorMessage(error));
  });
  const encryptedRefreshToken =
    input.refreshToken ? encryptGoogleDriveRefreshToken(input.refreshToken) : existing?.encrypted_refresh_token ?? null;
  const status = input.status ?? "CONNECTED";
  const scopes = normalizeGoogleDriveScopes(
    input.scopes?.length ? input.scopes : existing?.scopes?.length ? existing.scopes : GOOGLE_DRIVE_CONNECTION_SCOPES,
  );

  if (status === "CONNECTED" && !encryptedRefreshToken) {
    throw new Error("Google Drive did not return a refresh token. Reconnect with consent first.");
  }

  if (status === "CONNECTED" && !hasRequiredGoogleDriveScopes(scopes)) {
    throw new Error("Google Drive OAuth scope tidak lengkap. Hubungkan ulang Drive dan izinkan akses file.");
  }

  const payload = {
    user_id: user.id,
    provider: "google_drive",
    google_account_email: normalizeNullableText(input.googleAccountEmail) ?? existing?.google_account_email ?? null,
    google_account_label: normalizeNullableText(input.googleAccountLabel) ?? existing?.google_account_label ?? null,
    scopes,
    encrypted_refresh_token: encryptedRefreshToken,
    status,
    last_connected_at: status === "CONNECTED" ? new Date().toISOString() : existing?.last_connected_at ?? null,
    last_error: normalizeNullableText(input.lastError),
  };

  const { data, error } = await supabase
    .from("google_drive_connections")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/drive");
  return data as GoogleDriveConnectionRecord;
}

export async function markGoogleDriveConnectionError(message: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("google_drive_connections")
    .update({
      status: "ERROR",
      last_error: normalizeStoredError(message),
    })
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/drive");
  return (data ?? null) as GoogleDriveConnectionRecord | null;
}

export async function disconnectGoogleDriveConnection() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("google_drive_connections")
    .upsert(
      {
        user_id: user.id,
        provider: "google_drive",
        encrypted_refresh_token: null,
        status: "DISCONNECTED",
        last_error: null,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/drive");
  return data as GoogleDriveConnectionRecord;
}
