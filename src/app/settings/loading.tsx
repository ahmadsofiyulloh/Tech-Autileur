import { SkeletonPwaInstallCard, SkeletonSettingsNativeList, SkeletonSettingsShortcutCard } from "@/components/operator/loading-skeleton";

export default function SettingsLoading() {
  return (
    <div className="stack" aria-busy="true">
      <SkeletonSettingsShortcutCard />
      <SkeletonPwaInstallCard />
      <SkeletonSettingsNativeList />
    </div>
  );
}
