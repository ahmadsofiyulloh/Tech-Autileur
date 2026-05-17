import "server-only";

import { unauthorized } from "@/lib/server/api-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ApiUser = NonNullable<Awaited<ReturnType<SupabaseServerClient["auth"]["getUser"]>>["data"]["user"]>;

export const API_AUTHENTICATION_ERROR_MESSAGE = "Authentication required.";

export class ApiAuthenticationError extends Error {
  constructor() {
    super(API_AUTHENTICATION_ERROR_MESSAGE);
    this.name = "ApiAuthenticationError";
  }
}

export function apiUnauthorizedResponse() {
  return unauthorized();
}

export function apiAuthenticationErrorResponse(error: unknown) {
  if (error instanceof ApiAuthenticationError) {
    return apiUnauthorizedResponse();
  }

  if (error instanceof Error && error.message === API_AUTHENTICATION_ERROR_MESSAGE) {
    return apiUnauthorizedResponse();
  }

  return null;
}

export async function requireApiUser(): Promise<{ supabase: SupabaseServerClient; user: ApiUser }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiAuthenticationError();
  }

  return { supabase, user };
}
