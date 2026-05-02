import Link from "next/link";
import { redirect } from "next/navigation";
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
        badge="Placeholder"
        eyebrow="Phase 1"
        title="Product intake"
        description="Mobile intake for Shopee links, TikTok links, product photos, screenshots, and metadata review will be implemented in a later approved sprint."
        stats={[
          { label: "Status", value: <StatusBadge status="Placeholder" tone="neutral" /> },
          { label: "Uploads", value: "Not enabled" },
          { label: "Parsing", value: "Not enabled" },
        ]}
      />

      <SectionCard title="No intake features are active yet.">
        <EmptyState
          title="Use products for current metadata work."
          description="This route is reserved for the revised mobile-first intake flow. It does not upload files, parse marketplaces, or call Gemini."
          action={
            <Link className="button primary" href="/products">
              Open products
            </Link>
          }
        />
      </SectionCard>
    </div>
  );
}
