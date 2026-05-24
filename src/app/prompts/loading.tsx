import { SkeletonFilterTabs, SkeletonInlineSummary, SkeletonPromptCards, SkeletonSearchToolbar } from "@/components/operator/loading-skeleton";

export default function LoadingPromptsPage() {
  return (
    <div className="operator-detail-layout" aria-busy="true">
      <div className="operator-detail-layout__list stack prompt-page-stack">
        <SkeletonSearchToolbar />
        <SkeletonInlineSummary action={true} />
        <SkeletonFilterTabs count={8} className="desktop-action-set" />
        <section className="stack" aria-label="Memuat paket prompt">
          <SkeletonPromptCards count={10} />
        </section>
      </div>
    </div>
  );
}
