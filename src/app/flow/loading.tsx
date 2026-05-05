import { SkeletonLine } from "@/components/operator/loading-skeleton";

export default function FlowLoading() {
  return (
    <div className="stack loading-skeleton-static" aria-busy="true">
      <SkeletonLine size="long" />
      <SkeletonLine size="medium" />
    </div>
  );
}
