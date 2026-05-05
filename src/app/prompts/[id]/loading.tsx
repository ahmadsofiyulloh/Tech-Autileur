import { FileText, RefreshCcw } from "lucide-react";
import {
  SkeletonButton,
  SkeletonLine,
  SkeletonMetricGrid,
} from "@/components/operator/loading-skeleton";
import { SectionCard } from "@/components/operator/section-card";

export default function PromptDetailLoading() {
  return (
    <div className="stack" aria-busy="true">
      <SectionCard icon={FileText} title="Output Siap Copy">
        <section className="prompt-output-grid loading-skeleton-static" aria-hidden="true">
          <div className="prompt-output-section">
            <div className="prompt-readonly-field">
              <div className="prompt-readonly-field__header">
                <SkeletonLine size="short" />
                <SkeletonButton />
              </div>
              <div className="prompt-readonly-field__body">
                <SkeletonLine size="long" />
                <SkeletonLine size="long" />
                <SkeletonLine size="medium" />
              </div>
            </div>
          </div>
          <div className="prompt-output-section">
            <SkeletonMetricGrid count={2} />
          </div>
        </section>
        <div className="mobile-action-set loading-skeleton-static" aria-hidden="true">
          <SkeletonButton />
        </div>
      </SectionCard>

      <SectionCard icon={RefreshCcw} title="Regenerate Prompt">
        <div className="stack loading-skeleton-static" aria-hidden="true">
          <SkeletonLine size="short" />
          <div className="skeleton-preview-frame" />
          <div className="form-actions">
            <SkeletonButton />
            <SkeletonButton />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
