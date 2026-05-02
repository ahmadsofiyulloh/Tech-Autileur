import { redirect } from "next/navigation";
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
      <section className="error-box stack" role="alert">
        <div className="stack">
          <p className="eyebrow">Dashboard error</p>
          <h2>Unable to load the protected profile.</h2>
          <p>{profileError.message}</p>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="hero">
        <div className="chip">Protected route</div>
        <div className="stack">
          <p className="eyebrow">Dashboard placeholder</p>
          <h2>Signed-in control surface is scaffolded.</h2>
          <p>
            This page is intentionally minimal. Sprint 1 now authenticates the owner and bootstraps the profile row.
          </p>
        </div>
        <div className="metric-grid">
          <div className="metric">
            <span>User</span>
            <strong>{profile?.email ?? user.email ?? "Signed in"}</strong>
          </div>
          <div className="metric">
            <span>Timezone</span>
            <strong>{profile?.timezone ?? "Asia/Jakarta"}</strong>
          </div>
          <div className="metric">
            <span>Scope</span>
            <strong>Sprint 1</strong>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div>
          <p className="eyebrow">Profile bootstrap</p>
          <h3>No operational data exists yet.</h3>
        </div>
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
          <div className="muted-box">
            <p>
              The auth bootstrap trigger should create this row automatically for the signed-in owner. Refresh after
              confirming the account if the row is still warming up.
            </p>
          </div>
        )}
        <form action="/auth/signout" method="post">
          <button className="button primary" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
