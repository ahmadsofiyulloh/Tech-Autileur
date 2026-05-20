import { KeyRound } from "lucide-react";
import { redirect } from "next/navigation";
import { SectionCard } from "@/components/operator/section-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MagnificSettingsForm } from "./magnific-settings-form";

export const dynamic = "force-dynamic";

export default async function MagnificSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="stack settings-page-body">
      <SectionCard icon={KeyRound} title="Magnific">
        <MagnificSettingsForm />
      </SectionCard>
    </div>
  );
}
