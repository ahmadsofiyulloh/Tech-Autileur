"use client";

import { useCallback } from "react";
import { GeneratingState, type GeneratingStatePollResult } from "@/components/operator/generating-state";
import { ShareSkeleton } from "@/components/operator/generating-state-skeletons";

type PollResult = {
  status: string;
  error_message: string | null;
  output_json: unknown | null;
};

type Props = {
  generationId: string;
  variantCount: number;
  onResolved: (result: PollResult) => void;
  onTimeout: () => void;
};

const STATUS_STAGES = [
  "Memproses permintaan...",
  "Menghubungi Gemini...",
  "Generating caption...",
  "Masih memproses, mohon tunggu...",
  "Proses lebih lama dari biasa...",
];

export function ShareGeneratingState({
  generationId,
  variantCount,
  onResolved,
  onTimeout,
}: Props) {
  const pollFn = useCallback(async (): Promise<GeneratingStatePollResult> => {
    const res = await fetch(
      `/api/share/generation-status?id=${encodeURIComponent(generationId)}`
    );
    if (!res.ok) {
      return { status: "generating" };
    }
    const data: PollResult = await res.json();
    return { status: data.status, error_message: data.error_message };
  }, [generationId]);

  const handleResolved = useCallback(
    (result: GeneratingStatePollResult) => {
      onResolved({
        status: result.status,
        error_message: result.error_message ?? null,
        output_json: null,
      });
    },
    [onResolved]
  );

  return (
    <GeneratingState
      skeleton={<ShareSkeleton variantCount={variantCount} />}
      statusStages={STATUS_STAGES}
      pollFn={pollFn}
      pollIntervalMs={3000}
      timeoutMs={90000}
      onResolved={handleResolved}
      onTimeout={onTimeout}
      estimateLabel="Estimasi 10–30 detik"
    />
  );
}
