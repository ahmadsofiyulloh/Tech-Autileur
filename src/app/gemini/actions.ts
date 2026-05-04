"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { encryptGeminiApiKey } from "@/lib/server/gemini-crypto";
import {
  ACCOUNT_STATUSES,
  GEMINI_KEY_ROLES,
  GEMINI_MODELS,
  isAccountStatus,
  isGeminiKeyRole,
  isGeminiModelName,
} from "@/lib/gemini/validation";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(`/settings/gemini?error=${encodeURIComponent(message)}`);
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

async function restoreSecretRow(
  serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>,
  keyId: string,
  userId: string,
  encryptedApiKey: string | null,
) {
  if (!encryptedApiKey) {
    await serviceClient.from("gemini_api_key_secrets").delete().eq("gemini_api_key_id", keyId).eq("user_id", userId);
    return;
  }

  await serviceClient.from("gemini_api_key_secrets").upsert(
    {
      gemini_api_key_id: keyId,
      user_id: userId,
      encrypted_api_key: encryptedApiKey,
    },
    {
      onConflict: "gemini_api_key_id",
    },
  );
}

function readModelName(value: string) {
  if (!isGeminiModelName(value)) {
    fail(`Model must be one of: ${GEMINI_MODELS.join(", ")}.`);
  }

  return value;
}

function readRole(value: string) {
  if (!isGeminiKeyRole(value)) {
    fail(`Role must be one of: ${GEMINI_KEY_ROLES.join(", ")}.`);
  }

  return value;
}

function readStatus(value: string) {
  if (!value) {
    return "ACTIVE";
  }

  if (!isAccountStatus(value)) {
    fail(`Status must be one of: ${ACCOUNT_STATUSES.join(", ")}.`);
  }

  return value;
}

function parseOptionalInt(value: string, fieldName: string) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    fail(`${fieldName} must be a non-negative integer.`);
  }

  return parsed;
}

function buildGeminiKeyCode(value: string) {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();

  return normalized ? `${normalized.toUpperCase()}-${suffix}` : `GEMINI-${suffix}`;
}

export async function saveGeminiKey(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");
  const label = readText(formData, "label") || readText(formData, "name");
  const googleAccountLabel = readText(formData, "google_account_label");
  const projectLabel = readText(formData, "project_label");
  const modelName = readText(formData, "model_name") || readText(formData, "model");
  const role = readText(formData, "role") || readText(formData, "purpose");
  const status = readText(formData, "status");
  const rawApiKey = readText(formData, "raw_api_key");
  const rpmLimit = parseOptionalInt(readText(formData, "rpm_limit"), "RPM limit");
  const rpdLimit = parseOptionalInt(readText(formData, "rpd_limit"), "RPD limit");
  const tpmLimit = parseOptionalInt(readText(formData, "tpm_limit"), "TPM limit");

  const { supabase, user } = await requireUser();
  const serviceClient = createSupabaseServiceRoleClient();

  if (intent === "disable") {
    if (!id) {
      fail("Missing Gemini key id.");
    }

    const { error } = await supabase
      .from("gemini_api_keys")
      .update({ status: "DISABLED" })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      fail(error.message);
    }

    revalidatePath("/settings/gemini");
    redirect("/settings/gemini?message=Gemini key disabled");
  }

  if (intent !== "create" && intent !== "update") {
    fail("Unsupported Gemini action.");
  }

  if (!label) {
    fail("Label is required.");
  }

  if (!modelName) {
    fail("Model name is required.");
  }

  if (!role) {
    fail("Role is required.");
  }

  if (rawApiKey.length === 0 && intent === "create") {
    fail("Raw API key is required on create.");
  }

  const normalizedModel = readModelName(modelName);
  const normalizedRole = readRole(role);
  const normalizedStatus = readStatus(status);

  if (intent === "create") {
    const normalizedKeyCode = buildGeminiKeyCode(label);
    const encryptedApiKey = encryptGeminiApiKey(rawApiKey);
    const { data: createdKey, error: createError } = await supabase
      .from("gemini_api_keys")
      .insert({
        user_id: user.id,
        key_code: normalizedKeyCode,
        label,
        provider: "gemini",
        google_account_label: googleAccountLabel || null,
        project_label: projectLabel || null,
        model_name: normalizedModel,
        role: normalizedRole,
        rpm_limit: rpmLimit,
        rpd_limit: rpdLimit,
        tpm_limit: tpmLimit,
        status: normalizedStatus,
      })
      .select("id")
      .single();

    if (createError || !createdKey) {
      fail(createError?.message ?? "Unable to create Gemini key.");
    }

    const { error: secretError } = await serviceClient.from("gemini_api_key_secrets").insert({
      gemini_api_key_id: createdKey.id,
      user_id: user.id,
      encrypted_api_key: encryptedApiKey,
    });

    if (secretError) {
      await supabase
        .from("gemini_api_keys")
        .update({ status: "ERROR" })
        .eq("id", createdKey.id)
        .eq("user_id", user.id);
      fail(secretError.message);
    }

    revalidatePath("/settings/gemini");
    redirect("/settings/gemini?message=Gemini key created");
  }

  if (!id) {
    fail("Missing Gemini key id.");
  }

  const { data: existingKey, error: existingError } = await supabase
    .from("gemini_api_keys")
    .select("id, user_id, key_code")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    fail(existingError.message);
  }

  if (!existingKey) {
    fail("Gemini key not found.");
  }

  const { data: existingSecret } = await serviceClient
    .from("gemini_api_key_secrets")
    .select("encrypted_api_key")
    .eq("gemini_api_key_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const nextSecret = rawApiKey ? encryptGeminiApiKey(rawApiKey) : null;

  if (nextSecret) {
    const { error: secretUpsertError } = await serviceClient.from("gemini_api_key_secrets").upsert(
      {
        gemini_api_key_id: id,
        user_id: user.id,
        encrypted_api_key: nextSecret,
      },
      {
        onConflict: "gemini_api_key_id",
      },
    );

    if (secretUpsertError) {
      fail(secretUpsertError.message);
    }
  }

  const { error: updateError } = await supabase
    .from("gemini_api_keys")
    .update({
      key_code: existingKey.key_code || buildGeminiKeyCode(label),
      label,
      provider: "gemini",
      google_account_label: googleAccountLabel || null,
      project_label: projectLabel || null,
      model_name: normalizedModel,
      role: normalizedRole,
      rpm_limit: rpmLimit,
      rpd_limit: rpdLimit,
      tpm_limit: tpmLimit,
      status: normalizedStatus,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) {
    if (nextSecret) {
      await restoreSecretRow(serviceClient, id, user.id, existingSecret?.encrypted_api_key ?? null);
    }

    fail(updateError.message);
  }

  revalidatePath("/settings/gemini");
  redirect("/settings/gemini?message=Gemini key updated");
}
