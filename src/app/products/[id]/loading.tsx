import { Package } from "lucide-react";
import { SkeletonMetricGrid, SkeletonTabNav } from "@/components/operator/loading-skeleton";
import { SectionCard } from "@/components/operator/section-card";

export default function ProductDetailLoading() {
  return (
    <div className="stack" aria-busy="true">
      <div className="surface-toolbar loading-skeleton-static" aria-hidden="true">
        <span className="surface-context">
          <span className="skeleton short" />
        </span>
      </div>
      <SkeletonTabNav />
      <SectionCard icon={Package} title="Product metadata">
        <SkeletonMetricGrid count={6} />
      </SectionCard>
    </div>
  );
}
