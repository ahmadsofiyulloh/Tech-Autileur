import { SkeletonSettingsNativeList } from "@/components/operator/loading-skeleton";

export default function SettingsAboutLoading() {
  return (
    <div className="stack settings-page-body" aria-busy="true">
      <SkeletonSettingsNativeList />
    </div>
  );
}
