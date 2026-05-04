import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildGoogleDriveAuthorizationUrl } from "@/lib/server/google-drive";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STATE_COOKIE = "google_drive_oauth_state";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(buildGoogleDriveAuthorizationUrl(state));

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/api/google-drive/oauth",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
