import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/operator/empty-state";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OutputsPage() {
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
        badge="Placeholder"
        eyebrow="Phase 1"
        title="Content outputs"
        description="Final clips, captions, tags, affiliate links, copy actions, upload status, and post URLs will be added in a later approved sprint."
        stats={[
          { label: "Status", value: <StatusBadge status="Placeholder" tone="neutral" /> },
          { label: "Uploads", value: "Manual only" },
          { label: "Automation", value: "Not enabled" },
        ]}
      />

      <SectionCard title="No output package features are active yet.">
        <EmptyState
          title="Use prompts for current generation work."
          description="This route is reserved for the mobile output package view. It does not upload to TikTok or Shopee."
          action={
            <Link className="button primary" href="/prompts">
              Open prompts
            </Link>
          }
        />
      </SectionCard>
    </div>
  );
}
