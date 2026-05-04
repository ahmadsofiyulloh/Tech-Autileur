import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleDriveOAuthCode, getGoogleDriveAccountInfo } from "@/lib/server/google-drive";
import { saveGoogleDriveConnection } from "@/lib/server/google-drive-connections";

const STATE_COOKIE = "google_drive_oauth_state";

function redirectToSettings(request: NextRequest, key: "error" | "message", message: string) {
  const url = new URL("/settings", request.url);
  url.searchParams.set(key, message);
  const response = NextResponse.redirect(url);

  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/api/google-drive/oauth",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const error = searchParams.get("error");

    if (error) {
      throw new Error(error);
    }

    const code = searchParams.get("code")?.trim();
    const state = searchParams.get("state")?.trim();
    const expectedState = request.cookies.get(STATE_COOKIE)?.value;

    if (!code) {
      throw new Error("Google Drive OAuth code missing.");
    }

    if (!state || !expectedState || state !== expectedState) {
      throw new Error("Google Drive OAuth state tidak valid.");
    }

    const tokenResult = await exchangeGoogleDriveOAuthCode(code);
    const account = await getGoogleDriveAccountInfo(tokenResult.accessToken).catch(() => ({
      email: null,
      label: null,
    }));

    await saveGoogleDriveConnection({
      googleAccountEmail: account.email,
      googleAccountLabel: account.label,
      refreshToken: tokenResult.refreshToken,
      scopes: tokenResult.scopes,
      status: "CONNECTED",
    });

    return redirectToSettings(request, "message", "Google Drive connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Drive connection failed.";
    return redirectToSettings(request, "error", message);
  }
}
