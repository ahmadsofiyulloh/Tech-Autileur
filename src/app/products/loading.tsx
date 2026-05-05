import {
  SkeletonFilterTabs,
  SkeletonInlineSummary,
  SkeletonSearchToolbar,
  SkeletonVisualListCards,
} from "@/components/operator/loading-skeleton";

export default function LoadingProductsPage() {
  return (
    <div className="stack" aria-busy="true">
      <section className="product-master" aria-label="Memuat daftar produk">
        <div className="product-master__list stack">
          <SkeletonSearchToolbar />
          <SkeletonInlineSummary />
          <div className="product-filter-stack">
            <SkeletonFilterTabs count={6} />
            <SkeletonFilterTabs count={3} className="content-filter-tabs--sub" />
          </div>
          <SkeletonVisualListCards count={3} />
        </div>
      </section>
    </div>
  );
}
