import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="stack">
      <section className="hero">
        <div className="chip">Protected route</div>
        <div className="stack">
          <p className="eyebrow">Dashboard placeholder</p>
          <h2>Signed-in control surface is scaffolded.</h2>
          <p>
            This page is intentionally minimal. Sprint 1 will add authentication flows and real workspace modules.
          </p>
        </div>
        <div className="metric-grid">
          <div className="metric">
            <span>User</span>
            <strong>{user.email ?? "Signed in"}</strong>
          </div>
          <div className="metric">
            <span>State</span>
            <strong>Placeholder</strong>
          </div>
          <div className="metric">
            <span>Scope</span>
            <strong>Sprint 0</strong>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div>
          <p className="eyebrow">Empty state</p>
          <h3>No operational data exists yet.</h3>
        </div>
        <div className="muted-box">
          <p>
            This dashboard is protected, but the product modules, database schema, and production flows are still
            deferred to later sprints.
          </p>
        </div>
        <ul className="list" aria-label="Planned modules">
          <li>
            <span>Gemini manager</span>
            <span className="subtle">Sprint 2</span>
          </li>
          <li>
            <span>Drive manager</span>
            <span className="subtle">Sprint 4</span>
          </li>
          <li>
            <span>Prompt pipeline</span>
            <span className="subtle">Sprint 6</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
