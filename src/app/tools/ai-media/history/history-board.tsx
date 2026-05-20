"use client";

import { Suspense, useMemo, useState } from "react";
import { PanelRightOpen, RefreshCcw, Search, X } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { ErrorState } from "@/components/operator/error-state";
import { SkeletonFilterTabs, SkeletonManagerCards } from "@/components/operator/loading-skeleton";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton } from "@/components/ui/native-button";
import { mockHistoryTasks, type AiMediaHistoryTask, type AiMediaHistoryTaskStatus } from "@/lib/ai-media/mock-data";
import { useAiMediaDemoState } from "@/lib/ai-media/use-demo-state";
import { AiMediaLogTerminal } from "../_components/ai-media-log-terminal";
import { AiMediaPreviewCard } from "../_components/ai-media-preview-card";

type Filter = "ALL" | AiMediaHistoryTaskStatus;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "ALL", label: "Semua" },
  { id: "RUNNING", label: "Running" },
  { id: "SUCCESS", label: "Success" },
  { id: "FAILED", label: "Failed" },
];

function TaskCard({ task, active, onOpen }: { task: AiMediaHistoryTask; active: boolean; onOpen: () => void }) {
  return (
    <article className="product-card settings-list-card ai-media-history-task-card" data-active={active ? "true" : undefined}>
      <div className="settings-list-card__header">
        <div className="stack-tight">
          <strong>{task.toolType}</strong>
          <span className="subtle">{task.createdTime}</span>
        </div>
        <StatusBadge status={task.status} size="sm" />
      </div>
      <dl className="product-card__meta">
        <div><dt>Provider</dt><dd>{task.provider}</dd></div>
        <div><dt>Model</dt><dd>{task.model}</dd></div>
      </dl>
      <div className="mobile-card-actions">
        <NativeButton className="compact primary" type="button" onClick={onOpen}>
          <PanelRightOpen size={15} aria-hidden="true" />
          Open
        </NativeButton>
      </div>
    </article>
  );
}

function TaskDetail({ task, onClose }: { task: AiMediaHistoryTask; onClose: () => void }) {
  return (
    <aside className="operator-detail-drawer ai-media-history-detail" data-open="true" aria-label="Detail task">
      <div className="operator-detail-drawer__header">
        <div className="operator-detail-drawer__heading">
          <strong>{task.toolType}</strong>
          <span>{task.createdTime}</span>
        </div>
        <NativeButton className="compact operator-detail-drawer__close" type="button" onClick={onClose} aria-label="Tutup">
          <X size={16} aria-hidden="true" />
        </NativeButton>
      </div>
      <div className="operator-detail-drawer__body">
        <div className="ai-media-history-preview-grid">
          <AiMediaPreviewCard label="Input" emptyText="Input dummy." />
          <AiMediaPreviewCard label="Output" emptyText={task.status === "SUCCESS" ? "Output dummy siap." : "Belum ada output."} />
        </div>
        <dl className="product-drawer__meta">
          <div><dt>Task ID</dt><dd>{task.providerTaskId}</dd></div>
          <div><dt>Key</dt><dd>{task.selectedKey}</dd></div>
          <div><dt>Status</dt><dd><StatusBadge status={task.status} size="sm" /></dd></div>
          <div><dt>Error</dt><dd>{task.errorSummary}</dd></div>
        </dl>
        <section className="stack-tight" aria-label="Log">
          <span className="ai-media-step-field__label">Technical log</span>
          <AiMediaLogTerminal entries={task.logs} />
        </section>
        <div className="ai-media-history-detail__actions">
          <NativeButton className="compact tertiary" type="button">
            <RefreshCcw size={15} aria-hidden="true" />
            Retry dummy
          </NativeButton>
        </div>
      </div>
    </aside>
  );
}

function HistoryInner() {
  const { isLoading, isError, isEmpty } = useAiMediaDemoState();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() =>
    mockHistoryTasks.filter((t) => {
      if (filter !== "ALL" && t.status !== filter) return false;
      if (query.trim() && !`${t.toolType} ${t.provider} ${t.model}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    }), [filter, query]);

  const selected = filtered.find((t) => t.id === selectedId) ?? null;

  if (isLoading) return <><SkeletonFilterTabs count={4} /><SkeletonManagerCards count={3} /></>;
  if (isError) return <ErrorState title="Gagal memuat history." />;
  if (isEmpty) return <EmptyState title="Belum ada task." description="Generate sesuatu terlebih dahulu." />;

  return (
    <div className="operator-detail-layout ai-media-history-layout" data-has-detail={selected ? "true" : undefined}>
      <div className="operator-detail-layout__list stack">
        <div className="settings-list-toolbar ai-media-history-toolbar">
          <label className="operator-search-input product-search ai-media-history-search" htmlFor="ai-media-history-q">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Cari task</span>
            <input id="ai-media-history-q" placeholder="Cari task" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>

        <div className="content-filter-tabs ai-media-history-filter-tabs" role="tablist" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" type="button" className="content-filter-tab" aria-selected={filter === f.id} data-active={filter === f.id ? "true" : undefined} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="settings-inline-summary"><span>{filtered.length} task</span></div>

        {filtered.length ? (
          <>
            <div className="table-wrap ai-media-history-table-desktop">
              <table className="data-table product-table ai-media-history-table">
                <thead><tr><th>Tool</th><th>Provider</th><th>Model</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} data-active={selected?.id === t.id ? "true" : undefined}>
                      <td><strong>{t.toolType}</strong></td>
                      <td>{t.provider}</td>
                      <td>{t.model}</td>
                      <td><StatusBadge status={t.status} size="sm" /></td>
                      <td>{t.createdTime}</td>
                      <td><NativeButton className="compact primary" type="button" onClick={() => setSelectedId(t.id)}><PanelRightOpen size={15} />Open</NativeButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ai-media-history-card-list">
              {filtered.map((t) => (
                <TaskCard key={t.id} task={t} active={selected?.id === t.id} onOpen={() => setSelectedId(t.id)} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState title="Task tidak ditemukan." />
        )}
      </div>

      {selected && <TaskDetail task={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

export function AiMediaHistoryBoard() {
  return (
    <Suspense fallback={<><SkeletonFilterTabs count={4} /><SkeletonManagerCards count={3} /></>}>
      <HistoryInner />
    </Suspense>
  );
}
