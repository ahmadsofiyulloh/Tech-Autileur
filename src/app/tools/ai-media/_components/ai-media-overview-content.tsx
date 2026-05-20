"use client";

import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { ErrorState } from "@/components/operator/error-state";
import { SkeletonMetricGrid } from "@/components/operator/loading-skeleton";
import { mockProviderStatus, mockToolCards } from "@/lib/ai-media/mock-data";
import { useAiMediaDemoState } from "@/lib/ai-media/use-demo-state";
import { AiMediaPageHeader } from "./ai-media-page-header";
import { AiMediaProviderStatus } from "./ai-media-provider-status";
import { AiMediaToolGrid } from "./ai-media-tool-grid";

function OverviewInner() {
  const { isLoading, isError, isEmpty } = useAiMediaDemoState();

  if (isLoading) {
    return (
      <div className="stack">
        <AiMediaPageHeader backHref="/dashboard" />
        <SkeletonMetricGrid count={5} />
        <div className="ai-media-lobby__grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ai-media-tool-card skeleton" aria-hidden="true" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="stack">
        <AiMediaPageHeader backHref="/dashboard" />
        <ErrorState title="Gagal memuat status." />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="stack">
        <AiMediaPageHeader backHref="/dashboard" />
        <EmptyState icon={Sparkles} title="Belum ada provider." description="Tambahkan kunci API di Settings." />
      </div>
    );
  }

  return (
    <div className="stack">
      <AiMediaPageHeader backHref="/dashboard" />
      <AiMediaProviderStatus provider={mockProviderStatus} />
      <AiMediaToolGrid cards={mockToolCards} />
    </div>
  );
}

export function AiMediaOverviewContent() {
  return (
    <Suspense fallback={<SkeletonMetricGrid count={5} />}>
      <OverviewInner />
    </Suspense>
  );
}
