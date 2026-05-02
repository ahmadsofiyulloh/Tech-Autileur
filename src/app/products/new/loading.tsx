import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";

export default function NewProductLoading() {
  return (
    <div className="stack">
      <PageHeader icon={Inbox} badge="Product intake" title="New product intake" description="Loading." />
      <SectionCard icon={Inbox} title="Loading intake form">
        <div className="stack" aria-busy="true">
          <div className="skeleton long" />
          <div className="skeleton medium" />
          <div className="skeleton short" />
        </div>
      </SectionCard>
    </div>
  );
}
