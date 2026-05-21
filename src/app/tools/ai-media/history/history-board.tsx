"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, PanelRightOpen, X } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { ErrorState } from "@/components/operator/error-state";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton } from "@/components/ui/native-button";
import type {
  AiMediaGenerationTaskProjection,
  AiMediaHistoryListProjection,
  ExternalGenerationToolType,
  ExternalTaskStatus,
} from "@/lib/server/ai-media";
import { AiMediaLogTerminal } from "../_components/ai-media-log-terminal";
import { AiMediaPreviewCard } from "../_components/ai-media-preview-card";

type StatusFilter = "ALL" | ExternalTaskStatus;

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "ALL", label: "Semua" },
  { id: "RUNNING", label: "Running" },
  { id: "SUCCESS", label: "Success" },
  { id: "FAILED", label: "Failed" },
  { id: "WAITING_FOR_KEY", label: "Waiting" },
];

const TOOL_LABELS: Record<ExternalGenerationToolType, string> = {
  MOTION_CONTROL: "Motion Control",
  IMAGE_TO_VIDEO: "Image to Video",
  UPSCALER: "Upscaler",
};

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function toolLabel(tool: ExternalGenerationToolType) {
  return TOOL_LABELS[tool] ?? tool;
}

type AiMediaHistoryBoardProps = {
  projection: AiMediaHistoryListProjection | null;
  loadError: string | null;
  filterToolType: ExternalGenerationToolType | null;
  filterStatus: ExternalTaskStatus | null;
};

function TaskCard({
  task,
  active,
  onOpen,
}: {
  task: AiMediaGenerationTaskProjection;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <article className="product-card settings-list-card ai-media-history-task-card" data-active={active ? "true" : undefined}>
      <div className="settings-list-card__header">
        <div className="stack-tight">
          <strong>{toolLabel(task.toolType)}</strong>
          <span className="subtle">{formatTimestamp(task.createdAt)}</span>
        </div>
        <StatusBadge status={task.status} size="sm" />
      </div>
      <dl className="product-card__meta">
        <div><dt>Provider</dt><dd>{task.provider}</dd></div>
        <div><dt>Model</dt><dd>{task.modelName ?? "—"}</dd></div>
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

function TaskDetail({
  task,
  onClose,
}: {
  task: AiMediaGenerationTaskProjection;
  onClose: () => void;
}) {
  return (
    <aside className="operator-detail-drawer ai-media-history-detail" data-open="true" aria-label="Detail task">
      <div className="operator-detail-drawer__header">
        <div className="operator-detail-drawer__heading">
          <strong>{toolLabel(task.toolType)}</strong>
          <span>{formatTimestamp(task.createdAt)}</span>
        </div>
        <NativeButton className="compact operator-detail-drawer__close" type="button" onClick={onClose} aria-label="Tutup">
          <X size={16} aria-hidden="true" />
        </NativeButton>
      </div>
      <div className="operator-detail-drawer__body">
        <div className="ai-media-history-preview-grid">
          <AiMediaPreviewCard label="Input" emptyText="Input metadata." />
          <AiMediaPreviewCard
            label="Output"
            emptyText={
              task.outputDrive
                ? "Output tersimpan di Drive."
                : task.status === "SUCCESS"
                  ? "Output siap."
                  : "Belum ada output."
            }
          />
        </div>
        {task.outputDrive ? (
          <div className="ai-media-history-detail__actions">
            <a
              href={task.outputDrive.driveUrl}
              target="_blank"
              rel="noreferrer"
              className="button compact primary native-button"
            >
              <ExternalLink size={14} />
              Buka di Drive
            </a>
          </div>
        ) : null}
        <dl className="product-drawer__meta">
          <div><dt>Task ID</dt><dd>{task.providerTaskId ?? "—"}</dd></div>
          <div><dt>Key</dt><dd>{task.selectedKeyLabel ?? "—"}</dd></div>
          <div><dt>Model</dt><dd>{task.modelName ?? "—"}</dd></div>
          <div><dt>Status</dt><dd><StatusBadge status={task.status} size="sm" /></dd></div>
          {task.outputDrive ? (
            <div>
              <dt>Drive file</dt>
              <dd>{task.outputDrive.name}</dd>
            </div>
          ) : null}
          <div><dt>Error</dt><dd>{task.errorMessage ?? "Tidak ada."}</dd></div>
        </dl>
        {task.logs.length ? (
          <section className="stack-tight" aria-label="Log">
            <span className="ai-media-step-field__label">Technical log</span>
            <AiMediaLogTerminal entries={task.logs.map((l, i) => ({ id: `${task.id}-${i}`, time: l.time, message: l.message, level: l.level }))} />
          </section>
        ) : null}
      </div>
    </aside>
  );
}

function buildHref(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.length) search.set(k, v);
  }
  const query = search.toString();
  return query ? `/tools/ai-media/history?${query}` : "/tools/ai-media/history";
}

