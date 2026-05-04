import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { GeminiSettingsBoard } from "./gemini-settings-board";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
      "id, label, provider, google_account_label, project_label, model_name, role, rpm_limit, rpd_limit, tpm_limit, status, updated_at",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <div className="stack">
        <SectionCard icon={KeyRound} title="Gemini" description="Kelola key server dan role analisis Gemini.">
          <EmptyState icon={KeyRound} title="Unable to load Gemini." description={error.message} />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="stack">
      <SectionCard icon={KeyRound} title="Gemini" description="Kelola key server dan role analisis Gemini.">
        <GeminiSettingsBoard geminiKeys={geminiKeys ?? []} />
      </SectionCard>
    </div>
  );
}
