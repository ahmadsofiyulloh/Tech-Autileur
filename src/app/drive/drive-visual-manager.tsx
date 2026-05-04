"use client";

import {
  Check,
  ExternalLink,
  File,
  FileText,
  Folder,
  Image as ImageIcon,
  Link2,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { saveDriveItem } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { OperatorBottomSheet } from "@/components/operator/bottom-sheet";
import { StatusBadge } from "@/components/operator/status-badge";

export type DriveVisualItem = {
  id: string;
  drive_item_id: string | null;
  item_type: string;
  name: string;
  drive_url: string;
  drive_path: string;
  mime_type: string | null;
  purpose: string;
  status: string;
  size_bytes: number | null;
  checksum: string | null;
  drive_modified_at: string | null;
};

type DriveVisualManagerProps = {
  items: DriveVisualItem[];
  uploadTarget: {
    id: string;
    name: string;
    drive_path: string;
  } | null;
};

type DriveFileFormMode = "upload" | "attach";

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

function formatDate(value: string | null) {
  if (!value) {
    return "Belum tersinkron";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Belum tersinkron";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function matchesQuery(item: DriveVisualItem, query: string) {
  const value = query.trim().toLowerCase();

  if (!value) {
    return true;
  }

  return [item.name, item.drive_path, item.item_type, item.purpose, item.status, item.mime_type ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(value);
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
      <span className="drive-tile__header">
        <span className="drive-tile__copy">
          <strong title={item.name}>{item.name}</strong>
          <span className="text-caption">{formatSize(item.size_bytes)}</span>
        </span>
        <span className="drive-tile__status">
          <StatusBadge status={item.status} />
        </span>
      </span>
    </button>
  );
}

function DrivePreviewSheet({ item, onClose }: { item: DriveVisualItem; onClose: () => void }) {
  return (
    <OperatorBottomSheet
      ariaLabel="Preview Drive"
      className="operator-bottom-sheet--drive-preview"
      open={Boolean(item)}
      subtitle={item.drive_path}
      title={item.name}
      onClose={onClose}
    >
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
        <div className="metric">
          <span>Modified</span>
          <strong>{formatDate(item.drive_modified_at)}</strong>
        </div>
      </div>
      {item.checksum ? <p className="text-caption">Checksum: {item.checksum}</p> : null}
      <div className="form-actions form-actions--single">
        <a className="button primary" href={item.drive_url} target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" />
          Buka link
        </a>
      </div>
    </OperatorBottomSheet>
  );
}

function DriveFileDrawer({
  mode,
  onClose,
  onModeChange,
  open,
  uploadTarget,
}: {
  mode: DriveFileFormMode;
  onClose: () => void;
  onModeChange: (mode: DriveFileFormMode) => void;
  open: boolean;
  uploadTarget: DriveVisualManagerProps["uploadTarget"];
}) {
  const targetLabel = uploadTarget ? `${uploadTarget.name} - ${uploadTarget.drive_path}` : "Sinkronkan folder target dulu.";

  return (
    <OperatorBottomSheet
      ariaLabel="Tambah file Drive"
      className="operator-bottom-sheet--drive-file"
      open={open}
      subtitle={targetLabel}
      title="Tambah file"
      onClose={onClose}
    >
      <div className="content-filter-tabs drive-file-mode-tabs" role="tablist" aria-label="Mode tambah file">
        <button
          aria-selected={mode === "upload"}
          className="content-filter-tab"
          data-active={mode === "upload" ? "true" : undefined}
          onClick={() => onModeChange("upload")}
          role="tab"
          type="button"
        >
          Unggah
        </button>
        <button
          aria-selected={mode === "attach"}
          className="content-filter-tab"
          data-active={mode === "attach" ? "true" : undefined}
          onClick={() => onModeChange("attach")}
          role="tab"
          type="button"
        >
          Tautkan
        </button>
      </div>

      {mode === "upload" ? (
        <form action={saveDriveItem} className="drive-file-form stack">
          <input type="hidden" name="intent" value="upload_file" />
          <input type="hidden" name="parent_id" value={uploadTarget?.id ?? ""} />
          <input type="hidden" name="purpose" value="OTHER" />
          <label className="stack auth-field" htmlFor="drive-upload-file">
            <span>File</span>
            <input id="drive-upload-file" name="upload_file" type="file" required disabled={!uploadTarget} />
          </label>
          <label className="stack auth-field" htmlFor="drive-upload-name">
            <span>Nama opsional</span>
            <input id="drive-upload-name" name="name" type="text" placeholder="Nama file" disabled={!uploadTarget} />
          </label>
          <button className="button primary" type="submit" disabled={!uploadTarget}>
            <Upload size={16} aria-hidden="true" />
            Unggah
          </button>
        </form>
      ) : (
        <form action={saveDriveItem} className="drive-file-form stack">
          <input type="hidden" name="intent" value="attach_file" />
          <input type="hidden" name="parent_id" value={uploadTarget?.id ?? ""} />
          <input type="hidden" name="purpose" value="OTHER" />
          <label className="stack auth-field" htmlFor="drive-attach-url">
            <span>Tautan file</span>
            <input
              id="drive-attach-url"
              name="drive_item_url"
              type="text"
              placeholder="https://drive.google.com/file/d/..."
              required
              disabled={!uploadTarget}
            />
          </label>
          <button className="button primary" type="submit" disabled={!uploadTarget}>
            <Link2 size={16} aria-hidden="true" />
            Tautkan
          </button>
        </form>
      )}
    </OperatorBottomSheet>
  );
}

export function DriveVisualManager({ items, uploadTarget }: DriveVisualManagerProps) {
  const [query, setQuery] = useState("");
  const [fileDrawerOpen, setFileDrawerOpen] = useState(false);
  const [fileFormMode, setFileFormMode] = useState<DriveFileFormMode>("upload");
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const filteredItems = useMemo(() => items.filter((item) => matchesQuery(item, query)), [items, query]);
  const previewItem = items.find((item) => item.id === previewItemId) ?? null;
  const resultsLabel = query.trim() ? `${filteredItems.length} dari ${items.length} item` : `${items.length} item`;

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

  function openFileDrawer(mode: DriveFileFormMode = "upload") {
    setFileFormMode(mode);
    setFileDrawerOpen(true);
  }

  return (
    <section className="stack">
      <div className="settings-list-toolbar">
        <label className="product-search" htmlFor="drive-search">
          <Search size={16} aria-hidden="true" />
          <input
            id="drive-search"
            name="drive-search"
            placeholder="Cari Drive"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="settings-inline-summary">
        <span>{resultsLabel}</span>
        <div className="drive-summary-actions">
          {query ? (
            <button className="button compact" type="button" onClick={() => setQuery("")}>
              <X size={15} aria-hidden="true" />
              Reset
            </button>
          ) : null}
          <button className="button compact primary" type="button" onClick={() => openFileDrawer()} disabled={!uploadTarget}>
            <Plus size={15} aria-hidden="true" />
            Tambah file
          </button>
        </div>
      </div>

      {selectedIds.size ? (
        <div className="muted-box section-card__actions">
          <strong>{selectedIds.size} dipilih</strong>
          <button className="button compact" type="button" onClick={() => setSelectedIds(new Set())}>
            Bersihkan
          </button>
        </div>
      ) : null}

      {filteredItems.length ? (
        <div className="drive-visual-grid">
          {filteredItems.map((item) => (
            <DriveTile
              item={item}
              key={item.id}
              selected={selectedIds.has(item.id)}
              onOpen={() => setPreviewItemId(item.id)}
              onToggleSelected={() => toggleSelected(item.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Folder}
          title={items.length ? "Tidak ada item yang cocok." : "Belum ada item Drive."}
          description={items.length ? "Coba kata kunci lain." : "Sinkronkan folder Drive dulu."}
          action={
            query ? (
              <button className="button compact primary" type="button" onClick={() => setQuery("")}>
                Reset pencarian
              </button>
            ) : null
          }
        />
      )}

      <DriveFileDrawer
        mode={fileFormMode}
        open={fileDrawerOpen}
        uploadTarget={uploadTarget}
        onClose={() => setFileDrawerOpen(false)}
        onModeChange={setFileFormMode}
      />
      {previewItem ? <DrivePreviewSheet item={previewItem} onClose={() => setPreviewItemId(null)} /> : null}
    </section>
  );
}
