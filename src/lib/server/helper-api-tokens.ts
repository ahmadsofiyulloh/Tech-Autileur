import "server-only";

import { createHash } from "node:crypto";
import { HELPER_API_TOKEN_CODE } from "@/lib/helper-api-tokens";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type HelperApiTokenRecord = {
  id: string;
  user_id: string;
  token_code: string;
  status: string;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

const PUBLIC_HELPER_API_TOKEN_SELECT = "id, user_id, token_code, status, last_used_at, created_at, updated_at";

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : "Helper token operation failed.";
}

export function isHelperApiTokenSchemaMissingError(error: unknown) {
  const message = errorMessage(error).toLowerCase();

  return (
    errorCode(error) === "42P01" ||
    errorCode(error) === "42704" ||
    message.includes("helper api token schema is not applied") ||
    (message.includes("relation") && message.includes("helper_api_tokens") && message.includes("does not exist")) ||
    (message.includes("type") && message.includes("helper_api_tokens") && message.includes("does not exist"))
  );
}

function helperApiTokenSchemaMissingError() {
  return new Error("Helper API token schema is not applied yet. Apply the S6 migration first.");
}

function throwHelperApiTokenError(error: unknown): never {
  if (isHelperApiTokenSchemaMissingError(error)) {
    throw helperApiTokenSchemaMissingError();
  }

  throw new Error(errorMessage(error));
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

export function hashHelperApiToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function getHelperApiToken() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("helper_api_tokens")
    .select(PUBLIC_HELPER_API_TOKEN_SELECT)
    .eq("user_id", user.id)
    .eq("token_code", HELPER_API_TOKEN_CODE)
    .maybeSingle();

  if (error) {
    throwHelperApiTokenError(error);
  }

  return (data ?? null) as HelperApiTokenRecord | null;
}

export async function upsertHelperApiToken(input: { tokenCode?: string; rawToken: string }) {
  const { supabase, user } = await requireUser();
  const tokenCode = (input.tokenCode || HELPER_API_TOKEN_CODE).trim() || HELPER_API_TOKEN_CODE;
  const tokenHash = hashHelperApiToken(input.rawToken);

  const { data, error } = await supabase
    .from("helper_api_tokens")
    .upsert(
      {
        user_id: user.id,
        token_code: tokenCode,
        token_hash: tokenHash,
        status: "ACTIVE",
      },
      {
        onConflict: "user_id,token_code",
      },
    )
    .select(PUBLIC_HELPER_API_TOKEN_SELECT)
    .single();

  if (error) {
    throwHelperApiTokenError(error);
  }

  return data as HelperApiTokenRecord;
}

export async function disableHelperApiToken(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("helper_api_tokens")
    .update({ status: "DISABLED" })
    .eq("id", id)
    .eq("user_id", user.id)
    .select(PUBLIC_HELPER_API_TOKEN_SELECT)
    .single();

  if (error) {
    throwHelperApiTokenError(error);
  }

  return data as HelperApiTokenRecord;
}
