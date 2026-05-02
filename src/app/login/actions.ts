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

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export async function authenticate(
  _previousState: AuthActionState = initialState,
  formData: FormData,
): Promise<AuthActionState> {
  const intent = readFormValue(formData, "intent");
  const email = readFormValue(formData, "email");
  const password = readFormValue(formData, "password");

  if (!email || !password) {
    return {
      error: "Email and password are required.",
      message: null,
    };
  }

  if (password.length < 6) {
    return {
      error: "Password must be at least 6 characters.",
      message: null,
    };
  }

  const supabase = await createSupabaseServerClient();

  if (intent === "login") {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        error: error.message,
        message: null,
      };
    }

    redirect("/dashboard");
  }

  if (intent === "signup") {
    const redirectUrl = new URL("/auth/confirm", getAppUrl()).toString();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      return {
        error: error.message,
        message: null,
      };
    }

    if (data.session) {
      redirect("/dashboard");
    }

    return {
      error: null,
      message: "Check your email to confirm the new account.",
    };
  }

  return {
    error: "Choose either sign in or create account.",
    message: null,
  };
}
