import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, Workflow } from "lucide-react";
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
        badge="Compatibility"
        title="Outputs"
        description="Compatibility view. Output belongs on Product Detail and Controller workflow."
        stats={[
          { label: "Status", value: <StatusBadge status="Reserved" tone="neutral" /> },
          { label: "Upload", value: "Manual" },
          { label: "Controller", value: <Link className="button compact" href="/controller"><Workflow size={15} aria-hidden="true" />Open</Link> },
        ]}
      />

      <SectionCard icon={Archive} title="No outputs yet.">
        <EmptyState
          icon={Archive}
          title="Use Product Detail or Controller."
          action={
            <Link className="button primary" href="/controller">
              <Workflow size={16} aria-hidden="true" />
              Controller
            </Link>
          }
        />
      </SectionCard>
    </div>
  );
}
