import { redirect } from "next/navigation";
import { Archive, Sparkles, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { EmptyState } from "@/components/operator/empty-state";
import { GeminiLiveCycleChart } from "@/components/operator/gemini-live-cycle-chart";
import { GeminiUsageOverviewPanel } from "@/components/operator/gemini-usage-overview";
import { AI_TASK_STATUSES } from "@/lib/ai-tasks/validation";
import { getGeminiUsageOverview } from "@/lib/server/gemini-usage-overview";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type MetricResult<T> =
  | {
      status: "available";
      data: T;
    }
  | {
      status: "unavailable";
      message: string;
    };

type StatusCount = {
  status: string;
  count: number;
};

type StatusBreakdown = {
  total: number;
  statuses: StatusCount[];
};

const ACTIVE_TASK_STATUSES = ["QUEUED", "RUNNING", "RETRYING", "WAITING_FOR_KEY"] as const;
const ISSUE_TASK_STATUSES = ["FAILED", "CANCELLED"] as const;
const numberFormatter = new Intl.NumberFormat("id-ID");
const decimalFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1,
});

const GEMINI_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Menunggu",
  RUNNING: "Berjalan",
  SUCCESS: "Sukses",
  FAILED: "Gagal",
  RETRYING: "Retry",
  WAITING_FOR_KEY: "Menunggu key",
  CANCELLED: "Dibatalkan",
};

const GEMINI_STATUS_TONES: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  QUEUED: "neutral",
  RUNNING: "info",
  SUCCESS: "success",
  FAILED: "danger",
  RETRYING: "warning",
  WAITING_FOR_KEY: "warning",
  CANCELLED: "neutral",
};

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatPercentRatio(value: number) {
  return `${decimalFormatter.format(value * 100)}%`;
}

function formatMetricValue(metric: MetricResult<number>) {
  return metric.status === "available" ? formatCount(metric.data) : "Tidak tersedia";
}

function getMetricFill(metric: MetricResult<number>) {
  if (metric.status === "unavailable") {
    return "18%";
  }

  return `${Math.min(92, Math.max(10, metric.data * 11 + 14))}%`;
}

