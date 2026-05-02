import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, Package } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
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
        icon={Inbox}
        badge="Queued"
        title="Intake"
        description="Product capture starts here later."
        stats={[
          { label: "Status", value: <StatusBadge status="Reserved" tone="neutral" /> },
          { label: "Upload", value: "Off" },
          { label: "Parse", value: "Off" },
        ]}
      />

      <SectionCard icon={Inbox} title="No intake yet.">
        <EmptyState
          icon={Inbox}
          title="Use Products for now."
          action={
            <Link className="button primary" href="/products">
              <Package size={16} aria-hidden="true" />
              Products
            </Link>
          }
        />
      </SectionCard>
    </div>
  );
}
