import { redirect } from "next/navigation";
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
      <SectionCard badge="Dashboard error" title="Unable to load the protected profile." description={profileError.message}>
        <EmptyState
          title="Profile data is unavailable."
          description="The bootstrap record should exist for the signed-in owner. Reload after confirming the account if the row is still warming up."
        />
      </SectionCard>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        badge="Protected route"
        eyebrow="Affiliate AI Content OS"
        title="Signed-in control surface is scaffolded."
        description="This page stays intentionally small. Sprint 1 authenticates the owner and bootstraps the profile row."
        actions={
          <form action="/auth/signout" method="post">
            <button className="button primary" type="submit">
              Sign out
            </button>
          </form>
        }
        stats={[
          { label: "User", value: profile?.email ?? user.email ?? "Signed in" },
          { label: "Timezone", value: profile?.timezone ?? "Asia/Jakarta" },
          { label: "Access", value: <StatusBadge status="Owner only" tone="success" /> },
        ]}
      />

      <SectionCard badge="Profile bootstrap" title="No operational data exists yet.">
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
            title="Profile row not visible yet."
            description="The auth bootstrap trigger should create this row automatically for the signed-in owner."
          />
        )}
      </SectionCard>
    </div>
  );
}
