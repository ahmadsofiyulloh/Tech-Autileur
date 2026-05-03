import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";

export default function NewProductLoading() {
  return (
    <div className="stack">
      <PageHeader icon={Inbox} badge="Intake produk" title="Memuat intake produk baru" description="Memuat." />
      <SectionCard icon={Inbox} title="Memuat form intake">
        <div className="stack" aria-busy="true">
          <div className="skeleton long" />
          <div className="skeleton medium" />
          <div className="skeleton short" />
        </div>
      </SectionCard>
    </div>
  );
}