export function AiMediaHistoryBoard({
  projection,
  loadError,
  filterToolType,
  filterStatus,
}: AiMediaHistoryBoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loadError) {
    return <ErrorState title="Gagal memuat history." />;
  }

  if (!projection) {
    return <ErrorState title="Gagal memuat history." />;
  }

  const tasks = projection.tasks;
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  function setFilterStatus(next: StatusFilter) {
    const search = new URLSearchParams(searchParams.toString());
    if (next === "ALL") {
      search.delete("status");
    } else {
      search.set("status", next);
    }
    search.delete("page");
    router.push(`/tools/ai-media/history?${search.toString()}`);
  }

  const baseParams: Record<string, string | undefined> = {
    tool_type: filterToolType ?? undefined,
    status: filterStatus ?? undefined,
    page_size: String(projection.pagination.pageSize),
  };

  return (
    <div className="operator-detail-layout ai-media-history-layout" data-has-detail={selected ? "true" : undefined}>
      <div className="operator-detail-layout__list stack">
        <div className="content-filter-tabs ai-media-history-filter-tabs" role="tablist" aria-label="Filter">
          {STATUS_FILTERS.map((f) => {
            const active = (f.id === "ALL" && !filterStatus) || filterStatus === f.id;
            return (
              <button
                key={f.id}
                role="tab"
                type="button"
                className="content-filter-tab"
                aria-selected={active}
                data-active={active ? "true" : undefined}
                onClick={() => setFilterStatus(f.id)}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="settings-inline-summary">
          <span>{projection.pagination.totalCount} task</span>
        </div>

        {tasks.length ? (
          <>
            <div className="table-wrap ai-media-history-table-desktop">
              <table className="data-table product-table ai-media-history-table">
                <thead>
                  <tr><th>Tool</th><th>Provider</th><th>Model</th><th>Status</th><th>Created</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} data-active={selected?.id === t.id ? "true" : undefined}>
                      <td><strong>{toolLabel(t.toolType)}</strong></td>
                      <td>{t.provider}</td>
                      <td>{t.modelName ?? "—"}</td>
                      <td><StatusBadge status={t.status} size="sm" /></td>
                      <td>{formatTimestamp(t.createdAt)}</td>
                      <td>
                        <NativeButton className="compact primary" type="button" onClick={() => setSelectedId(t.id)}>
                          <PanelRightOpen size={15} />Open
                        </NativeButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ai-media-history-card-list">
              {tasks.map((t) => (
                <TaskCard key={t.id} task={t} active={selected?.id === t.id} onOpen={() => setSelectedId(t.id)} />
              ))}
            </div>

            <div className="settings-inline-summary">
              <span>
                Page {projection.pagination.page} of {projection.pagination.totalPages}
              </span>
              <div className="ai-media-history-detail__actions">
                {projection.pagination.hasPreviousPage ? (
                  <Link
                    className="button compact tertiary native-button"
                    href={buildHref({ ...baseParams, page: String(projection.pagination.page - 1) })}
                  >
                    Sebelumnya
                  </Link>
                ) : null}
                {projection.pagination.hasNextPage ? (
                  <Link
                    className="button compact tertiary native-button"
                    href={buildHref({ ...baseParams, page: String(projection.pagination.page + 1) })}
                  >
                    Berikutnya
                  </Link>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <EmptyState title="Belum ada task." description="Generate sesuatu terlebih dahulu." />
        )}
      </div>

      {selected && <TaskDetail task={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
