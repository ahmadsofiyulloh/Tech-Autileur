"use client";

import type { RecentError } from "./actions";

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} hari lalu`;
  if (hours > 0) return `${hours} jam lalu`;
  if (minutes > 0) return `${minutes} menit lalu`;
  return "Baru saja";
}

export function DiagnosticsRecentErrorsList({ errors }: { errors: RecentError[] }) {
  if (errors.length === 0) {
    return (
      <div className="diagnostics-empty">
        <p>Tidak ada error dalam 20 task terakhir.</p>
      </div>
    );
  }

  return (
    <div className="diagnostics-table">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Status</th>
            <th>Error</th>
            <th>Waktu</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((err) => (
            <tr key={err.id}>
              <td>
                <span className="status-badge">{err.taskType}</span>
              </td>
              <td>
                <span className="status-badge status-badge--error">{err.status}</span>
              </td>
              <td title={err.errorMessage ?? ""}>
                {err.errorMessage
                  ? `${err.errorMessage.slice(0, 80)}${err.errorMessage.length > 80 ? "…" : ""}`
                  : "-"}
              </td>
              <td>{formatRelativeTime(err.finishedAt ?? err.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
