import { redirect } from "next/navigation";
import { Archive } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
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
        description="Arsip."
        stats={[
          { label: "Mode", value: "Read only" },
          { label: "Primary", value: "Product Detail" },
        ]}
      />

      <SectionCard icon={Archive} title="Output archive">
        <EmptyState icon={Archive} title="Arsip output." />
      </SectionCard>
    </div>
  );
}
