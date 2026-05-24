"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, ListChecks, Loader2, UploadCloud, X } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton, NativeLinkButton } from "@/components/ui/native-button";
import { readJsonApiErrorMessage, unwrapJsonApiData, type JsonApiResponse } from "@/lib/api-response-contract";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  BulkImportJobRow,
  BulkImportJobSnapshot,
  BulkImportJobStatus,
  BulkImportOptionalFields,
  BulkImportPreviewRow,
  BulkImportResponse,
  BulkImportSummary,
} from "@/lib/bulk-import/types";
import { savePromptPack } from "@/app/prompts/actions";

type BulkImportMode = "preview" | "import" | "cancel";
type BulkImportProgressStatus = "running" | "success" | "error" | "cancelled";
type BulkImportLogTone = "info" | "success" | "warning" | "danger";
type BulkImportSummaryTone = "neutral" | "info" | "success" | "warning" | "danger";
type BulkImportOptionalEntry = [keyof BulkImportOptionalFields, string];
type FloatingPosition = {
  left: number;
  top: number;
};
type BulkImportProgressCounts = {
  cancelled: number;
  driveUploaded: number;
  error: number;
  imported: number;
  productCreated: number;
  skipped: number;
};
type BulkImportProgressLog = {
  detail: string;
  id: string;
  title: string;
  tone: BulkImportLogTone;
};
type BulkImportProgressState = {
  activeRow?: BulkImportJobRow;
  activeStage?: string;
  counts: BulkImportProgressCounts;
  error?: string;
  finishedAt?: number;
  fileName: string;
  jobId: string;
  jobStatus: BulkImportJobStatus;
  logs: BulkImportProgressLog[];
  result?: BulkImportResponse;
  startedAt: number;
  status: BulkImportProgressStatus;
  summary: BulkImportSummary;
};

const OPTIONAL_FIELD_LABELS: Record<keyof BulkImportOptionalFields, string> = {
  availableColors: "Warna Tersedia",
  availableSizes: "Ukuran Tersedia",
  description: "Deskripsi Produk",
  discountText: "Diskon",
  globalReviewText: "Ulasan Global",
  priceText: "Harga",
  ratingText: "Rating",
  shopName: "Nama Penjual",
  soldCountText: "Terjual",
};

const EMPTY_IMPORT_SUMMARY: BulkImportSummary = {
  cancelledRows: 0,
  duplicateRows: 0,
  errorRows: 0,
  importedRows: 0,
  readyRows: 0,
  skippedRows: 0,
  totalRows: 0,
};

const EMPTY_IMPORT_COUNTS: BulkImportProgressCounts = {
  cancelled: 0,
  driveUploaded: 0,
  error: 0,
  imported: 0,
  productCreated: 0,
  skipped: 0,
};

const MAX_IMPORT_LOG_ITEMS = 12;

function statusTone(status: BulkImportPreviewRow["status"]) {
  if (status === "imported" || status === "ready") {
    return "success" as const;
  }

  if (status === "duplicate" || status === "skipped" || status === "cancelled") {
    return "warning" as const;
  }

  return "danger" as const;
}

function statusLabel(status: BulkImportPreviewRow["status"]) {
  if (status === "ready") {
    return "Siap";
  }

  if (status === "duplicate") {
    return "Duplikat";
  }

  if (status === "imported") {
    return "Diimport";
  }

  if (status === "skipped") {
    return "Dilewati";
  }

  if (status === "cancelled") {
    return "Batal";
  }

  return "Error";
}

function progressStatusLabel(status: BulkImportProgressStatus) {
  if (status === "success") {
    return "Selesai";
  }

  if (status === "error") {
    return "Gagal";
  }

  if (status === "cancelled") {
    return "Batal";
  }

  return "Sedang berjalan";
}

