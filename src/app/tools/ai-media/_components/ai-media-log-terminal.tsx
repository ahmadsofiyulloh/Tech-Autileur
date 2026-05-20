"use client";

import type { AiMediaLogEntry } from "@/lib/ai-media/mock-data";

type AiMediaLogTerminalProps = {
  entries: AiMediaLogEntry[];
  emptyText?: string;
  className?: string;
};

export function AiMediaLogTerminal({ entries, emptyText = "Belum ada log.", className }: AiMediaLogTerminalProps) {
  return (
    <div className={`ai-media-log-terminal ${className ?? ""}`.trim()}>
      <span className="ai-media-log-terminal__label">Log</span>
      <div className="ai-media-log-terminal__body">
        {entries.length === 0 ? (
          <span className="ai-media-log-terminal__empty">{emptyText}</span>
        ) : (
          <ul className="ai-media-log-terminal__list">
            {entries.map((entry) => (
              <li key={entry.id} className="ai-media-log-terminal__entry" data-level={entry.level}>
                <span className="ai-media-log-terminal__time">{entry.time}</span>
                <span className="ai-media-log-terminal__message">{entry.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
