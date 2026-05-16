import { SkeletonFilterTabs, SkeletonInlineSummary, SkeletonPromptCards } from "@/components/operator/loading-skeleton";

export default function LoadingPromptsPage() {
  return (
    <div className="stack prompt-page-stack" aria-busy="true">
      <SkeletonInlineSummary action={false} />
      <SkeletonFilterTabs count={8} className="desktop-action-set" />
      <section className="stack" aria-label="Memuat paket prompt">
        <SkeletonPromptCards count={3} />
      </section>
    </div>
  );
}
