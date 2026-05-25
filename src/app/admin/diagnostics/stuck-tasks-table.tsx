"use client";

import { useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { NativeButton } from "@/components/ui/native-button";
import { markTasksFailed, type StuckTask } from "./actions";

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} hari`;
  if (hours > 0) return `${hours} jam`;
  if (minutes > 0) return `${minutes} menit`;
  return `${seconds} detik`;
}

function statusClass(status: string): string {
  if (status === "QUEUED") return "status-badge--warning";
  if (status === "RUNNING") return "status-badge--info";
  if (status === "WAITING_FOR_KEY") return "status-badge--cooldown";
  return "";
}

export function DiagnosticsStuckTasksTable({ tasks }: { tasks: StuckTask[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleAll() {
    if (selected.size === tasks.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tasks.map((t) => t.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  function handleMarkFailed() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await markTasksFailed(Array.from(selected));
        if (result.errors && result.errors.length > 0) {
          setError(`Beberapa task gagal di-mark: ${result.errors.length} error`);
        }
        setSelected(new Set());
        setShowConfirm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menandai task");
      }
    });
  }

  if (tasks.length === 0) {
    return (
      <div className="diagnostics-empty">
        <p>Tidak ada task yang stuck. Semua generation berjalan normal.</p>
      </div>
    );
  }

  return (
    <div className="diagnostics-table-wrapper">
      <div className="diagnostics-table-actions">
        <span className="diagnostics-table-actions__count">
          {selected.size} dari {tasks.length} dipilih
        </span>
        <NativeButton
          className="compact destructive"
          disabled={selected.size === 0 || isPending}
          onClick={() => setShowConfirm(true)}
        >
          Mark Failed
        </NativeButton>
      </div>

      {error ? (
        <div className="diagnostics-error">
          <AlertCircle className="icon" />
          {error}
        </div>
      ) : null}

      <div className="diagnostics-table">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selected.size === tasks.length && tasks.length > 0}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th>Task ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Stale Duration</th>
              <th>Error</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(task.id)}
                    onChange={() => toggleOne(task.id)}
                    aria-label={`Select task ${task.id}`}
                  />
                </td>
                <td>
                  <code title={task.id}>{task.id.slice(0, 8)}…</code>
                </td>
                <td>
                  <span className="status-badge">{task.taskType}</span>
                </td>
                <td>
                  <span className={`status-badge ${statusClass(task.status)}`}>{task.status}</span>
                </td>
                <td>{formatDuration(task.staleDurationMs)}</td>
                <td title={task.errorMessage ?? ""}>
                  {task.errorMessage ? `${task.errorMessage.slice(0, 50)}${task.errorMessage.length > 50 ? "…" : ""}` : "-"}
                </td>
                <td>{formatDuration(task.createdAgoMs)} lalu</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showConfirm ? (
        <div className="diagnostics-modal-backdrop" onClick={() => setShowConfirm(false)}>
          <div className="diagnostics-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Tandai {selected.size} task sebagai gagal?</h3>
            <p>Task akan diubah statusnya menjadi FAILED dan tidak bisa di-resume.</p>
            <div className="diagnostics-modal__actions">
              <NativeButton className="compact" onClick={() => setShowConfirm(false)} disabled={isPending}>
                Batal
              </NativeButton>
              <NativeButton className="compact destructive" onClick={handleMarkFailed} disabled={isPending}>
                {isPending ? "Memproses…" : "Tandai Gagal"}
              </NativeButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
