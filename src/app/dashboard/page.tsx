import { redirect } from "next/navigation";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, timezone, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return (
      <SectionCard icon={LayoutDashboard} badge="Error" title="Dashboard unavailable." description={profileError.message}>
        <EmptyState
          icon={UserRound}
          title="Profile unavailable."
          description="Reload after sign-in."
        />
      </SectionCard>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        icon={LayoutDashboard}
        badge="Today"
        title="Dashboard"
        description="Owner status and quick account check."
        actions={
          <form action="/auth/signout" method="post">
            <button className="button primary" type="submit">
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </form>
        }
        stats={[
          { label: "User", value: profile?.email ?? user.email ?? "Signed in" },
          { label: "Timezone", value: profile?.timezone ?? "Asia/Jakarta" },
          { label: "Access", value: <StatusBadge status="Owner" tone="success" /> },
        ]}
      />

      <SectionCard icon={UserRound} title="Profile">
        {profile ? (
          <ul className="list" aria-label="Protected profile details">
            <li>
              <span>Profile ID</span>
              <span className="subtle">{profile.id}</span>
            </li>
            <li>
              <span>Email</span>
              <span className="subtle">{profile.email ?? "Not set"}</span>
            </li>
            <li>
              <span>Timezone</span>
              <span className="subtle">{profile.timezone}</span>
            </li>
          </ul>
        ) : (
          <EmptyState
            icon={UserRound}
            title="Profile not visible."
            description="Reload after sign-in."
          />
        )}
      </SectionCard>
    </div>
  );
}
