import { SkeletonDriveGrid, SkeletonInlineSummary, SkeletonSearchToolbar } from "@/components/operator/loading-skeleton";

export default function DriveLoading() {
  return (
    <div className="stack" aria-busy="true">
      <SkeletonSearchToolbar />
      <SkeletonInlineSummary />
      <SkeletonDriveGrid />
    </div>
  );
}
