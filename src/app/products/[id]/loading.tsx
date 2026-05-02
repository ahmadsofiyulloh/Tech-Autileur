import { Package } from "lucide-react";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";

export default function ProductDetailLoading() {
  return (
    <div className="stack">
      <PageHeader icon={Package} badge="Product" title="Product detail" description="Loading." />
      <SectionCard icon={Package} title="Loading product detail">
        <div className="stack" aria-busy="true">
          <div className="skeleton short" />
          <div className="skeleton long" />
          <div className="skeleton medium" />
        </div>
      </SectionCard>
    </div>
  );
}
