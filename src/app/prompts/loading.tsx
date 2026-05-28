import { SkeletonFilterTabs, SkeletonInlineSummary, SkeletonPromptCards, SkeletonSearchToolbar } from "@/components/operator/loading-skeleton";

export default function LoadingPromptsPage() {
  return (
    <div className="operator-detail-layout" aria-busy="true">
      <div className="stack prompt-page-stack prompt-workbench-layout__chrome">
        <SkeletonSearchToolbar />
        <SkeletonInlineSummary action={true} />
        <SkeletonFilterTabs count={8} className="desktop-action-set" />
      </div>
      <section className="stack prompt-workbench-section-fallback" aria-label="Memuat paket prompt">
        <SkeletonPromptCards count={10} />
      </section>
    </div>
  );
}
