"use client";

import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { ErrorState } from "@/components/operator/error-state";
import { SkeletonMetricGrid } from "@/components/operator/loading-skeleton";
import { mockKeyStatuses, mockRecentErrors, mockUsageSummary } from "@/lib/ai-media/mock-data";
import { useAiMediaDemoState } from "@/lib/ai-media/use-demo-state";
import { AiMediaPageHeader } from "../_components/ai-media-page-header";
import { AiMediaUsageErrors } from "../_components/ai-media-usage-errors";
import { AiMediaUsageKeyList } from "../_components/ai-media-usage-key-list";
import { AiMediaUsageSummaryGrid } from "../_components/ai-media-usage-summary";

function UsageInner() {
  const { isLoading, isError, isEmpty } = useAiMediaDemoState();

  if (isLoading) {
    return (
      <div className="stack">
        <AiMediaPageHeader backHref="/tools/ai-media" />
        <SkeletonMetricGrid count={9} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="stack">
        <AiMediaPageHeader backHref="/tools/ai-media" />
        <ErrorState title="Gagal memuat usage." />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="stack">
        <AiMediaPageHeader backHref="/tools/ai-media" />
        <EmptyState icon={BarChart3} title="Belum ada usage." description="0 request hari ini." />
      </div>
    );
  }

  return (
    <div className="stack ai-media-usage-page">
      <AiMediaPageHeader backHref="/tools/ai-media" />
      <AiMediaUsageSummaryGrid summary={mockUsageSummary} />
      <div className="ai-media-usage-layout">
        <AiMediaUsageKeyList keys={mockKeyStatuses} />
        <AiMediaUsageErrors errors={mockRecentErrors} />
      </div>
    </div>
  );
}

export function AiMediaUsageContent() {
  return (
    <Suspense fallback={<SkeletonMetricGrid count={9} />}>
      <UsageInner />
    </Suspense>
  );
}