function DashboardSection({
  children,
  icon: Icon,
  id,
  title,
}: {
  children: ReactNode;
  icon: LucideIcon;
  id?: string;
  title: string;
}) {
  const sectionId = id ?? `dashboard-section-${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;

  return (
    <section className="dashboard-section" aria-labelledby={sectionId}>
      <div className="dashboard-section__header">
        <span className="icon-frame dashboard-section__icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <h2 id={sectionId}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

async function countRows(
  supabase: SupabaseServerClient,
  tableName: string,
  userId: string,
  filter?: { column: string; value: string },
): Promise<MetricResult<number>> {
  let query = supabase.from(tableName).select("id", { count: "exact", head: true }).eq("user_id", userId);

  if (filter) {
    query = query.eq(filter.column, filter.value);
  }

  const { count, error } = await query;

  if (error) {
    return {
      status: "unavailable",
      message: error.message,
    };
  }

  return {
    status: "available",
    data: count ?? 0,
  };
}

async function countByStatus(input: {
  supabase: SupabaseServerClient;
  tableName: string;
  statusColumn: string;
  userId: string;
  statuses: readonly string[];
}): Promise<MetricResult<StatusBreakdown>> {
  const total = await countRows(input.supabase, input.tableName, input.userId);

  if (total.status === "unavailable") {
    return total;
  }

  const statusResults = await Promise.all(
    input.statuses.map(async (status) => ({
      status,
      result: await countRows(input.supabase, input.tableName, input.userId, {
        column: input.statusColumn,
        value: status,
      }),
    })),
  );
  const failedStatus = statusResults.find((item) => item.result.status === "unavailable");

  if (failedStatus?.result.status === "unavailable") {
    return {
      status: "unavailable",
      message: failedStatus.result.message,
    };
  }

  const statuses = statusResults
    .map((item) => ({
      status: item.status,
      count: item.result.status === "available" ? item.result.data : 0,
    }))
    .filter((item) => item.count > 0);
  const knownTotal = statuses.reduce((sum, item) => sum + item.count, 0);
  const otherCount = Math.max(total.data - knownTotal, 0);

  if (otherCount > 0) {
    statuses.push({
      status: "OTHER",
      count: otherCount,
    });
  }

  return {
    status: "available",
    data: {
      total: total.data,
      statuses,
    },
  };
}

function availableMetric(data: number): MetricResult<number> {
  return {
    status: "available",
    data,
  };
}

function statusCount(metric: MetricResult<StatusBreakdown>, status: string) {
  if (metric.status === "unavailable") {
    return 0;
  }

  return metric.data.statuses.find((item) => item.status === status)?.count ?? 0;
}

function sumStatuses(metric: MetricResult<StatusBreakdown>, statuses: readonly string[]) {
  if (metric.status === "unavailable") {
    return metric;
  }

  return availableMetric(statuses.reduce((sum, status) => sum + statusCount(metric, status), 0));
}

function MetricTile({
  label,
  metric,
}: {
  label: string;
  metric: MetricResult<number>;
}) {
  return (
    <div className="metric dashboard-kpi" style={{ "--metric-fill": getMetricFill(metric) } as CSSProperties}>
      <span>{label}</span>
      <strong>{formatMetricValue(metric)}</strong>
      <i aria-hidden="true" />
    </div>
  );
}

type GeminiLiveCycleRow = {
  status: string;
  label: string;
  count: number;
  share: number;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
};

function getLiveCycleRows(metric: MetricResult<StatusBreakdown>) {
  if (metric.status === "unavailable") {
    return [];
  }

  return AI_TASK_STATUSES.map((status) => {
    const count = statusCount(metric, status);
    const share = metric.data.total > 0 ? count / metric.data.total : 0;

    return {
      status,
      label: GEMINI_STATUS_LABELS[status] ?? status,
      count,
      share,
      tone: GEMINI_STATUS_TONES[status] ?? "neutral",
    } satisfies GeminiLiveCycleRow;
  });
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [geminiTasks, geminiUsageOverview] = await Promise.all([
    countByStatus({
      supabase,
      tableName: "ai_tasks",
      statusColumn: "status",
      userId: user.id,
      statuses: AI_TASK_STATUSES,
    }),
    getGeminiUsageOverview(user.id),
  ]);

  const geminiTaskCount: MetricResult<number> = geminiTasks.status === "available" ? availableMetric(geminiTasks.data.total) : geminiTasks;
  const activeTaskCount = sumStatuses(geminiTasks, ACTIVE_TASK_STATUSES);
  const successTaskCount = sumStatuses(geminiTasks, ["SUCCESS"]);
  const issueTaskCount = sumStatuses(geminiTasks, ISSUE_TASK_STATUSES);
  const liveCycleRows = getLiveCycleRows(geminiTasks);
  const liveCycleSummary =
    geminiTasks.status === "available"
      ? {
          total: geminiTasks.data.total,
          active: activeTaskCount.status === "available" ? activeTaskCount.data : 0,
          issue: issueTaskCount.status === "available" ? issueTaskCount.data : 0,
        }
      : null;

  return (
    <div className="dashboard-page dashboard-page--analysis">
      <DashboardSection icon={Sparkles} id="gemini-summary" title="Ringkasan Gemini">
        <div className="metric-grid dashboard-kpi-grid">
          <MetricTile label="Task total" metric={geminiTaskCount} />
          <MetricTile label="Aktif" metric={activeTaskCount} />
          <MetricTile label="Sukses" metric={successTaskCount} />
          <MetricTile label="Issue" metric={issueTaskCount} />
        </div>
      </DashboardSection>

      <DashboardSection icon={Sparkles} id="gemini-live-analysis" title="Live cycle Gemini">
        {geminiTasks.status === "unavailable" ? (
          <EmptyState icon={Archive} title="Gemini task tidak tersedia." description={geminiTasks.message} />
        ) : geminiTasks.data.total === 0 ? (
          <EmptyState icon={Archive} title="Belum ada Gemini task." description="Task live cycle masih kosong." />
        ) : liveCycleSummary ? (
          <GeminiLiveCycleChart rows={liveCycleRows} summary={liveCycleSummary} />
        ) : null}
      </DashboardSection>

      <GeminiUsageOverviewPanel overview={geminiUsageOverview} sectionId="gemini-key-usage" />
    </div>
  );
}
