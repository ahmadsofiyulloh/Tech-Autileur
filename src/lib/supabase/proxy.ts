import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

const protectedRoutes = [
  "/",
  "/dashboard",
  "/gemini",
  "/drive",
  "/products",
  "/prompts",
  "/settings",
  "/intake",
  "/outputs",
  "/flow",
  "/controller",
];
const loginRoutes = ["/login"];
const publicAuthRoutes = ["/auth/confirm"];

function startsWithRoute(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isPublicRoute(pathname: string) {
  return startsWithRoute(pathname, publicAuthRoutes);
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = startsWithRoute(pathname, protectedRoutes);
  const isLoginRoute = startsWithRoute(pathname, loginRoutes);
  const shouldCheckSession = isProtectedRoute || isLoginRoute;

  if (!shouldCheckSession || isPublicRoute(pathname)) {
    return NextResponse.next({
      request,
    });
  }

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

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims) && !error;

  if (!isAuthenticated && isProtectedRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthenticated && isLoginRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
