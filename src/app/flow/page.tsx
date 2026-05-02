import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Workflow } from "lucide-react";
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
        icon={Workflow}
        badge="Queued"
        title="Flow"
        description="Batch handoff comes later."
        stats={[
          { label: "Status", value: <StatusBadge status="Reserved" tone="neutral" /> },
          { label: "Run", value: "Manual" },
          { label: "Auto", value: "Off" },
        ]}
      />

      <SectionCard icon={Workflow} title="No Flow queue yet.">
        <EmptyState
          icon={Workflow}
          title="Use Prompts for now."
          action={
            <Link className="button primary" href="/prompts">
              <FileText size={16} aria-hidden="true" />
              Prompts
            </Link>
          }
        />
      </SectionCard>
    </div>
  );
}
