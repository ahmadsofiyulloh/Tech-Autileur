import { FileText } from "lucide-react";
import { SkeletonButton, SkeletonLine, SkeletonTabNav } from "@/components/operator/loading-skeleton";
import { SectionCard } from "@/components/operator/section-card";

export default function ProductDetailLoading() {
  return (
    <div className="product-detail-route stack" aria-busy="true">
      <section className="product-detail-route__surface">
        <header className="product-detail-route__header loading-skeleton-static" aria-hidden="true">
          <div className="product-detail-route__heading">
            <SkeletonLine size="short" />
            <SkeletonLine size="medium" />
          </div>
          <SkeletonButton />
        </header>
        <div className="product-detail-route__body">
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
      </section>
    </div>
  );
}
