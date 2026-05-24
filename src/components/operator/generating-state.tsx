"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type GeneratingStatePollResult = {
  status: string;
  error_message?: string | null;
};

export type GeneratingStateProps = {
  skeleton: ReactNode;
  statusStages: string[];
  pollFn?: () => Promise<GeneratingStatePollResult>;
  pollIntervalMs?: number;
  timeoutMs?: number;
  onResolved?: (result: GeneratingStatePollResult) => void;
  onTimeout?: () => void;
  isPending?: boolean;
  estimateLabel?: string;
};

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 90000;
const STAGE_CYCLE_MS = 15000;

export function GeneratingState({
  skeleton,
  statusStages,
  pollFn,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onResolved,
  onTimeout,
  estimateLabel,
}: GeneratingStateProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const resolvedRef = useRef(false);
  const timedOutRef = useRef(false);

  useEffect(() => {
    startedAtRef.current = Date.now();

    const stageInterval = setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, statusStages.length - 1));
    }, STAGE_CYCLE_MS);

    const timeoutId = setTimeout(() => {
      if (!resolvedRef.current && !timedOutRef.current) {
        timedOutRef.current = true;
        onTimeout?.();
      }
    }, timeoutMs);

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    async function tick() {
      if (!pollFn || resolvedRef.current || timedOutRef.current) return;
      try {
        const result = await pollFn();
        if (result.status !== "generating" && !resolvedRef.current) {
          resolvedRef.current = true;
          onResolved?.(result);
        }
      } catch {
        // silent retry — network blip
      }
    }

    if (pollFn) {
      void tick();
      pollInterval = setInterval(tick, pollIntervalMs);
    }

    return () => {
      clearInterval(stageInterval);
      clearTimeout(timeoutId);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollFn, pollIntervalMs, timeoutMs, onResolved, onTimeout, statusStages.length]);

  const statusText = statusStages[Math.min(stageIndex, statusStages.length - 1)] ?? "";

  return (
    <div className="generating-state">
      <div className="generating-state__header">
        <div className="generating-state__status" role="status" aria-live="polite">
          <span className="generating-state__dot" aria-hidden="true" />
          {statusText}
        </div>
        {estimateLabel ? (
          <p className="generating-state__subtitle">{estimateLabel}</p>
        ) : null}
      </div>
      <div className="generating-state__body">{skeleton}</div>
    </div>
  );
}
