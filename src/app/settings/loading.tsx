import {
  SkeletonSettingsNativeList,
  SkeletonSettingsProfileHero,
} from "@/components/operator/loading-skeleton";

export default function SettingsLoading() {
  return (
    <div className="stack" aria-busy="true">
      <SkeletonSettingsProfileHero />
      <SkeletonSettingsNativeList />
    </div>
  );
}
