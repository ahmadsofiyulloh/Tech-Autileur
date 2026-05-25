"use client";

import type { KeyPoolItem } from "./actions";

function statusClass(status: string): string {
  if (status === "ACTIVE") return "status-badge--success";
  if (status === "RATE_LIMITED" || status === "COOLDOWN") return "status-badge--warning";
  if (status === "ERROR") return "status-badge--error";
  return "";
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Belum pernah";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (diff < 0) {
    const futureMins = Math.abs(minutes);
    if (futureMins < 60) return `${futureMins} menit lagi`;
    return `${Math.floor(futureMins / 60)} jam lagi`;
  }

  if (days > 0) return `${days} hari lalu`;
  if (hours > 0) return `${hours} jam lalu`;
  if (minutes > 0) return `${minutes} menit lalu`;
  return "Baru saja";
}

export function DiagnosticsKeyPoolTable({ keys }: { keys: KeyPoolItem[] }) {
  if (keys.length === 0) {
    return (
      <div className="diagnostics-empty">
        <p>Tidak ada Gemini key terdaftar.</p>
      </div>
    );
  }

  return (
    <div className="diagnostics-table">
      <table>
        <thead>
          <tr>
            <th>Key ID</th>
            <th>Role</th>
            <th>Status</th>
            <th>Model</th>
            <th>Cooldown Until</th>
            <th>Last Used</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key.id}>
              <td>
                <code title={key.id}>{key.id.slice(0, 8)}…</code>
              </td>
              <td>
                <span className="status-badge">{key.role}</span>
              </td>
              <td>
                <span className={`status-badge ${statusClass(key.status)}`}>{key.status}</span>
              </td>
              <td>{key.model}</td>
              <td>{key.cooldownUntil ? formatRelativeTime(key.cooldownUntil) : "-"}</td>
              <td>{formatRelativeTime(key.lastUsedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
