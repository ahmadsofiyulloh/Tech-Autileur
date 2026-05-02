import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const shouldCheckUser =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/gemini") ||
    pathname.startsWith("/drive") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/prompts") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth");

  if (shouldCheckUser) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (
      !user &&
      (pathname.startsWith("/dashboard") ||
        pathname.startsWith("/gemini") ||
        pathname.startsWith("/drive") ||
        pathname.startsWith("/products") ||
        pathname.startsWith("/prompts"))
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    if (user && pathname.startsWith("/login")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
