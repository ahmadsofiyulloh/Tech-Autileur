import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { StatusBadge } from "@/components/operator/status-badge";
import {
  getDashboardViewModel,
  type DashboardMetricViewModel,
  type DashboardQuotaViewModel,
  type DashboardTone,
  type DashboardViewModel,
} from "@/lib/server/dashboard-view-model";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function progressStyle(percent: number) {
  return { "--dashboard-progress": `${Math.min(100, Math.max(0, percent))}%` } as CSSProperties;
}

function DashboardPanel({
  children,
  className,
  eyebrow,
  id,
  status,
  title,
  tone,
}: {
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  id: string;
  status?: string;
  title: string;
  tone?: DashboardTone;
}) {
  const resolvedClassName = ["dashboard-panel", className].filter(Boolean).join(" ");

  return (
    <section className={resolvedClassName} aria-labelledby={id}>
      <div className="dashboard-panel__header">
        <div className="dashboard-panel__title">
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h2 id={id}>{title}</h2>
        </div>
        {status ? <StatusBadge status={status} tone={tone} size="sm" /> : null}
      </div>
      {children}
    </section>
  );
}

function ToneDot({ tone }: { tone: DashboardTone }) {
  return <span className="dashboard-tone-dot" data-tone={tone} aria-hidden="true" />;
}

function GeminiMetric({ item }: { item: DashboardMetricViewModel }) {
  return (
    <article className="dashboard-ops-metric" data-tone={item.tone}>
      <span>{item.label}</span>
      <strong>{item.value}</strong>
      <small>{item.detail}</small>
    </article>
  );
}

function QuotaRow({ item }: { item: DashboardQuotaViewModel }) {
  return (
    <div className="dashboard-quota-row" data-tone={item.tone}>
      <div className="dashboard-quota-row__meta">
        <span>{item.label}</span>
        <strong>
          {item.used} / {item.limit}
        </strong>
      </div>
      <span className="dashboard-quota-row__bar" style={progressStyle(item.percent)}>
        <span />
      </span>
      <span className="dashboard-quota-row__percent">{item.percent}%</span>
    </div>
  );
}

