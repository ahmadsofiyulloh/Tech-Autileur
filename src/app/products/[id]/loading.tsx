import { FileText } from "lucide-react";
import { SkeletonButton, SkeletonLine, SkeletonTabNav } from "@/components/operator/loading-skeleton";
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
                <SkeletonLine size="medium" />
              </div>
            </div>
            <div className="prompt-readonly-field">
              <div className="prompt-readonly-field__header">
                <SkeletonLine size="short" />
                <SkeletonButton />
              </div>
              <div className="prompt-readonly-field__body">
                <SkeletonLine size="long" />
                <SkeletonLine size="medium" />
              </div>
            </div>
          </div>
          <div className="prompt-output-section">
            <div className="prompt-output-section__body">
              <div className="prompt-readonly-field">
                <div className="prompt-readonly-field__header">
                  <SkeletonLine size="short" />
                  <SkeletonButton />
                </div>
                <div className="prompt-readonly-field__body">
                  <SkeletonLine size="long" />
                  <SkeletonLine size="medium" />
                </div>
              </div>
              <div className="prompt-readonly-field">
                <div className="prompt-readonly-field__header">
                  <SkeletonLine size="short" />
                  <SkeletonButton />
                </div>
                <div className="prompt-readonly-field__body">
                  <SkeletonLine size="long" />
                  <SkeletonLine size="medium" />
                </div>
              </div>
              <div className="prompt-readonly-field">
                <div className="prompt-readonly-field__header">
                  <SkeletonLine size="short" />
                  <SkeletonButton />
                </div>
                <div className="prompt-readonly-field__body">
                  <SkeletonLine size="long" />
                  <SkeletonLine size="medium" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </SectionCard>
    </div>
  );
}
