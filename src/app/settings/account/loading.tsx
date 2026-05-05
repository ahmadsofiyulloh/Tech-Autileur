import { UserRound } from "lucide-react";
import { SkeletonButton, SkeletonLine } from "@/components/operator/loading-skeleton";
import { SectionCard } from "@/components/operator/section-card";

export default function AccountSettingsLoading() {
  return (
    <div className="stack" aria-busy="true">
      <SectionCard icon={UserRound} title="Account">
        <div className="stack loading-skeleton-static" aria-hidden="true">
          <div className="muted-box section-card__actions">
            <div className="stack-tight">
              <SkeletonLine size="medium" />
              <SkeletonLine size="short" />
            </div>
            <SkeletonButton />
          </div>
          <div className="muted-box stack">
            <div className="section-card__actions">
              <div className="stack-tight">
                <SkeletonLine size="medium" />
                <SkeletonLine size="short" />
              </div>
              <SkeletonLine size="short" />
            </div>
            <SkeletonButton />
          </div>
        </div>
        <div className="form-actions loading-skeleton-static" aria-hidden="true">
          <SkeletonButton />
        </div>
      </SectionCard>
    </div>
  );
}
