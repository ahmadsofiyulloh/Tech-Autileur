import {
  SkeletonButton,
  SkeletonIntakeActiveAffiliateCard,
  SkeletonIntakeEvidenceGrid,
  SkeletonIntakeMetadataPreview,
  SkeletonPwaInstallCard,
} from "@/components/operator/loading-skeleton";

export default function NewProductLoading() {
  return (
    <div className="stack intake-native-page" aria-busy="true">
      <SkeletonPwaInstallCard />
      <section className="intake-native-surface" aria-label="Memuat workflow intake produk">
        <section className="intake-workflow stack loading-skeleton-static">
          <SkeletonIntakeActiveAffiliateCard />
          <SkeletonIntakeEvidenceGrid />
          <SkeletonIntakeMetadataPreview />
          <div className="form-actions">
            <SkeletonButton />
          </div>
        </section>
      </section>
    </div>
  );
}
