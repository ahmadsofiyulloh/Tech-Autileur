import {
  SkeletonIntakeStepper,
} from "@/components/operator/loading-skeleton";

export default function IntakeLoading() {
  return (
    <div className="stack intake-native-page" aria-busy="true">
      <section className="intake-native-surface" aria-label="Memuat workflow intake produk">
        <section className="intake-workflow stack loading-skeleton-static">
          <SkeletonIntakeStepper />
        </section>
      </section>
    </div>
  );
}
