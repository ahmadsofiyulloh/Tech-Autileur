import { SkeletonLine } from "@/components/operator/loading-skeleton";

export default function AiMediaHistoryLoading() {
  return (
    <div className="stack" aria-busy="true">
      <div className="loading-skeleton-static" aria-hidden="true">
        <SkeletonLine size="medium" />
      </div>
      <div className="skeleton-block" style={{ minHeight: "300px" }} />
    </div>
  );
}
