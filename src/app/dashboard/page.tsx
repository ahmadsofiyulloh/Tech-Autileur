import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, FileText, FileVideo, HardDrive, Inbox, Plus, Sparkles, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { AI_TASK_STATUSES } from "@/lib/ai-tasks/validation";
import { PROMPT_READY_FOR_FLOW_STATUS } from "@/lib/prompts/validation";
import { GENERATED_FILE_MATCH_STATUSES } from "@/lib/server/clip-jobs";
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

type IntakeReviewTarget = {
  id: string;
  product_id: string | null;
};

const PROMPT_WORK_STATUSES = ["DRAFT", "GENERATED", "NEEDS_REVIEW"] as const;
const numberFormatter = new Intl.NumberFormat("id-ID");

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatMetricValue(metric: MetricResult<number>) {
  return metric.status === "available" ? formatCount(metric.data) : "Tidak tersedia";
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

async function countMatchingStatuses(input: {
  supabase: SupabaseServerClient;
  tableName: string;
  statusColumn: string;
  userId: string;
  statuses: readonly string[];
}): Promise<MetricResult<number>> {
  const results = await Promise.all(
    input.statuses.map((status) =>
      countRows(input.supabase, input.tableName, input.userId, {
        column: input.statusColumn,
        value: status,
      }),
    ),
  );
  const failed = results.find((result) => result.status === "unavailable");

  if (failed?.status === "unavailable") {
    return failed;
  }

  return {
    status: "available",
    data: results.reduce((sum, result) => sum + (result.status === "available" ? result.data : 0), 0),
  };
}

async function getLatestIntakeReviewTarget(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<MetricResult<IntakeReviewTarget | null>> {
  const { data, error } = await supabase
    .from("product_intake_sessions")
    .select("id, product_id")
    .eq("user_id", userId)
    .eq("status", "NEEDS_REVIEW")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      status: "unavailable",
      message: error.message,
    };
  }

  return {
    status: "available",
    data: data ? ({ id: data.id, product_id: data.product_id } as IntakeReviewTarget) : null,
  };
}

function MetricTile({
  label,
  metric,
}: {
  label: string;
  metric: MetricResult<number>;
}) {
  return (
    <div className="metric dashboard-kpi">
      <span>{label}</span>
      <strong>{formatMetricValue(metric)}</strong>
    </div>
  );
}

function UnavailableMetricTile({ label }: { label: string }) {
  return (
    <div className="metric dashboard-kpi dashboard-kpi--unavailable">
      <span>{label}</span>
      <strong>Tidak tersedia</strong>
    </div>
  );
}

function ActionCountBadge({ metric, suffix }: { metric?: MetricResult<number>; suffix: string }) {
  if (!metric) {
    return null;
  }

  if (metric.status === "unavailable") {
    return <StatusBadge status="Tidak tersedia" tone="warning" />;
  }

  return <StatusBadge status={`${formatCount(metric.data)} ${suffix}`} tone={metric.data > 0 ? "info" : "neutral"} />;
}

function ActionRailItem({
  count,
  countSuffix,
  description,
  href,
  icon: Icon,
  label,
  primary = false,
  title,
}: {
  count?: MetricResult<number>;
  countSuffix: string;
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
  primary?: boolean;
  title: string;
}) {
  return (
    <li>
      <div className="stack-tight">
        <div className="section-card__actions">
          <span className="icon-frame" aria-hidden="true">
            <Icon size={16} />
          </span>
          <strong>{title}</strong>
          <ActionCountBadge metric={count} suffix={countSuffix} />
        </div>
        <span className="subtle">{description}</span>
      </div>
      <Link className={primary ? "button compact primary" : "button compact"} href={href}>
        {label}
      </Link>
    </li>
  );
}

function ActionRail({
  promptWork,
  readyPrompts,
  reviewHref,
  reviewIntakes,
}: {
  promptWork: MetricResult<number>;
  readyPrompts: MetricResult<number>;
  reviewHref: string;
  reviewIntakes: MetricResult<number>;
}) {
  return (
    <SectionCard icon={Workflow} title="Aksi Berikutnya">
      <ul className="list" aria-label="Aksi berikutnya">
        <ActionRailItem
          countSuffix="baru"
          description="Upload evidence produk."
          href="/products/new"
          icon={Plus}
          label="Mulai"
          primary
          title="Intake baru"
        />
        <ActionRailItem
          count={reviewIntakes}
          countSuffix="review"
          description="Cek hasil Gemini."
          href={reviewHref}
          icon={Inbox}
          label="Review"
          title="Review metadata"
        />
        <ActionRailItem
          count={promptWork}
          countSuffix="prompt"
          description="Edit atau generate paket."
          href="/prompts"
          icon={FileText}
          label="Prompt"
          title="Lanjut prompt"
        />
        <ActionRailItem
          count={readyPrompts}
          countSuffix="siap"
          description="Desktop saja."
          href="/controller"
          icon={Workflow}
          label="Buka"
          title="Flow Control"
        />
      </ul>
    </SectionCard>
  );
}

