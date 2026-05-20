"use client";

import { useState } from "react";
import { ScrollText, X } from "lucide-react";
import type { AiMediaLogEntry } from "@/lib/ai-media/mock-data";
import { AiMediaLogTerminal } from "./ai-media-log-terminal";

type AiMediaLogPanelProps = {
  entries: AiMediaLogEntry[];
  className?: string;
};

export function AiMediaLogPanel({ entries, className }: AiMediaLogPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="button compact tertiary native-button" onClick={() => setOpen(true)} aria-label="Buka log">
        <ScrollText size={14} />
        Log
      </button>

      {open && (
        <div className={`ai-media-log-panel ${className ?? ""}`.trim()}>
          <div className="ai-media-log-panel__header">
            <strong className="ai-media-log-panel__title">Log Terminal</strong>
            <button type="button" className="button compact tertiary native-button" onClick={() => setOpen(false)} aria-label="Tutup log">
              <X size={14} />
            </button>
          </div>
          <AiMediaLogTerminal entries={entries} />
        </div>
      )}
    </>
  );
}
