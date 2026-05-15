"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition, type CSSProperties, type ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, ListChecks, Loader2, UploadCloud } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton } from "@/components/ui/native-button";
import type { BulkImportOptionalFields, BulkImportPreviewRow, BulkImportResponse } from "@/lib/bulk-import/types";

type BulkImportMode = "preview" | "import";
type BulkImportSummaryTone = "neutral" | "info" | "success" | "warning" | "danger";
type BulkImportOptionalEntry = [keyof BulkImportOptionalFields, string];
type FloatingPosition = {
  left: number;
  top: number;
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

function statusTone(status: BulkImportPreviewRow["status"]) {
  if (status === "imported" || status === "ready") {
    return "success" as const;
  }

  if (status === "duplicate" || status === "skipped") {
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

  return "Error";
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

function BulkImportSummary({ result }: { result: BulkImportResponse }) {
  return (
    <div className="bulk-import-summary-grid" aria-label="Ringkasan bulk import">
      <BulkImportSummaryMetric label="Total" tone="info" value={result.summary.totalRows} />
      <BulkImportSummaryMetric label="Siap" tone="success" value={result.summary.readyRows} />
      <BulkImportSummaryMetric label="Duplikat" tone="warning" value={result.summary.duplicateRows} />
      <BulkImportSummaryMetric label="Error" tone={result.summary.errorRows ? "danger" : "neutral"} value={result.summary.errorRows} />
      <BulkImportSummaryMetric label="Import" tone={result.summary.importedRows ? "success" : "neutral"} value={result.summary.importedRows} />
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

export function BulkImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<BulkImportMode | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
  }

  function submit(mode: BulkImportMode) {
    if (!file) {
      setError("Pilih file CSV atau XLSX.");
      return;
    }

    startTransition(async () => {
      setActiveMode(mode);
      setError(null);

      try {
        const formData = new FormData();
        formData.set("file", file);

        const response = await fetch(mode === "preview" ? "/api/products/bulk-preview" : "/api/products/bulk-import", {
          body: formData,
          method: "POST",
        });
        const payload = (await response.json()) as BulkImportResponse | { error?: string };

        if (!response.ok) {
          throw new Error("error" in payload && payload.error ? payload.error : "Bulk import gagal.");
        }

        setResult(payload as BulkImportResponse);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Bulk import gagal.");
      } finally {
        setActiveMode(null);
      }
    });
  }

  const rows = result?.rows.slice(0, 12) ?? [];
  const hiddenRowCount = result ? Math.max(result.rows.length - rows.length, 0) : 0;
  const canImport = Boolean(file && result && result.summary.readyRows > 0);
  const busy = isPending || Boolean(activeMode);

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
            onChange={handleFileChange}
            type="file"
          />
        </label>
        <div className="form-actions bulk-import-panel__actions">
          <NativeButton disabled={!file || busy} onClick={() => submit("preview")} type="button">
            {activeMode === "preview" ? <Loader2 size={16} aria-hidden="true" /> : <FileSpreadsheet size={16} aria-hidden="true" />}
            Preview
          </NativeButton>
          <NativeButton className="primary" disabled={!canImport || busy} onClick={() => submit("import")} type="button">
            {activeMode === "import" ? <Loader2 size={16} aria-hidden="true" /> : <UploadCloud size={16} aria-hidden="true" />}
            Import
          </NativeButton>
        </div>
      </div>

      {error ? (
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
              <span className="settings-card-meta-line">Preview metadata</span>
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
