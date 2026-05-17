import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/drive/:path*",
    "/products/:path*",
    "/prompts/:path*",
    "/settings/:path*",
    "/controller/:path*",
    "/flow/:path*",
    "/outputs/:path*",
    "/gemini/:path*",
    "/intake/:path*",
    "/login",
    "/auth/confirm",
  ],
};
