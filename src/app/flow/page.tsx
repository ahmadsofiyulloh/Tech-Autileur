import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/operator/empty-state";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FlowPage() {
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
        eyebrow="Desktop workflow"
        title="Google Flow control"
        description="Flow accounts, batch prompts, Chrome profile handoff, and execution tracking are reserved for later approved sprints."
        stats={[
          { label: "Status", value: <StatusBadge status="Placeholder" tone="neutral" /> },
          { label: "Execution", value: "Manual external" },
          { label: "Automation", value: "Not enabled" },
        ]}
      />

      <SectionCard title="No Flow execution features are active yet.">
        <EmptyState
          title="Use prompt packs for current prompt output."
          description="This route does not call Google Flow, Drive APIs, or browser automation."
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
