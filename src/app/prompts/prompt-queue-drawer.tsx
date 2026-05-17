"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Pause, Play, RefreshCcw } from "lucide-react";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton, NativeLinkButton } from "@/components/ui/native-button";
import { readJsonApiErrorMessage, unwrapJsonApiData, type JsonApiResponse } from "@/lib/api-response-contract";
import {
  EMPTY_PROMPT_QUEUE_SUMMARY,
  type PromptQueueItem,
  type PromptQueueItemCategory,
  type PromptQueueSnapshot,
} from "@/lib/prompts/prompt-queue-contract";
import { cancelPromptPackGeneration, retryPromptPackGeneration } from "./actions";

type PromptQueueDrawerProps = {
  initialSnapshot: PromptQueueSnapshot;
  queueHref: string;
  snapshotUrl?: string;
  runNextUrl?: string;
};

type RunNextResponse = {
  snapshot?: PromptQueueSnapshot;
  started?: boolean;
  reason?: string;
};

const POLL_INTERVAL_MS = 5_000;

function getActiveTaskCount(snapshot: PromptQueueSnapshot) {
  const summary = snapshot.summary ?? EMPTY_PROMPT_QUEUE_SUMMARY;
  return summary.queued + summary.running + summary.retrying + summary.waitingForKey;
}

function buildPromptDetailHref(returnHref: string, promptPackId: string) {
  const url = new URL(returnHref, "https://local.prompt");
  url.searchParams.delete("queue");
  url.searchParams.set("detail", promptPackId);
  const query = url.searchParams.toString();

  return query ? `${url.pathname}?${query}` : url.pathname;
}

