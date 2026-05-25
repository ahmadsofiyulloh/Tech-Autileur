"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { GeneratingState, type GeneratingStatePollResult } from "@/components/operator/generating-state";
import { PromptSkeleton } from "@/components/operator/generating-state-skeletons";
import { NativeButton } from "@/components/ui/native-button";

type Props = {
  promptPackId: string;
};

const PROMPT_STATUS_STAGES = [
  "Memproses permintaan...",
  "Menghubungi Gemini...",
  "Generating prompt...",
  "Masih memproses...",
  "Proses lebih lama dari biasa...",
];

const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED", "CANCELLED", "GENERATED", "ERROR"]);
const ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING", "GENERATING", "WAITING_FOR_KEY", "RETRYING", "generating"]);

type PromptGenerateStatusPayload = {
  status?: string;
  error_message?: string | null;
};

type PromptGenerateStatusResponse =
  | PromptGenerateStatusPayload
  | {
      ok?: boolean;
      data?: PromptGenerateStatusPayload;
    };

function readStatusPayload(payload: unknown): PromptGenerateStatusPayload {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const record = payload as PromptGenerateStatusResponse;
  if ("data" in record && record.data && typeof record.data === "object") {
    return record.data;
  }

  return record as PromptGenerateStatusPayload;
}

export function PromptGeneratingState({ promptPackId }: Props) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  const pollFn = useCallback(async (): Promise<GeneratingStatePollResult> => {
    const res = await fetch(`/api/prompts/${promptPackId}/generate`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return { status: "generating" };
    }
    const data = readStatusPayload(await res.json());
    const status = typeof data.status === "string" ? data.status : "generating";

    if (status === "generated" || status === "error" || TERMINAL_STATUSES.has(status)) {
      return { status, error_message: data.error_message ?? null };
    }

    if (ACTIVE_STATUSES.has(status)) {
      return { status: "generating", error_message: data.error_message ?? null };
    }

    return { status: "generating" };
  }, [promptPackId]);

  const handleResolved = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleTimeout = useCallback(() => {
    setTimedOut(true);
  }, []);

  if (timedOut) {
    return (
      <div className="stack muted-box">
        <strong>Proses lebih lama dari biasa.</strong>
        <span>Prompt mungkin masih diproses di server. Coba refresh untuk cek status terbaru.</span>
        <NativeButton className="compact" type="button" onClick={() => router.refresh()}>
          Refresh
        </NativeButton>
      </div>
    );
  }

  return (
    <GeneratingState
      skeleton={<PromptSkeleton />}
      statusStages={PROMPT_STATUS_STAGES}
      pollFn={pollFn}
      pollIntervalMs={3000}
      timeoutMs={90000}
      onResolved={handleResolved}
      onTimeout={handleTimeout}
      estimateLabel="Estimasi 15–45 detik"
    />
  );
}
