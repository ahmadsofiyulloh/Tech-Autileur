import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { ErrorState } from "@/components/operator/error-state";
import { getAiMediaOverviewSnapshot } from "@/lib/server/ai-media";
import { AiMediaPageHeader } from "./ai-media-page-header";
import { AiMediaProviderStatus } from "./ai-media-provider-status";
import { AiMediaToolGrid, type AiMediaToolGridStatusOverride } from "./ai-media-tool-grid";

export async function AiMediaOverviewContent() {
  let snapshot: Awaited<ReturnType<typeof getAiMediaOverviewSnapshot>> = null;
  let loadError: string | null = null;

  try {
    snapshot = await getAiMediaOverviewSnapshot();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat status.";
  }

  if (loadError) {
    return (
      <div className="stack">
        <AiMediaPageHeader backHref="/dashboard" />
        <ErrorState title="Gagal memuat status." />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="stack">
        <AiMediaPageHeader backHref="/dashboard" />
        <EmptyState icon={Sparkles} title="Belum ada provider." description="Tambahkan kunci API di Settings." />
      </div>
    );
  }

  const overrides: AiMediaToolGridStatusOverride[] = [
    {
      cardId: "history",
      status: snapshot.recentTaskCount > 0 ? `${snapshot.recentTaskCount} task` : "Kosong",
      statusTone: snapshot.recentTaskCount > 0 ? "info" : "neutral",
    },
    {
      cardId: "settings",
      status: snapshot.provider.activeKeyCount > 0 ? `${snapshot.provider.activeKeyCount} aktif` : "Belum",
      statusTone: snapshot.provider.activeKeyCount > 0 ? "success" : "warning",
    },
    {
      cardId: "usage",
      status: snapshot.provider.requestsToday > 0 ? `${snapshot.provider.requestsToday} req` : "Normal",
      statusTone: "neutral",
    },
  ];

  return (
    <div className="stack">
      <AiMediaPageHeader backHref="/dashboard" />
      <AiMediaProviderStatus provider={snapshot.provider} />
      <AiMediaToolGrid statusOverrides={overrides} />
    </div>
  );
}
