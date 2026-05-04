"use client";

import { Check, ExternalLink, File, FileText, Folder, Image as ImageIcon, X } from "lucide-react";
import { useRef, useState } from "react";
import { StatusBadge } from "@/components/operator/status-badge";

export type DriveVisualItem = {
  id: string;
  item_type: string;
  name: string;
  drive_url: string;
  drive_path: string;
  mime_type: string | null;
  purpose: string;
  status: string;
  size_bytes: number | null;
};

type DriveVisualManagerProps = {
  items: DriveVisualItem[];
};

function isImageLike(item: DriveVisualItem) {
  return item.mime_type?.startsWith("image/") || item.purpose === "SOURCE_IMAGE";
}

function formatSize(sizeBytes: number | null) {
  if (!sizeBytes) {
    return "Metadata";
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

function DriveIcon({ item }: { item: DriveVisualItem }) {
  if (item.item_type === "FOLDER") {
    return <Folder size={30} aria-hidden="true" />;
  }

  if (isImageLike(item)) {
    return <ImageIcon size={30} aria-hidden="true" />;
  }

  if (item.mime_type?.includes("pdf") || item.name.toLowerCase().endsWith(".pdf")) {
    return <FileText size={30} aria-hidden="true" />;
  }

  return <File size={30} aria-hidden="true" />;
}

function DriveTile({
  item,
  selected,
  onOpen,
  onToggleSelected,
}: {
  item: DriveVisualItem;
  selected: boolean;
  onOpen: () => void;
  onToggleSelected: () => void;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  function startLongPress() {
    longPressed.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onToggleSelected();
      longPressTimer.current = null;
    }, 420);
  }

  function cancelLongPress() {
    if (!longPressTimer.current) {
      return;
    }

    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  return (
    <button
      className="drive-tile"
      data-selected={selected ? "true" : undefined}
      type="button"
      onClick={() => {
        if (longPressed.current) {
          longPressed.current = false;
          return;
        }

        onOpen();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onToggleSelected();
      }}
      onPointerCancel={cancelLongPress}
      onPointerDown={startLongPress}
      onPointerLeave={cancelLongPress}
      onPointerUp={cancelLongPress}
    >
      {selected ? (
        <span className="drive-tile__check" aria-label="Dipilih">
          <Check size={15} aria-hidden="true" />
        </span>
      ) : null}
      <span className="drive-tile__thumb">
        {isImageLike(item) ? <img alt="" src={item.drive_url} /> : <DriveIcon item={item} />}
      </span>
      <span className="stack-tight">
        <strong>{item.name}</strong>
        <span className="text-caption">{formatSize(item.size_bytes)}</span>
      </span>
      <span className="visual-chip-row">
        <StatusBadge status={item.status} />
      </span>
    </button>
  );
}

function DrivePreviewSheet({ item, onClose }: { item: DriveVisualItem; onClose: () => void }) {
  return (
    <>
      <button className="drive-sheet-backdrop" type="button" aria-label="Tutup preview" onClick={onClose} />
      <aside className="drive-bottom-sheet" aria-label="Preview Drive">
        <span className="drive-bottom-sheet__handle" aria-hidden="true" />
        <div className="section-card__actions">
          <div className="stack-tight">
            <strong>{item.name}</strong>
            <span className="subtle">{item.drive_path}</span>
          </div>
          <button className="button compact" type="button" aria-label="Tutup" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="drive-tile__thumb">
          {isImageLike(item) ? <img alt={item.name} src={item.drive_url} /> : <DriveIcon item={item} />}
        </div>
        <div className="metric-grid">
          <div className="metric">
            <span>Status</span>
            <strong>
              <StatusBadge status={item.status} />
            </strong>
          </div>
          <div className="metric">
            <span>Purpose</span>
            <strong>{item.purpose}</strong>
          </div>
          <div className="metric">
            <span>Type</span>
            <strong>{item.item_type}</strong>
          </div>
          <div className="metric">
            <span>Size</span>
            <strong>{formatSize(item.size_bytes)}</strong>
          </div>
        </div>
        <a className="button primary" href={item.drive_url} target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" />
          Open link
        </a>
      </aside>
    </>
  );
}

export function DriveVisualManager({ items }: DriveVisualManagerProps) {
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const previewItem = items.find((item) => item.id === previewItemId) ?? null;

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  return (
    <section className="stack">
      {selectedIds.size ? (
        <div className="muted-box section-card__actions">
          <strong>{selectedIds.size} dipilih</strong>
          <button className="button compact" type="button" onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      ) : null}
      <div className="drive-visual-grid">
        {items.map((item) => (
          <DriveTile
            item={item}
            key={item.id}
            selected={selectedIds.has(item.id)}
            onOpen={() => setPreviewItemId(item.id)}
            onToggleSelected={() => toggleSelected(item.id)}
          />
        ))}
      </div>
      {previewItem ? <DrivePreviewSheet item={previewItem} onClose={() => setPreviewItemId(null)} /> : null}
    </section>
  );
}
