import { SkeletonInlineSummary, SkeletonManagerCards } from "@/components/operator/loading-skeleton";

export default function GeminiLoading() {
  return (
    <div className="stack settings-page-body" aria-busy="true">
      <section className="product-master settings-manager settings-manager--gemini" aria-label="Memuat Gemini">
        <div className="product-master__list stack">
          <SkeletonInlineSummary />
          <SkeletonManagerCards count={2} />
        </div>
      </section>
    </div>
  );
}
