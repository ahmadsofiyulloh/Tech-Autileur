import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GeminiSettingsBoard, type GeminiKeyRecord } from "./gemini-settings-board";

export const revalidate = 60;

export default async function GeminiSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: geminiKeys, error } = await supabase
    .from("gemini_api_keys")
    .select(
      "id, label, provider, google_account_label, project_label, model_name, role, rpm_limit, rpd_limit, tpm_limit, status, requests_today, last_used_at, cooldown_until, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .neq("status", "DISABLED")
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <SectionCard icon={KeyRound} title="Gemini unavailable." description={error.message}>
        <EmptyState icon={KeyRound} title="Gemini unavailable." description="Coba lagi." />
      </SectionCard>
    );
  }

  return (
    <div className="stack settings-page-body settings-page-body--wide">
      <GeminiSettingsBoard geminiKeys={(geminiKeys ?? []) as GeminiKeyRecord[]} />
    </div>
  );
}
