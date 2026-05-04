import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { SettingsSectionNav } from "../settings-section-nav";
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

  return (
    <div className="stack">
      <SettingsSectionNav />

      <SectionCard
        icon={KeyRound}
        title="Gemini"
        actions={
          <Link className="button primary" href="/gemini">
            <ArrowRight size={16} aria-hidden="true" />
            Open
          </Link>
        }
      >
        <StatusBadge status="Configured in Gemini section" tone="info" />
      </SectionCard>
    </div>
  );
}