function StatusBreakdownList({
  metric,
  emptyTitle,
  unavailableTitle,
}: {
  metric: MetricResult<StatusBreakdown>;
  emptyTitle: string;
  unavailableTitle: string;
}) {
  if (metric.status === "unavailable") {
    return <EmptyState icon={Archive} title={unavailableTitle} description={metric.message} />;
  }

  if (metric.data.total === 0) {
    return <EmptyState icon={Archive} title={emptyTitle} description="Belum ada data." />;
  }

  return (
    <ul className="list" aria-label={emptyTitle}>
      {metric.data.statuses.map((item) => (
        <li key={item.status}>
          <StatusBadge status={item.status} />
          <strong>{formatCount(item.count)}</strong>
        </li>
      ))}
    </ul>
  );
}

function getBreakdownTotal(metric: MetricResult<StatusBreakdown>): MetricResult<number> {
  return metric.status === "available"
    ? {
        status: "available",
        data: metric.data.total,
      }
    : metric;
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [geminiTasks, driveItems, generatedFiles, promptPacks, outputImport, reviewIntakes, promptWork, readyPrompts, latestReviewTarget] = await Promise.all([
    countByStatus({
      supabase,
      tableName: "ai_tasks",
      statusColumn: "status",
      userId: user.id,
      statuses: AI_TASK_STATUSES,
    }),
    countRows(supabase, "drive_items", user.id),
    countRows(supabase, "generated_files", user.id),
    countRows(supabase, "prompt_packs", user.id),
    countByStatus({
      supabase,
      tableName: "generated_files",
      statusColumn: "match_status",
      userId: user.id,
      statuses: GENERATED_FILE_MATCH_STATUSES,
    }),
    countRows(supabase, "product_intake_sessions", user.id, {
      column: "status",
      value: "NEEDS_REVIEW",
    }),
    countMatchingStatuses({
      supabase,
      tableName: "prompt_packs",
      statusColumn: "status",
      userId: user.id,
      statuses: PROMPT_WORK_STATUSES,
    }),
    countRows(supabase, "prompt_packs", user.id, {
      column: "status",
      value: PROMPT_READY_FOR_FLOW_STATUS,
    }),
    getLatestIntakeReviewTarget(supabase, user.id),
  ]);

  const geminiTaskCount: MetricResult<number> = getBreakdownTotal(geminiTasks);
  const outputImportCount = getBreakdownTotal(outputImport);
  const reviewHref =
    latestReviewTarget.status === "available" && latestReviewTarget.data
      ? `/products/new?step=prompt&intake_id=${latestReviewTarget.data.id}`
      : "/products/new";

  return (
    <div className="stack">
      <ActionRail
        promptWork={promptWork}
        readyPrompts={readyPrompts}
        reviewHref={reviewHref}
        reviewIntakes={reviewIntakes}
      />

      <SectionCard icon={Sparkles} title="Gemini">
        <div className="metric-grid dashboard-kpi-grid">
          <MetricTile label="Task count" metric={geminiTaskCount} />
          <UnavailableMetricTile label="Token/cost" />
        </div>
        <StatusBreakdownList
          metric={geminiTasks}
          emptyTitle="Belum ada Gemini task."
          unavailableTitle="Gemini task tidak tersedia."
        />
      </SectionCard>

      <SectionCard icon={HardDrive} title="Drive dan prompt">
        <div className="metric-grid dashboard-kpi-grid">
          <MetricTile label="Drive item" metric={driveItems} />
          <MetricTile label="Generated file" metric={generatedFiles} />
          <MetricTile label="Prompt pack" metric={promptPacks} />
        </div>
      </SectionCard>

      <SectionCard icon={FileVideo} title="Output/import">
        <div className="metric-grid dashboard-kpi-grid">
          <MetricTile label="Status count" metric={outputImportCount} />
        </div>
        <StatusBreakdownList
          metric={outputImport}
          emptyTitle="Belum ada output/import."
          unavailableTitle="Output/import tidak tersedia."
        />
      </SectionCard>
    </div>
  );
}
