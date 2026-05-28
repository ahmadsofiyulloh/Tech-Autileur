import { SkeletonLine } from "@/components/operator/loading-skeleton";

export default function AiMediaLoading() {
  return (
    <div className="stack" aria-busy="true">
      <div className="loading-skeleton-static" aria-hidden="true">
        <SkeletonLine size="medium" />
        <SkeletonLine size="long" />
      </div>
      <div className="skeleton-block" style={{ minHeight: "400px" }} />
    </div>
  );
}
