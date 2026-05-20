import {
  SkeletonIntakeStepper,
} from "@/components/operator/loading-skeleton";

export default function NewProductLoading() {
  return (
    <div className="stack intake-native-page" aria-busy="true">
      <div className="intake-desktop-grid">
        <div className="intake-desktop-primary stack">
          <section className="intake-native-surface" aria-label="Memuat workflow intake produk">
            <section className="intake-workflow stack loading-skeleton-static">
              <SkeletonIntakeStepper />
            </section>
          </section>
        </div>
        <section className="bulk-import-panel desktop-action-set loading-skeleton-static" aria-hidden="true">
          <div className="bulk-import-panel__header">
            <span className="skeleton-icon" />
            <div className="stack-tight">
              <span className="skeleton medium" />
              <span className="skeleton short" />
            </div>
          </div>
          <div className="bulk-import-summary-grid">
            {Array.from({ length: 5 }, (_, index) => (
              <span className="bulk-import-summary-metric" data-tone="neutral" key={index}>
                <span className="skeleton short" />
                <span className="skeleton short" />
              </span>
            ))}
          </div>
          <span className="skeleton-preview-frame" />
        </section>
      </div>
    </div>
  );
}
