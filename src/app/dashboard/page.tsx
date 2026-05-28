import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { MetricCard } from "@/components/operator/metric-card";
import { StatusBadge } from "@/components/operator/status-badge";
import {
  getDashboardViewModel,
  type DashboardQuotaViewModel,
  type DashboardTone,
  type DashboardViewModel,
} from "@/lib/server/dashboard-view-model";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 30;

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
          <div className="metric-grid ai-media-kpi-grid ai-media-kpi-grid--dashboard" aria-label="Kesehatan task Gemini">
            {viewModel.health.map((item) => (
              <MetricCard className="ai-media-kpi" label={item.label} value={item.value} detail={item.detail} key={item.id} />
            ))}
          </div>

          <article className="dashboard-issue-card" data-tone={viewModel.recentIssue.tone}>
            <div>
              <span>Masalah terbaru</span>
              <strong>{viewModel.recentIssue.title}</strong>
              <p>{viewModel.recentIssue.message}</p>
            </div>
            <div className="dashboard-issue-card__actions">
              {issueHref && issueActionLabel ? (
                <Link className="dashboard-inline-link" href={issueHref}>
                  {issueActionLabel}
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
              ) : null}
              <Link className="dashboard-inline-link" href="/admin/diagnostics">
                Diagnostics
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </div>
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

function ToolsQuickActions({ actionCount }: { actionCount: number }) {
  return (
    <DashboardPanel
      className="dashboard-panel--secondary"
      eyebrow="Tools"
      id="dashboard-tools-quick-actions"
      title="Quick actions"
    >
      <div className="dashboard-tools-grid">
        <Link className="ai-media-tool-card native-button" href="/tools/ai-media">
          <div className="ai-media-tool-card__visual">
            <img src="/ai-media/tool-cards/motion-control.webp" alt="" aria-hidden="true" className="ai-media-tool-card__image" loading="lazy" />
          </div>
          <div className="ai-media-tool-card__body">
            <strong className="ai-media-tool-card__title">AI Media Lab</strong>
            <span className="ai-media-tool-card__label">Motion, I2V, Upscale.</span>
          </div>
        </Link>
        <Link className="ai-media-tool-card native-button" href="/prompts">
          <div className="ai-media-tool-card__visual">
            <img src="/ai-media/tool-cards/prompt.webp" alt="" aria-hidden="true" className="ai-media-tool-card__image" loading="lazy" />
          </div>
          <div className="ai-media-tool-card__body">
            <strong className="ai-media-tool-card__title">Buat Prompt</strong>
            <span className="ai-media-tool-card__label">Workbench prompt.</span>
          </div>
          {actionCount > 0 ? <span className="dashboard-tool-card__count">{actionCount}</span> : null}
        </Link>
      </div>
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
        <div className="metric-grid ai-media-kpi-grid ai-media-kpi-grid--pipeline" aria-label="Pipeline produk">
          {viewModel.stages.map((stage) => (
            <Link className="ai-media-kpi dashboard-pipeline-kpi" data-tone={stage.tone} href={stage.href} key={stage.id}>
              <span className="dashboard-pipeline-kpi__label">{stage.label}</span>
              <strong className="dashboard-pipeline-kpi__count">{stage.count}</strong>
              <small className="dashboard-pipeline-kpi__detail">{stage.detail}</small>
            </Link>
          ))}
        </div>
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
          <ToolsQuickActions actionCount={viewModel.actionQueue.items.length} />
          <Pipeline viewModel={viewModel.pipeline} />
        </aside>
      </div>
    </div>
  );
}
