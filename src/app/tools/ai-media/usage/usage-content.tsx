import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { ErrorState } from "@/components/operator/error-state";
import { getAiMediaUsageReadModel } from "@/lib/server/ai-media";
import { AiMediaPageHeader } from "../_components/ai-media-page-header";
import { AiMediaUsageErrors } from "../_components/ai-media-usage-errors";
import { AiMediaUsageKeyList } from "../_components/ai-media-usage-key-list";
import { AiMediaUsageSummaryGrid } from "../_components/ai-media-usage-summary";

export async function AiMediaUsageContent() {
  let model: Awaited<ReturnType<typeof getAiMediaUsageReadModel>> = null;
  let loadError: string | null = null;

  try {
    model = await getAiMediaUsageReadModel();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat usage.";
  }

  if (loadError) {
    return (
      <div className="stack">
        <AiMediaPageHeader backHref="/tools/ai-media" />
        <ErrorState title="Gagal memuat usage." />
      </div>
    );
  }

  if (!model || (model.snapshot.requestsToday === 0 && model.keys.length === 0)) {
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
      <AiMediaUsageSummaryGrid summary={model.snapshot} />
      <div className="ai-media-usage-layout">
        <AiMediaUsageKeyList keys={model.keys} />
        <AiMediaUsageErrors errors={model.snapshot.recentErrors} />
      </div>
    </div>
  );
}
