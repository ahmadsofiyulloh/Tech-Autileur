import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, HardDrive, KeyRound, LogOut, Settings, UserRound, Users, Workflow } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="stack">
      <PageHeader
        icon={Settings}
        badge="Config"
        title="Settings"
        description="Keys, Drive, accounts, and session."
        stats={[
          { label: "Gemini", value: <StatusBadge status="Active" tone="success" /> },
          { label: "Drive", value: <StatusBadge status="Ready" tone="success" /> },
          { label: "Owner", value: user.email ?? "Signed in" },
        ]}
      />

      <section className="grid two-up">
        <SectionCard
          icon={KeyRound}
          title="Gemini"
          description="Keys, models, and roles."
          actions={
            <Link className="button primary" href="/gemini">
              <ArrowRight size={16} aria-hidden="true" />
              Open
            </Link>
          }
        >
          <StatusBadge status="Configured here" tone="info" />
        </SectionCard>

        <SectionCard
          icon={HardDrive}
          title="Drive"
          description="Folders, files, and links."
          actions={
            <Link className="button primary" href="/drive">
              <ArrowRight size={16} aria-hidden="true" />
              Open
            </Link>
          }
        >
          <StatusBadge status="Configured here" tone="info" />
        </SectionCard>

        <SectionCard icon={Workflow} title="Flow accounts" description="Not active yet.">
          <EmptyState
            icon={Workflow}
            title="Reserved"
            description="Add accounts later."
          />
        </SectionCard>

        <SectionCard icon={Users} title="Affiliate accounts" description="Not active yet.">
          <EmptyState
            icon={Users}
            title="Reserved"
            description="Links and accounts come later."
          />
        </SectionCard>

        <SectionCard icon={UserRound} title="Account" description={user.email ?? "Signed in"}>
          <FormActions>
            <form action="/auth/signout" method="post">
              <button className="button" type="submit">
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </button>
            </form>
          </FormActions>
        </SectionCard>
      </section>
    </div>
  );
}
