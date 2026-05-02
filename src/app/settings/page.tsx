import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  FolderKanban,
  HardDrive,
  KeyRound,
  LogOut,
  Settings,
  SlidersHorizontal,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";
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
        description="Configuration hub for workspace placeholders, services, tools, profiles, and account."
        stats={[
          { label: "Gemini", value: <StatusBadge status="Active" tone="success" /> },
          { label: "Drive", value: <StatusBadge status="Ready" tone="success" /> },
          { label: "Owner", value: user.email ?? "Signed in" },
        ]}
      />

      <section className="grid two-up">
        <SectionCard icon={FolderKanban} title="Workspace Profiles" description="Placeholder only. No workspace schema exists yet.">
          <EmptyState
            icon={FolderKanban}
            title="Workspace/profile setup comes later."
            description="This will group products, niches, affiliate context, prompt personalization, and Drive root folders."
          />
        </SectionCard>

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

        <SectionCard icon={Workflow} title="Flow Accounts / Tools" description="Global execution tools, not workspace-bound.">
          <EmptyState
            icon={Workflow}
            title="Reserved for dynamic Flow tools."
            description="Flow accounts stay global per user and can execute prompts from any workspace or product."
          />
        </SectionCard>

        <SectionCard icon={Users} title="Affiliate Profiles" description="Placeholder only.">
          <EmptyState
            icon={Users}
            title="Reserved for dynamic affiliate profiles."
            description="Profiles must not be hardcoded. Workspace context will use these later."
          />
        </SectionCard>

        <SectionCard icon={SlidersHorizontal} title="Prompt Personalization" description="Placeholder only.">
          <EmptyState
            icon={SlidersHorizontal}
            title="Reserved for editable prompt rules."
            description="Seed character locks, environment locks, and prompt rule fields come after schema approval."
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
