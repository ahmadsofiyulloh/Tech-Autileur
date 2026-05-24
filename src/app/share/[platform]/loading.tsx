import {
  SkeletonFilterTabs,
  SkeletonInlineSummary,
  SkeletonSearchToolbar,
  SkeletonVisualListCards,
} from "@/components/operator/loading-skeleton";

export default function LoadingSharePlatformPage() {
  return (
    <div className="operator-detail-layout" aria-busy="true">
      <div className="operator-detail-layout__list stack">
        <SkeletonSearchToolbar />
        <SkeletonInlineSummary />
        <SkeletonFilterTabs count={6} />
        <section className="stack" aria-label="Memuat produk">
          <SkeletonVisualListCards count={8} />
        </section>
      </div>
    </div>
  );
}
