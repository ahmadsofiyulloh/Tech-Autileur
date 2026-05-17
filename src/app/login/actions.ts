"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/supabase/config";

export type AuthActionState = {
  error: string | null;
  message: string | null;
};

const initialState: AuthActionState = {
  error: null,
  message: null,
};

const invalidLoginMessage = "Email atau password tidak valid.";
function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function readOwnerEmail() {
  const ownerEmail = process.env.OWNER_EMAIL ?? process.env.APP_OWNER_EMAIL;

  if (!ownerEmail?.trim()) {
    throw new Error("Missing required environment variable: OWNER_EMAIL");
  }

  return normalizeEmail(ownerEmail);
}

function canUseLocalSignup() {
  return process.env.NODE_ENV !== "production" && process.env.MOCK_MODE === "true";
}

export async function authenticate(
  _previousState: AuthActionState = initialState,
  formData: FormData,
): Promise<AuthActionState> {
  const intent = readFormValue(formData, "intent");
  const email = readFormValue(formData, "email");
  const password = readFormValue(formData, "password");
  const normalizedEmail = normalizeEmail(email);

  if (!email || !password) {
    return {
      error: "Email dan password wajib diisi.",
      message: null,
    };
  }

  if (password.length < 6) {
    return {
      error: invalidLoginMessage,
      message: null,
    };
  }

  if (normalizedEmail !== readOwnerEmail()) {
    return {
      error: invalidLoginMessage,
      message: null,
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!intent || intent === "login") {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return {
        error: invalidLoginMessage,
        message: null,
      };
    }

    redirect("/products/new");
  }

  if (intent === "signup" && canUseLocalSignup()) {
    const redirectUrl = new URL("/auth/confirm", getAppUrl()).toString();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      return {
        error: invalidLoginMessage,
        message: null,
      };
    }

    if (data.session) {
      redirect("/products/new");
    }

    return {
      error: null,
      message: "Cek email untuk konfirmasi akun lokal.",
    };
  }

  return {
    error: invalidLoginMessage,
    message: null,
  };
}