function progressStatusTone(status: BulkImportProgressStatus) {
  if (status === "success") {
    return "success" as const;
  }

  if (status === "error") {
    return "danger" as const;
  }

  if (status === "cancelled") {
    return "warning" as const;
  }

  return "info" as const;
}

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(Math.floor(milliseconds / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (!minutes) {
    return `${seconds} detik`;
  }

  return `${minutes} menit ${seconds.toString().padStart(2, "0")} detik`;
}

function rowLabel(row: Pick<BulkImportPreviewRow, "productName" | "rowNumber">) {
  return `Row ${row.rowNumber} - ${row.productName || "Produk tanpa nama"}`;
}

function completedImportRows(counts: BulkImportProgressCounts) {
  return counts.imported + counts.skipped + counts.error + counts.cancelled;
}

function estimateRemainingTime(progress: BulkImportProgressState, now: number) {
  const completedRows = completedImportRows(progress.counts);
  const totalRows = progress.summary.totalRows;

  if (progress.status !== "running" || completedRows < 1 || totalRows <= completedRows) {
    return "Menghitung estimasi";
  }

  const elapsedSeconds = Math.max((now - progress.startedAt) / 1000, 1);
  const averageSecondsPerRow = elapsedSeconds / completedRows;
  const remainingRows = Math.max(totalRows - completedRows, 0);

  return formatElapsed(averageSecondsPerRow * remainingRows * 1000);
}

function importProgressPercent(progress: BulkImportProgressState) {
  const totalRows = progress.summary.totalRows;

  if (!totalRows) {
    return 0;
  }

  return Math.min(Math.round((completedImportRows(progress.counts) / totalRows) * 100), 100);
}

function isActiveJobStatus(status: BulkImportJobStatus) {
  return status === "QUEUED" || status === "RUNNING" || status === "CANCEL_REQUESTED";
}

function progressStatusFromJob(status: BulkImportJobStatus): BulkImportProgressStatus {
  if (status === "COMPLETED") {
    return "success";
  }

  if (status === "FAILED") {
    return "error";
  }

  if (status === "CANCELLED") {
    return "cancelled";
  }

  return "running";
}

function logTone(level: "INFO" | "SUCCESS" | "WARNING" | "ERROR"): BulkImportLogTone {
  if (level === "SUCCESS") {
    return "success";
  }

  if (level === "WARNING") {
    return "warning";
  }

  if (level === "ERROR") {
    return "danger";
  }

  return "info";
}

function progressFromSnapshot(snapshot: BulkImportJobSnapshot): BulkImportProgressState {
  const activeRow =
    snapshot.rows.find((row) =>
      ["RUNNING", "IMAGE_DOWNLOADING", "IMAGE_UPLOADING", "PRODUCT_CREATING"].includes(row.jobStatus),
    ) ?? undefined;
  const summary = snapshot.job.summary ?? EMPTY_IMPORT_SUMMARY;

  return {
    activeRow,
    activeStage: activeRow?.currentStage ?? undefined,
    counts: {
      cancelled: summary.cancelledRows,
      driveUploaded: snapshot.rows.filter((row) => Boolean(row.driveItemId)).length,
      error: summary.errorRows,
      imported: summary.importedRows,
      productCreated: snapshot.rows.filter((row) => Boolean(row.productId)).length,
      skipped: summary.skippedRows,
    },
    error: snapshot.job.errorMessage ?? undefined,
    fileName: snapshot.job.fileName,
    finishedAt: snapshot.job.finishedAt ? Date.parse(snapshot.job.finishedAt) : undefined,
    jobId: snapshot.job.id,
    jobStatus: snapshot.job.status,
    logs: snapshot.logs
      .slice(-MAX_IMPORT_LOG_ITEMS)
      .reverse()
      .map((log) => ({
        detail: log.message,
        id: log.id,
        title: log.title,
        tone: logTone(log.level),
      })),
    result: snapshot.result,
    startedAt: Date.parse(snapshot.job.startedAt ?? snapshot.job.createdAt),
    status: progressStatusFromJob(snapshot.job.status),
    summary,
  };
}

function optionalEntries(row: BulkImportPreviewRow) {
  return (Object.entries(row.optional) as Array<[keyof BulkImportOptionalFields, string | null]>).filter(
    (entry): entry is BulkImportOptionalEntry => Boolean(entry[1]),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function BulkImportSummaryMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: BulkImportSummaryTone;
  value: number;
}) {
  return (
    <span className="bulk-import-summary-metric" data-tone={tone}>
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}

function BulkImportOptionalPopover({
  entries,
  rowNumber,
}: {
  entries: BulkImportOptionalEntry[];
  rowNumber: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !panelRef.current) {
      return;
    }

    const viewportPadding = 8;
    const triggerRect = buttonRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    const left = clamp(triggerRect.right - panelRect.width, viewportPadding, window.innerWidth - panelRect.width - viewportPadding);
    const belowTop = triggerRect.bottom + viewportPadding;
    const aboveTop = triggerRect.top - panelRect.height - viewportPadding;
    const top =
      belowTop + panelRect.height <= window.innerHeight - viewportPadding
        ? belowTop
        : clamp(aboveTop, viewportPadding, window.innerHeight - panelRect.height - viewportPadding);

    setPosition({ left, top });
  }, [entries.length, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const openedAt = window.performance.now();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function handleViewportChange() {
      if (window.performance.now() - openedAt < 160) {
        return;
      }

      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  const panelStyle: CSSProperties = position ? { left: position.left, top: position.top } : { left: 0, top: 0, visibility: "hidden" };

  return (
    <>
      <NativeButton
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Lihat field opsional row ${rowNumber}`}
        className="compact bulk-import-optional-trigger"
        ref={buttonRef}
        type="button"
        onClick={() => {
          setPosition(null);
          setOpen((current) => !current);
        }}
      >
        <ListChecks size={14} aria-hidden="true" />
        {entries.length} field
      </NativeButton>
      {mounted && open
        ? createPortal(
            <div
              aria-label={`Field opsional row ${rowNumber}`}
              className="bulk-import-optional-popover"
              id={panelId}
              ref={panelRef}
              role="dialog"
              style={panelStyle}
            >
              <div className="bulk-import-optional-popover__header">
                <strong>Field opsional</strong>
                <span>Row {rowNumber}</span>
              </div>
              <dl className="bulk-import-optional-popover__list">
                {entries.map(([key, value]) => (
                  <div key={key}>
                    <dt>{OPTIONAL_FIELD_LABELS[key]}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function BulkImportProgressPanel({
  canCancel,
  now,
  onCancel,
  progress,
}: {
  canCancel: boolean;
  now: number;
  onCancel: () => void;
  progress: BulkImportProgressState;
}) {
  const elapsedMilliseconds = (progress.finishedAt ?? now) - progress.startedAt;
  const completedRows = completedImportRows(progress.counts);
  const pendingRows = Math.max(progress.summary.totalRows - completedRows, 0);
  const percent = importProgressPercent(progress);
  const title =
    progress.status === "success"
      ? "Import selesai"
      : progress.status === "error"
        ? "Import gagal"
        : progress.status === "cancelled"
          ? "Import dibatalkan"
          : progress.jobStatus === "CANCEL_REQUESTED"
            ? "Import sedang dibatalkan"
            : "Import sedang berjalan";
  const activeDetail = progress.activeRow
    ? `${rowLabel(progress.activeRow)}${progress.activeStage ? ` - ${progress.activeStage}` : ""}`
    : progress.status === "running"
      ? "Menunggu progress row pertama"
      : progress.fileName;

  return (
    <section
      aria-live={progress.status === "error" ? "assertive" : "polite"}
      className="bulk-import-activity"
      data-status={progress.status}
      role={progress.status === "error" ? "alert" : "status"}
    >
      <div className="bulk-import-activity__header">
        <div className="stack-tight">
          <strong>{title}</strong>
          <span className="settings-card-meta-line">Berjalan {formatElapsed(elapsedMilliseconds)}</span>
        </div>
        <StatusBadge status={progressStatusLabel(progress.status)} tone={progressStatusTone(progress.status)} />
      </div>

      <div className="bulk-import-progress-bar" aria-label={`Progress import ${percent}%`}>
        <span style={{ inlineSize: `${percent}%` }} />
      </div>

      <div className="bulk-import-progress-meta">
        <span>
          {completedRows} dari {progress.summary.totalRows} row selesai
        </span>
        <span>Estimasi sisa {estimateRemainingTime(progress, now)}</span>
      </div>

      <div className="bulk-import-live-metrics" aria-label="Progress import bulk upload">
        <BulkImportSummaryMetric label="Total" tone="info" value={progress.summary.totalRows} />
        <BulkImportSummaryMetric label="Drive" tone={progress.counts.driveUploaded ? "success" : "neutral"} value={progress.counts.driveUploaded} />
        <BulkImportSummaryMetric label="Produk" tone={progress.counts.productCreated ? "success" : "neutral"} value={progress.counts.productCreated} />
        <BulkImportSummaryMetric label="Belum" tone={pendingRows ? "warning" : "neutral"} value={pendingRows} />
        <BulkImportSummaryMetric label="Dilewati" tone={progress.counts.skipped ? "warning" : "neutral"} value={progress.counts.skipped} />
        <BulkImportSummaryMetric label="Error" tone={progress.counts.error ? "danger" : "neutral"} value={progress.counts.error} />
        <BulkImportSummaryMetric label="Batal" tone={progress.counts.cancelled ? "warning" : "neutral"} value={progress.counts.cancelled} />
      </div>

      <div className="bulk-import-active-row">
        <span className="subtle">Row aktif</span>
        <strong>{activeDetail}</strong>
      </div>

      {progress.error ? <p className="bulk-import-activity__helper">{progress.error}</p> : null}

      {progress.logs.length ? (
        <ol className="bulk-import-log-list" aria-label="Log import terakhir">
          {progress.logs.map((log) => (
            <li className="bulk-import-log-list__item" data-tone={log.tone} key={log.id}>
              <span className="bulk-import-log-list__dot" aria-hidden="true" />
              <span className="bulk-import-log-list__copy">
                <strong>{log.title}</strong>
                <span>{log.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {canCancel ? (
        <div className="bulk-import-activity__footer">
          <NativeButton className="compact destructive" onClick={onCancel} type="button">
            <X size={14} aria-hidden="true" />
            Batal
          </NativeButton>
        </div>
      ) : null}
    </section>
  );
}

function BulkImportSummary({ result }: { result: BulkImportResponse }) {
  return (
    <div className="bulk-import-summary-grid" aria-label="Ringkasan bulk import">
      <BulkImportSummaryMetric label="Total" tone="info" value={result.summary.totalRows} />
      <BulkImportSummaryMetric label="Siap" tone="success" value={result.summary.readyRows} />
      <BulkImportSummaryMetric label="Duplikat" tone="warning" value={result.summary.duplicateRows} />
      <BulkImportSummaryMetric label="Dilewati" tone={result.summary.skippedRows ? "warning" : "neutral"} value={result.summary.skippedRows} />
      <BulkImportSummaryMetric label="Error" tone={result.summary.errorRows ? "danger" : "neutral"} value={result.summary.errorRows} />
      <BulkImportSummaryMetric label="Import" tone={result.summary.importedRows ? "success" : "neutral"} value={result.summary.importedRows} />
      <BulkImportSummaryMetric label="Batal" tone={result.summary.cancelledRows ? "warning" : "neutral"} value={result.summary.cancelledRows} />
    </div>
  );
}

function promptReadinessTone(status?: string) {
  if (status === "READY_FOR_PROMPT" || status === "PROMPT_GENERATED") {
    return "success" as const;
  }

  if (status === "PROMPT_FAILED") {
    return "danger" as const;
  }

  if (status === "PROMPT_QUEUED") {
    return "info" as const;
  }

  return "warning" as const;
}

function BulkImportPromptCell({ row }: { row: BulkImportPreviewRow }) {
  const readiness = row.promptReadiness ?? null;
  const promptPackId = readiness?.promptPackId ?? null;
  const canCreatePrompt =
    row.status === "imported" &&
    Boolean(row.productId && row.intakeSessionId && readiness?.affiliateProfileId && readiness?.sourceProductImageId) &&
    Boolean(readiness?.isBulkEnqueueEligible);

  if (promptPackId) {
    return (
      <div className="bulk-import-prompt-cell">
        <StatusBadge status={readiness?.promptPackStatus ?? "Prompt dibuat"} tone="success" />
        <NativeLinkButton className="compact" href={`/prompts?detail=${promptPackId}`}>
          <FileText size={14} aria-hidden="true" />
          Buka
        </NativeLinkButton>
      </div>
    );
  }

  if (!row.productId) {
    return <span className="settings-card-meta-line">-</span>;
  }

  if (!readiness) {
    return <StatusBadge status="Prompt belum dicek" tone="info" />;
  }

  return (
    <div className="bulk-import-prompt-cell">
      <StatusBadge status={readiness.label} tone={promptReadinessTone(readiness.status)} />
      {canCreatePrompt ? (
        <form action={savePromptPack}>
          <input type="hidden" name="intent" value="create_generate" />
          <input type="hidden" name="status" value="DRAFT" />
          <input type="hidden" name="version" value={1} />
          <input type="hidden" name="product_id" value={row.productId ?? ""} />
          <input type="hidden" name="intake_session_id" value={row.intakeSessionId ?? ""} />
          <input type="hidden" name="affiliate_profile_id" value={readiness.affiliateProfileId ?? ""} />
          <input type="hidden" name="source_product_image_id" value={readiness.sourceProductImageId ?? ""} />
          <input type="hidden" name="return_to" value="/products/new" />
          <PendingActionButton className="compact primary" pendingLabel="Membuat">
            Buat Prompt
          </PendingActionButton>
        </form>
      ) : readiness.reasons.length ? (
        <div className="bulk-import-prompt-cell__reasons" aria-label="Alasan prompt belum siap">
          {readiness.reasons.slice(0, 2).map((reason) => (
            <StatusBadge key={reason.key} status={reason.label} tone="warning" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BulkImportPreviewTable({ rows }: { rows: BulkImportPreviewRow[] }) {
  return (
    <div className="table-wrap bulk-import-table-wrap">
      <table className="data-table product-table bulk-import-table">
        <thead>
          <tr>
            <th>Produk</th>
            <th>Source</th>
            <th>Status</th>
            <th>Prompt</th>
            <th>Opsional</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const optional = optionalEntries(row);

            return (
              <tr key={`${row.rowNumber}-${row.productUrl || row.imageUrl}`} data-status={row.status}>
                <td>
                  <div className="bulk-import-table__product stack-tight">
                    <strong title={row.productName}>{row.productName || `Row ${row.rowNumber}`}</strong>
                    <span className="settings-card-meta-line">
                      Row {row.rowNumber}
                      {row.marketplaceLabel ? ` | ${row.marketplaceLabel}` : ""}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="bulk-import-table__links">
                    <span className="bulk-import-table__link" title={row.productUrl}>
                      <span className="bulk-import-table__link-label">Produk</span>
                      <span className="bulk-import-table__link-value">{row.productUrl || "URL Produk kosong"}</span>
                    </span>
                    <span className="bulk-import-table__link" title={row.imageUrl}>
                      <span className="bulk-import-table__link-label">Gambar</span>
                      <span className="bulk-import-table__link-value">{row.imageUrl || "Gambar Produk kosong"}</span>
                    </span>
                  </div>
                </td>
                <td>
                  <div className="bulk-import-table__status">
                    <StatusBadge status={statusLabel(row.status)} tone={statusTone(row.status)} />
                    {row.errors.length ? (
                      <ul className="bulk-import-row__errors" aria-label={`Error row ${row.rowNumber}`}>
                        {row.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </td>
                <td>
                  <BulkImportPromptCell row={row} />
                </td>
                <td>
                  {optional.length ? (
                    <BulkImportOptionalPopover entries={optional} rowNumber={row.rowNumber} />
                  ) : (
                    <span className="settings-card-meta-line">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function readSnapshotResponse(response: Response) {
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(readJsonApiErrorMessage(payload, "Bulk import gagal."));
  }

  return unwrapJsonApiData<BulkImportJobSnapshot>(payload as BulkImportJobSnapshot | JsonApiResponse<BulkImportJobSnapshot>);
}

async function readActiveSnapshotResponse(response: Response) {
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(readJsonApiErrorMessage(payload, "Bulk import gagal."));
  }

  const data = unwrapJsonApiData<{ snapshot?: BulkImportJobSnapshot | null }>(
    payload as { snapshot?: BulkImportJobSnapshot | null } | JsonApiResponse<{ snapshot?: BulkImportJobSnapshot | null }>,
  );

  return data.snapshot ?? null;
}

export function BulkImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<BulkImportMode | null>(null);
  const [jobSnapshot, setJobSnapshot] = useState<BulkImportJobSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const runningJobIds = useRef(new Set<string>());
  const jobId = jobSnapshot?.job.id ?? null;
  const activeJob = jobSnapshot ? isActiveJobStatus(jobSnapshot.job.status) : false;
  const importProgress = jobSnapshot ? progressFromSnapshot(jobSnapshot) : null;

  const applyJobSnapshot = useCallback((snapshot: BulkImportJobSnapshot | null) => {
    setJobSnapshot(snapshot);

    if (snapshot) {
      setResult(snapshot.result);
    }
  }, []);

  const loadJobSnapshot = useCallback(
    async (targetJobId: string) => {
      const response = await fetch(`/api/products/bulk-import/jobs/${targetJobId}`, {
        cache: "no-store",
      });
      const snapshot = await readSnapshotResponse(response);
      applyJobSnapshot(snapshot);
      return snapshot;
    },
    [applyJobSnapshot],
  );

  const runJob = useCallback(
    async (targetJobId: string) => {
      if (runningJobIds.current.has(targetJobId)) {
        return null;
      }

      runningJobIds.current.add(targetJobId);
      try {
        const response = await fetch(`/api/products/bulk-import/jobs/${targetJobId}/run`, {
          method: "POST",
        });
        const snapshot = await readSnapshotResponse(response);
        applyJobSnapshot(snapshot);
        return snapshot;
      } finally {
        runningJobIds.current.delete(targetJobId);
      }
    },
    [applyJobSnapshot],
  );

  useEffect(() => {
    if (importProgress?.status !== "running") {
      return;
    }

    setNow(Date.now());
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [importProgress?.startedAt, importProgress?.status]);

  useEffect(() => {
    let cancelled = false;

    async function loadActiveJob() {
      try {
        const response = await fetch("/api/products/bulk-import/jobs/active", {
          cache: "no-store",
        });
        const snapshot = await readActiveSnapshotResponse(response);

        if (!cancelled && snapshot) {
          applyJobSnapshot(snapshot);
        }
      } catch {
        // The visible panel handles explicit import errors.
      }
    }

    void loadActiveJob();

    return () => {
      cancelled = true;
    };
  }, [applyJobSnapshot]);

  useEffect(() => {
    if (!jobSnapshot || !isActiveJobStatus(jobSnapshot.job.status) || jobSnapshot.job.status === "CANCEL_REQUESTED") {
      return;
    }

    void runJob(jobSnapshot.job.id).catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : "Bulk import gagal.");
    });
  }, [jobSnapshot, runJob]);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    const targetJobId = jobId;
    const supabase = createSupabaseBrowserClient();
    let refreshTimer: number | null = null;

    function scheduleRefresh() {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        void loadJobSnapshot(targetJobId).catch(() => undefined);
      }, 160);
    }

    const channel = supabase
      .channel(`bulk-import-job-${targetJobId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bulk_import_jobs", filter: `id=eq.${targetJobId}` },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bulk_import_job_rows", filter: `job_id=eq.${targetJobId}` },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bulk_import_job_logs", filter: `job_id=eq.${targetJobId}` },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      void supabase.removeChannel(channel);
    };
  }, [jobId, loadJobSnapshot]);

  useEffect(() => {
    if (!jobId || !activeJob) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadJobSnapshot(jobId).catch(() => undefined);
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeJob, jobId, loadJobSnapshot]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    if (!activeJob) {
      setResult(null);
      setJobSnapshot(null);
    }
    setError(null);
  }

  async function submitPreview(selectedFile: File) {
    const formData = new FormData();
    formData.set("file", selectedFile);

    const response = await fetch("/api/products/bulk-preview", {
      body: formData,
      method: "POST",
    });
    const payload = (await response.json()) as unknown;

    if (!response.ok) {
      throw new Error(readJsonApiErrorMessage(payload, "Bulk preview gagal."));
    }

    setResult(unwrapJsonApiData<BulkImportResponse>(payload as BulkImportResponse | JsonApiResponse<BulkImportResponse>));
  }

  async function submitImport(selectedFile: File) {
    const formData = new FormData();
    formData.set("file", selectedFile);
    setNow(Date.now());

    const response = await fetch("/api/products/bulk-import/jobs", {
      body: formData,
      method: "POST",
    });
    const snapshot = await readSnapshotResponse(response);

    applyJobSnapshot(snapshot);
    await runJob(snapshot.job.id);
  }

  async function cancelImport() {
    if (!jobSnapshot || !activeJob) {
      return;
    }

    setActiveMode("cancel");
    setError(null);

    try {
      const response = await fetch(`/api/products/bulk-import/jobs/${jobSnapshot.job.id}/cancel`, {
        method: "POST",
      });
      const snapshot = await readSnapshotResponse(response);
      applyJobSnapshot(snapshot);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Bulk import gagal.");
    } finally {
      setActiveMode(null);
    }
  }

  async function submit(mode: BulkImportMode) {
    if (!file) {
      setError("Pilih file CSV atau XLSX.");
      return;
    }

    setActiveMode(mode);
    setError(null);

    try {
      if (mode === "preview") {
        if (!activeJob) {
          applyJobSnapshot(null);
        }
        await submitPreview(file);
      } else {
        await submitImport(file);
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Bulk import gagal.";
      setError(message);
    } finally {
      setActiveMode(null);
    }
  }

  const rows = result?.rows.slice(0, 12) ?? [];
  const hiddenRowCount = result ? Math.max(result.rows.length - rows.length, 0) : 0;
  const canImport = Boolean(file && result && result.summary.readyRows > 0 && !activeJob);
  const busy = Boolean(activeMode);

  return (
    <section className="bulk-import-panel desktop-action-set" aria-busy={busy} aria-label="Bulk import produk">
      <div className="bulk-import-panel__header">
        <div className="bulk-import-panel__icon" aria-hidden="true">
          <FileSpreadsheet size={18} />
        </div>
        <div className="bulk-import-panel__title stack-tight">
          <h2>Bulk Upload</h2>
          <span className="settings-card-meta-line">CSV/XLSX scraping produk</span>
        </div>
      </div>

      <div className="bulk-import-panel__controls">
        <label className="bulk-import-file-field stack-tight" htmlFor="bulk_product_file">
          <span className="subtle">File</span>
          <input
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            id="bulk_product_file"
            name="bulk_product_file"
            disabled={activeJob}
            onChange={handleFileChange}
            type="file"
          />
        </label>
        <div className="form-actions bulk-import-panel__actions">
          <NativeButton disabled={!file || busy || activeJob} onClick={() => void submit("preview")} type="button">
            {activeMode === "preview" ? (
              <Loader2 className="spin" size={16} aria-hidden="true" />
            ) : (
              <FileSpreadsheet size={16} aria-hidden="true" />
            )}
            Preview
          </NativeButton>
          <NativeButton className="primary" disabled={!canImport || busy} onClick={() => void submit("import")} type="button">
            {activeMode === "import" ? (
              <Loader2 className="spin" size={16} aria-hidden="true" />
            ) : (
              <UploadCloud size={16} aria-hidden="true" />
            )}
            Import
          </NativeButton>
        </div>
      </div>

      {importProgress ? (
        <BulkImportProgressPanel
          canCancel={activeJob && activeMode !== "cancel" && importProgress.jobStatus !== "CANCEL_REQUESTED"}
          now={now}
          progress={importProgress}
          onCancel={() => void cancelImport()}
        />
      ) : null}

      {error && !importProgress ? (
        <section className="error-box" aria-live="polite">
          <AlertTriangle size={16} aria-hidden="true" />
          {error}
        </section>
      ) : null}

      {result ? (
        <section className="bulk-import-result stack-tight" aria-live="polite">
          <div className="bulk-import-result__header">
            <div className="stack-tight">
              <strong>{result.fileName}</strong>
              <span className="settings-card-meta-line">{result.summary.importedRows ? "Hasil import" : "Preview metadata"}</span>
            </div>
            {result.summary.importedRows ? <CheckCircle2 size={18} aria-hidden="true" /> : null}
          </div>
          <BulkImportSummary result={result} />
          {rows.length ? (
            <BulkImportPreviewTable rows={rows} />
          ) : (
            <EmptyState icon={FileSpreadsheet} title="Row belum ada." description="Cek format file." />
          )}
          {hiddenRowCount ? <span className="settings-card-meta-line">{hiddenRowCount} row lain tidak ditampilkan.</span> : null}
        </section>
      ) : null}
    </section>
  );
}
