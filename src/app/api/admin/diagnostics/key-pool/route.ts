import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: keys, error } = await supabase
    .from("gemini_api_keys")
    .select("id, role, status, model_name, cooldown_until, last_used_at, rpm_limit, rpd_limit, tpm_limit")
    .eq("user_id", user.id)
    .order("status", { ascending: true })
    .order("last_used_at", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (keys ?? []).map((key) => ({
    id: key.id,
    role: key.role,
    status: key.status,
    model: key.model_name,
    cooldownUntil: key.cooldown_until,
    lastUsedAt: key.last_used_at,
    quotaLimits: { rpm: key.rpm_limit, rpd: key.rpd_limit, tpm: key.tpm_limit },
  }));

  const summary = {
    active: rows.filter((k) => k.status === "ACTIVE").length,
    cooldown: rows.filter((k) => k.status === "RATE_LIMITED" || k.status === "COOLDOWN").length,
    error: rows.filter((k) => k.status === "ERROR").length,
    total: rows.length,
  };

  return NextResponse.json({ keys: rows, summary });
}