function GeminiOperations({ viewModel }: { viewModel: DashboardViewModel["geminiOperations"] }) {
  const issueHref = viewModel.recentIssue.href;
  const issueActionLabel = viewModel.recentIssue.actionLabel;

  return (
    <DashboardPanel
      className="dashboard-panel--primary dashboard-ops"
      id="dashboard-gemini-operations"
      status={viewModel.status}
      title={viewModel.title}
      tone={viewModel.tone}
    >
      <div className="dashboard-ops__body">
        <div className="dashboard-ops__main">
          <div className="dashboard-ops-metrics" aria-label="Kesehatan task Gemini">
            {viewModel.health.map((item) => (
              <GeminiMetric item={item} key={item.id} />
            ))}
          </div>

          <article className="dashboard-issue-card" data-tone={viewModel.recentIssue.tone}>
            <div>
              <span>Masalah terbaru</span>
              <strong>{viewModel.recentIssue.title}</strong>
              <p>{viewModel.recentIssue.message}</p>
            </div>
            {issueHref && issueActionLabel ? (
              <Link className="dashboard-inline-link" href={issueHref}>
                {issueActionLabel}
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            ) : null}
          </article>
        </div>

        <div className="dashboard-ops__side">
          <div className="dashboard-quota-panel" aria-label="Penggunaan quota Gemini">
            <div className="dashboard-subsection-title">
              <span>Quota</span>
              <strong>{viewModel.quotaSummary}</strong>
            </div>
            {viewModel.quota.length === 0 ? (
              <EmptyState title="Usage Gemini kosong." description="Belum ada event usage atau limit quota aktif." />
            ) : (
              <div className="dashboard-quota-list">
                {viewModel.quota.map((item) => (
                  <QuotaRow item={item} key={item.id} />
                ))}
              </div>
            )}
          </div>

          <div className="dashboard-key-panel" aria-label="Status Gemini key">
            <div className="dashboard-subsection-title">
              <span>Status key</span>
              <strong>{viewModel.keyStatusSummary}</strong>
            </div>
            {viewModel.keyStatus.length === 0 ? (
              <EmptyState title="Belum ada key aktif." description="Key aktif belum tersedia untuk operator." />
            ) : (
              <div className="dashboard-key-list">
                {viewModel.keyStatus.map((item) => (
                  <article className="dashboard-key-row" key={item.id}>
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.meta}</span>
                    </div>
                    <StatusBadge status={item.status} tone={item.tone} size="sm" />
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardPanel>
  );
}

function ActionQueue({ viewModel }: { viewModel: DashboardViewModel["actionQueue"] }) {
  const emptyTitle = viewModel.status === "unavailable" ? "Action queue tidak tersedia." : "Tidak ada aksi.";
  const emptyDescription = viewModel.errorMessage ?? "Queue operasional kosong.";
  const statusLabel = viewModel.status === "available" ? undefined : viewModel.status === "partial" ? "Data terbatas" : "Tidak tersedia";

  return (
    <DashboardPanel
      className="dashboard-panel--secondary"
      eyebrow="Prioritas"
      id="dashboard-action-queue"
      status={statusLabel}
      title={viewModel.title}
      tone="warning"
    >
      {viewModel.items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="dashboard-compact-list">
          {viewModel.items.map((item) => (
            <Link className="dashboard-compact-row" data-tone={item.tone} href={item.href} key={item.id}>
              <ToneDot tone={item.tone} />
              <span className="dashboard-compact-row__copy">
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </span>
              <span className="dashboard-compact-row__count">{item.count}</span>
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}

function Pipeline({ viewModel }: { viewModel: DashboardViewModel["pipeline"] }) {
  const emptyTitle = viewModel.status === "unavailable" ? "Pipeline tidak tersedia." : "Pipeline kosong.";
  const emptyDescription = viewModel.errorMessage ?? "Belum ada produk aktif.";

  return (
    <DashboardPanel
      className="dashboard-panel--secondary"
      eyebrow={viewModel.total}
      id="dashboard-pipeline"
      status={viewModel.status === "unavailable" ? "Tidak tersedia" : undefined}
      title={viewModel.title}
      tone="warning"
    >
      {viewModel.stages.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <ol className="dashboard-pipeline-list" aria-label="Pipeline produk">
          {viewModel.stages.map((stage) => (
            <li className="dashboard-pipeline-item" data-tone={stage.tone} key={stage.id}>
              <Link href={stage.href}>
                <span className="dashboard-pipeline-item__copy">
                  <strong>{stage.label}</strong>
                  <span>{stage.detail}</span>
                </span>
                <span className="dashboard-pipeline-item__count">{stage.count}</span>
                <span className="dashboard-pipeline-item__bar" style={progressStyle(stage.percent)}>
                  <span />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </DashboardPanel>
  );
}

function operatorDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }) {
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  const emailName = user.email?.split("@")[0]?.trim();
  return emailName || "Operator";
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const viewModel = await getDashboardViewModel({
    userId: user.id,
  });
  const displayName = operatorDisplayName(user);

  return (
    <div className="dashboard-page dashboard-page--command" data-view-model-source={viewModel.source}>
      <header className="dashboard-greeting">
        <div>
          <span>Halo</span>
          <h1>{displayName}</h1>
          <p>Siap bekerja hari ini.</p>
        </div>
        <time>{viewModel.generatedAtLabel}</time>
      </header>

      <div className="dashboard-command-layout">
        <div className="dashboard-command-layout__primary">
          <GeminiOperations viewModel={viewModel.geminiOperations} />
        </div>

        <aside className="dashboard-command-layout__side" aria-label="Ringkasan kerja">
          <ActionQueue viewModel={viewModel.actionQueue} />
          <Pipeline viewModel={viewModel.pipeline} />
        </aside>
      </div>
    </div>
  );
}
