import Link from "next/link";
import { redirect } from "next/navigation";
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
        badge="Settings"
        eyebrow="Configuration"
        title="Operator settings"
        description="Manage the services and accounts that support production. Feature work stays on the main workflow routes."
        stats={[
          { label: "Gemini", value: <StatusBadge status="Active manager" tone="success" /> },
          { label: "Drive", value: <StatusBadge status="Metadata manager" tone="success" /> },
          { label: "Owner", value: user.email ?? "Signed in" },
        ]}
      />

      <section className="grid two-up">
        <SectionCard
          badge="Gemini"
          title="Gemini keys"
          description="Models, roles, cooldowns, and encrypted key rotation."
          actions={
            <Link className="button primary" href="/gemini">
              Open Gemini
            </Link>
          }
        >
          <p>Use the existing Gemini manager for key metadata and server-side encrypted secrets.</p>
        </SectionCard>

        <SectionCard
          badge="Drive"
          title="Drive metadata"
          description="Folder and file references for Google Drive assets."
          actions={
            <Link className="button primary" href="/drive">
              Open Drive
            </Link>
          }
        >
          <p>Use the existing Drive manager for metadata only. Large files remain in Google Drive.</p>
        </SectionCard>

        <SectionCard badge="Flow" title="Flow accounts" description="Placeholder for Google Flow account setup.">
          <EmptyState
            title="Flow account setup is not implemented yet."
            description="This sprint only reserves the settings surface. Google Flow execution remains manual and external."
          />
        </SectionCard>

        <SectionCard badge="Affiliate" title="Affiliate accounts and links" description="Placeholder for TikTok and Shopee account setup.">
          <EmptyState
            title="Affiliate account settings are not implemented yet."
            description="Manual upload and affiliate link management will be added in a later approved sprint."
          />
        </SectionCard>

        <SectionCard badge="Account" title="Signed-in owner" description={user.email ?? "Owner session is active."}>
          <FormActions>
            <form action="/auth/signout" method="post">
              <button className="button" type="submit">
                Sign out
              </button>
            </form>
          </FormActions>
        </SectionCard>
      </section>
    </div>
  );
}
