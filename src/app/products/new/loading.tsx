import {
  SkeletonButton,
  SkeletonProfileCarousel,
  SkeletonPwaInstallCard,
  SkeletonUploadCard,
} from "@/components/operator/loading-skeleton";

export default function NewProductLoading() {
  return (
    <div className="stack intake-native-page" aria-busy="true">
      <SkeletonPwaInstallCard />
      <section className="intake-native-surface" aria-label="Memuat workflow intake produk">
        <section className="intake-workflow stack loading-skeleton-static">
          <div className="intake-segment-control" aria-hidden="true">
            <span className="intake-segment-control__button skeleton-tab" />
            <span className="intake-segment-control__button skeleton-tab" />
          </div>
          <div className="intake-segment-panels">
            <section className="intake-segment-panel" data-active="true">
              <SkeletonUploadCard withCamera />
              <SkeletonProfileCarousel />
            </section>
          </div>
          <div className="error-box status-box" aria-hidden="true">
            <span className="skeleton long" />
          </div>
          <div className="form-actions">
            <SkeletonButton />
          </div>
        </section>
      </section>
    </div>
  );
}
