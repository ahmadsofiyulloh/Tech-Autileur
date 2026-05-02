import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, FileText, Workflow } from "lucide-react";
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
        icon={Archive}
        badge="Queued"
        title="Outputs"
        description="Clips and upload packages land here later."
        stats={[
          { label: "Status", value: <StatusBadge status="Reserved" tone="neutral" /> },
          { label: "Upload", value: "Manual" },
          { label: "Flow", value: <Link className="button compact" href="/flow"><Workflow size={15} aria-hidden="true" />Open</Link> },
        ]}
      />

      <SectionCard icon={Archive} title="No outputs yet.">
        <EmptyState
          icon={Archive}
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
