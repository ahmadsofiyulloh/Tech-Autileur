import { Archive } from "lucide-react";
import { SkeletonLine } from "@/components/operator/loading-skeleton";
import { SectionCard } from "@/components/operator/section-card";

export default function OutputsLoading() {
  return (
    <div className="stack" aria-busy="true">
      <SectionCard icon={Archive} title="Output">
        <section className="empty-state muted-box stack loading-skeleton-static" aria-hidden="true">
          <div className="empty-state__body">
            <span className="icon-frame empty-state__icon skeleton-icon" />
            <div className="stack-tight">
              <SkeletonLine size="medium" />
            </div>
          </div>
        </section>
      </SectionCard>
    </div>
  );
}
