import { NextRequest, NextResponse } from "next/server";
import { processHelperCallback } from "@/lib/server/helper-callback";

function readBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");

  if (!header) {
    throw new Error("Authorization header wajib diisi.");
  }

  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new Error("Authorization header harus memakai Bearer token.");
  }

  const token = match[1].trim();

  if (!token) {
    throw new Error("Bearer token wajib diisi.");
  }

  return token;
}

export async function POST(request: NextRequest) {
  try {
    const token = readBearerToken(request);
    const payload = await request.json();
    const result = await processHelperCallback(token, payload);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Helper callback gagal.";
    const status = message.includes("token") ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
