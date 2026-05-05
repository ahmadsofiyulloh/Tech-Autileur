import {
  SkeletonGeminiUsageOverview,
  SkeletonPwaInstallCard,
  SkeletonSettingsNativeList,
} from "@/components/operator/loading-skeleton";

export default function SettingsLoading() {
  return (
    <div className="stack" aria-busy="true">
      <SkeletonGeminiUsageOverview />
      <SkeletonPwaInstallCard />
      <SkeletonSettingsNativeList />
    </div>
  );
}