function formatTime(value: string | null) {
  if (!value) {
    return "Belum ada";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function getQueueSectionTitle(category: PromptQueueItemCategory) {
  if (category === "running") {
    return "Sedang Jalan";
  }

  if (category === "waiting") {
    return "Menunggu";
  }

  if (category === "failed") {
    return "Gagal";
  }

  return "Selesai Terbaru";
}

function getQueueSectionItems(snapshot: PromptQueueSnapshot, category: PromptQueueItemCategory) {
  return snapshot.items.filter((item) => item.category === category);
}

function QueueItemRow({ item, queueHref }: { item: PromptQueueItem; queueHref: string }) {
  const detailHref = buildPromptDetailHref(queueHref, item.promptPack.id);
  const retryLabel = `${item.task.retry_count}/${item.task.max_retries}`;
  const keyLabel = item.geminiKey.label
    ? item.geminiKey.model_name
      ? `${item.geminiKey.label} - ${item.geminiKey.model_name}`
      : item.geminiKey.label
    : "Key belum dipilih";
  const timeLabel = item.task.started_at ?? item.task.updated_at ?? item.promptPack.updated_at;

  return (
    <article className="prompt-queue-row" data-category={item.category}>
      <div className="prompt-queue-row__main">
        <div className="prompt-queue-row__copy">
          <span>{`v${item.promptPack.version} - ${item.product.product_code}`}</span>
          <strong title={item.product.product_name}>{item.product.product_name}</strong>
        </div>
        <div className="prompt-queue-row__badges">
          <StatusBadge status={item.task.status} />
          <StatusBadge status={`Retry ${retryLabel}`} tone={item.task.retry_count ? "warning" : "neutral"} />
        </div>
      </div>

      <div className="prompt-queue-row__meta">
        <span>{keyLabel}</span>
        <span>{formatTime(timeLabel)}</span>
      </div>

      {item.task.error_message || item.promptPack.error_message ? (
        <div className="prompt-queue-row__issue">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{item.task.error_message ?? item.promptPack.error_message}</span>
        </div>
      ) : null}

      <div className="prompt-queue-row__actions">
        <NativeLinkButton className="compact tertiary" href={detailHref}>
          <ArrowRight size={15} aria-hidden="true" />
          Buka
        </NativeLinkButton>
        {item.canCancel ? (
          <form action={cancelPromptPackGeneration}>
            <input type="hidden" name="return_to" value={queueHref} />
            <input type="hidden" name="id" value={item.promptPack.id} />
            <input type="hidden" name="product_id" value={item.promptPack.product_id} />
            <PendingActionButton className="compact" pendingLabel="Membatalkan">
              Batalkan
            </PendingActionButton>
          </form>
        ) : null}
        {item.canRetry ? (
          <form action={retryPromptPackGeneration}>
            <input type="hidden" name="return_to" value={queueHref} />
            <input type="hidden" name="id" value={item.promptPack.id} />
            <PendingActionButton className="compact primary" pendingLabel="Mengantrikan">
              Coba Lagi
            </PendingActionButton>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function QueueSection({
  category,
  items,
  queueHref,
}: {
  category: PromptQueueItemCategory;
  items: PromptQueueItem[];
  queueHref: string;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="prompt-queue-section" aria-label={getQueueSectionTitle(category)}>
      <div className="prompt-queue-section__header">
        <strong>{getQueueSectionTitle(category)}</strong>
        <StatusBadge status={`${items.length}`} tone="neutral" />
      </div>
      <div className="prompt-queue-section__list">
        {items.map((item) => (
          <QueueItemRow item={item} key={item.id} queueHref={queueHref} />
        ))}
      </div>
    </section>
  );
}

export function PromptQueueDrawer({ initialSnapshot, queueHref, snapshotUrl = "/api/prompts/queue", runNextUrl = "/api/prompts/queue/run-next" }: PromptQueueDrawerProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [pauseAfterCurrent, setPauseAfterCurrent] = useState(false);
  const [isStartingNext, setIsStartingNext] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeTaskCount = getActiveTaskCount(snapshot);
  const hasRunnableTask = Boolean(snapshot.nextRunnablePromptPackId);
  const hasRunningTask = Boolean(snapshot.runningPromptPackId);
  const isStartDisabled = isStartingNext || (!hasRunnableTask && !hasRunningTask);
  const groupedItems = useMemo(
    () => ({
      running: getQueueSectionItems(snapshot, "running"),
      waiting: getQueueSectionItems(snapshot, "waiting"),
      failed: getQueueSectionItems(snapshot, "failed"),
      generated: getQueueSectionItems(snapshot, "generated"),
    }),
    [snapshot],
  );

  const refreshSnapshot = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const response = await fetch(snapshotUrl, {
        headers: {
          accept: "application/json",
        },
        cache: "no-store",
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(readJsonApiErrorMessage(payload, "Antrian prompt tidak tersedia."));
      }

      setSnapshot(unwrapJsonApiData<PromptQueueSnapshot>(payload as PromptQueueSnapshot | JsonApiResponse<PromptQueueSnapshot>));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Antrian prompt tidak tersedia.");
    } finally {
      setIsRefreshing(false);
    }
  }, [snapshotUrl]);

  const runNextTask = useCallback(async () => {
    if (isStartingNext) {
      return;
    }

    setIsStartingNext(true);
    setErrorMessage(null);

    try {
      const response = await fetch(runNextUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
        },
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(readJsonApiErrorMessage(payload, "Antrian prompt gagal dijalankan."));
      }

      const data = unwrapJsonApiData<RunNextResponse>(payload as RunNextResponse | JsonApiResponse<RunNextResponse>);

      if (data.snapshot) {
        setSnapshot(data.snapshot);
      } else {
        await refreshSnapshot();
      }
      router.refresh();
    } catch (error) {
      setIsQueueRunning(false);
      setPauseAfterCurrent(false);
      setErrorMessage(error instanceof Error ? error.message : "Antrian prompt gagal dijalankan.");
    } finally {
      setIsStartingNext(false);
    }
  }, [isStartingNext, refreshSnapshot, router, runNextUrl]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshSnapshot();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [refreshSnapshot]);

  useEffect(() => {
    if (!isQueueRunning || isStartingNext) {
      return;
    }

    if (hasRunningTask) {
      return;
    }

    if (pauseAfterCurrent) {
      setIsQueueRunning(false);
      setPauseAfterCurrent(false);
      return;
    }

    if (!hasRunnableTask) {
      setIsQueueRunning(false);
      return;
    }

    void runNextTask();
  }, [hasRunnableTask, hasRunningTask, isQueueRunning, isStartingNext, pauseAfterCurrent, runNextTask]);

  return (
    <div className="prompt-queue-drawer stack">
      <div className="prompt-queue-summary-grid" aria-label="Ringkasan antrian prompt">
        <div className="prompt-queue-metric">
          <span>Queued</span>
          <strong>{snapshot.summary.queued}</strong>
        </div>
        <div className="prompt-queue-metric">
          <span>Running</span>
          <strong>{snapshot.summary.running}</strong>
        </div>
        <div className="prompt-queue-metric">
          <span>Retrying</span>
          <strong>{snapshot.summary.retrying}</strong>
        </div>
        <div className="prompt-queue-metric">
          <span>Waiting key</span>
          <strong>{snapshot.summary.waitingForKey}</strong>
        </div>
        <div className="prompt-queue-metric">
          <span>Failed</span>
          <strong>{snapshot.summary.failed}</strong>
        </div>
        <div className="prompt-queue-metric">
          <span>Generated</span>
          <strong>{snapshot.summary.generated}</strong>
        </div>
      </div>

      <div className="prompt-queue-controls" role="group" aria-label="Kontrol antrian prompt">
        <NativeButton
          className="compact primary"
          type="button"
          disabled={isStartDisabled}
          onClick={() => {
            setPauseAfterCurrent(false);
            setIsQueueRunning(true);
          }}
        >
          <Play size={15} aria-hidden="true" />
          {isQueueRunning || isStartingNext ? "Menjalankan" : "Jalankan Antrian"}
        </NativeButton>
        <NativeButton
          className="compact tertiary"
          type="button"
          disabled={!isQueueRunning && !isStartingNext}
          onClick={() => {
            setPauseAfterCurrent(true);
            setIsQueueRunning(false);
          }}
        >
          <Pause size={15} aria-hidden="true" />
          Jeda Setelah Ini
        </NativeButton>
        <NativeButton className="compact tertiary" type="button" disabled={isRefreshing} onClick={() => void refreshSnapshot()}>
          <RefreshCcw size={15} aria-hidden="true" />
          {isRefreshing ? "Memuat" : "Refresh"}
        </NativeButton>
      </div>

      <div className="prompt-queue-live-row" aria-live="polite">
        <StatusBadge status={activeTaskCount ? `${activeTaskCount} task aktif` : "Antrian kosong"} tone={activeTaskCount ? "info" : "neutral"} />
        <span>{formatTime(snapshot.generatedAt)}</span>
      </div>

      {errorMessage ? (
        <div className="prompt-queue-error">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {!snapshot.items.length ? (
        <section className="muted-box">Antrian kosong.</section>
      ) : (
        <>
          <QueueSection category="running" items={groupedItems.running} queueHref={queueHref} />
          <QueueSection category="waiting" items={groupedItems.waiting} queueHref={queueHref} />
          <QueueSection category="failed" items={groupedItems.failed} queueHref={queueHref} />
          <QueueSection category="generated" items={groupedItems.generated} queueHref={queueHref} />
        </>
      )}
    </div>
  );
}
