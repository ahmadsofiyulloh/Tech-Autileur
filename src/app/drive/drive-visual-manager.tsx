"use client";

import {
  Check,
  ChevronLeft,
  ExternalLink,
  File,
  FileText,
  Folder,
  Image as ImageIcon,
  Eye,
  Link2,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { saveDriveItem } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { MediaThumbnailFrame } from "@/components/operator/media-thumbnail-frame";
import { OperatorBottomSheet } from "@/components/operator/bottom-sheet";
import { StatusBadge } from "@/components/operator/status-badge";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { NativeAnchorButton, NativeButton } from "@/components/ui/native-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { formatAppDateTime } from "@/lib/app-time";

export type DriveVisualItem = {
  id: string;
  drive_item_id: string | null;
  item_type: string;
  name: string;
  drive_url: string;
  drive_path: string;
  parent_id: string | null;
  parent_drive_item_id: string | null;
  mime_type: string | null;
  purpose: string;
  status: string;
  size_bytes: number | null;
  checksum: string | null;
  drive_modified_at: string | null;
  preview_url: string | null;
  detail_url: string | null;
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
type DriveViewMode = "grid" | "list";

type DrivePressGestureState = {
  clickSuppressed: boolean;
  longPressCommitted: boolean;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
};

const LONG_PRESS_DELAY_MS = 420;
const LONG_PRESS_MOVE_TOLERANCE_PX = 12;
const LONG_PRESS_NATIVE_SUPPRESS_MS = 250;
const DESKTOP_DRIVE_MEDIA_QUERY = "(min-width: 861px)";

type DriveFolderNode = {
  id: string;
  name: string;
  drive_path: string;
  parent_id: string | null;
  parent_drive_item_id: string | null;
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

function formatDate(value: string | null) {
  return formatAppDateTime(value, "Belum tersinkron");
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

function isFolderItem(item: DriveVisualItem) {
  return item.item_type === "FOLDER";
}

function normalizeDrivePath(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed || trimmed === "/") {
    return "";
  }

  return trimmed.replace(/\/+$/g, "");
}

function getParentDrivePath(value: string | null | undefined) {
  const normalized = normalizeDrivePath(value);

  if (!normalized) {
    return "";
  }

  const hasLeadingSlash = normalized.startsWith("/");
  const segments = normalized.split("/").filter(Boolean);

  segments.pop();

  if (!segments.length) {
    return hasLeadingSlash ? "/" : "";
  }

  return `${hasLeadingSlash ? "/" : ""}${segments.join("/")}`;
}

function isDirectPathChild(item: DriveVisualItem, parentPath: string | null | undefined) {
  const itemPath = normalizeDrivePath(item.drive_path);
  const normalizedParentPath = normalizeDrivePath(parentPath);

  if (!itemPath || !normalizedParentPath || itemPath === normalizedParentPath) {
    return false;
  }

  if (!itemPath.startsWith(`${normalizedParentPath}/`)) {
    return false;
  }

  return itemPath.slice(normalizedParentPath.length + 1).split("/").filter(Boolean).length === 1;
}

function sortDriveItems(a: DriveVisualItem, b: DriveVisualItem) {
  if (isFolderItem(a) !== isFolderItem(b)) {
    return isFolderItem(a) ? -1 : 1;
  }

  return a.name.localeCompare(b.name, "id-ID", { numeric: true, sensitivity: "base" });
}

function getItemMetaLabel(item: DriveVisualItem) {
  return isFolderItem(item) ? "Folder" : formatSize(item.size_bytes);
}

function getPathContextLabel(item: DriveVisualItem, rootPath: string | null | undefined) {
  const parentPath = normalizeDrivePath(getParentDrivePath(item.drive_path));
  const normalizedRootPath = normalizeDrivePath(rootPath);

  if (!parentPath) {
    return "Root";
  }

  if (normalizedRootPath && parentPath === normalizedRootPath) {
    return "Root";
  }

  if (normalizedRootPath && parentPath.startsWith(`${normalizedRootPath}/`)) {
    return parentPath.slice(normalizedRootPath.length + 1) || "Root";
  }

  return parentPath;
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

function useDrivePressGesture(onToggleSelected: () => void) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressGesture = useRef<DrivePressGestureState | null>(null);
  const suppressNativeActivationUntil = useRef(0);

  function clearLongPressTimer() {
    if (!longPressTimer.current) {
      return;
    }

    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  function resetLongPressGesture() {
    clearLongPressTimer();
    pressGesture.current = null;
  }

  function commitLongPressSelection() {
    const gesture = pressGesture.current;

    if (!gesture || gesture.longPressCommitted) {
      return;
    }

    gesture.longPressCommitted = true;
    gesture.clickSuppressed = true;
    suppressNativeActivationUntil.current = Date.now() + LONG_PRESS_NATIVE_SUPPRESS_MS;
    clearLongPressTimer();
    onToggleSelected();
    navigator.vibrate?.(8);
  }

  function startLongPress(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || event.pointerType === "mouse") {
      return;
    }

    resetLongPressGesture();
    pressGesture.current = {
      clickSuppressed: false,
      longPressCommitted: false,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    longPressTimer.current = setTimeout(commitLongPressSelection, LONG_PRESS_DELAY_MS);
  }

  function cancelLongPress(event: ReactPointerEvent<HTMLButtonElement>) {
    const gesture = pressGesture.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    resetLongPressGesture();
  }

  function moveLongPress(event: ReactPointerEvent<HTMLButtonElement>) {
    const gesture = pressGesture.current;

    if (!gesture || gesture.pointerId !== event.pointerId || gesture.longPressCommitted) {
      return;
    }

    const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);

    if (distance > LONG_PRESS_MOVE_TOLERANCE_PX) {
      resetLongPressGesture();
    }
  }

  function consumeSuppressedClick() {
    if (Date.now() < suppressNativeActivationUntil.current) {
      resetLongPressGesture();
      return true;
    }

    const gesture = pressGesture.current;

    if (gesture?.clickSuppressed) {
      resetLongPressGesture();
      return true;
    }

    resetLongPressGesture();
    return false;
  }

  return {
    consumeSuppressedClick,
    eventHandlers: {
      onClickCapture(event: ReactMouseEvent<HTMLButtonElement>) {
        if (Date.now() >= suppressNativeActivationUntil.current) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        resetLongPressGesture();
      },
      onContextMenu(event: ReactMouseEvent<HTMLButtonElement>) {
        if (Date.now() >= suppressNativeActivationUntil.current) {
          return;
        }

        event.preventDefault();
        commitLongPressSelection();
      },
      onDragStart(event: ReactDragEvent<HTMLButtonElement>) {
        event.preventDefault();
      },
      onPointerCancel: cancelLongPress,
      onPointerDown: startLongPress,
      onPointerMove: moveLongPress,
      onPointerUp: cancelLongPress,
    },
  };
}

function DriveTile({
  active,
  contextLabel,
  item,
  selectionMode,
  selected,
  onOpen,
  onToggleSelected,
}: {
  active: boolean;
  contextLabel?: string;
  item: DriveVisualItem;
  selectionMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelected: () => void;
}) {
  const pressGesture = useDrivePressGesture(onToggleSelected);
  const metaLabel = contextLabel ?? getItemMetaLabel(item);

  return (
    <button
      className="drive-tile"
      data-active={active ? "true" : undefined}
      data-folder={isFolderItem(item) ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      type="button"
      {...pressGesture.eventHandlers}
      onClick={() => {
        if (pressGesture.consumeSuppressedClick()) {
          return;
        }

        if (selectionMode) {
          onToggleSelected();
          return;
        }

        onOpen();
      }}
    >
      {selected ? (
        <span className="drive-tile__check" aria-label="Dipilih">
          <Check size={15} aria-hidden="true" />
        </span>
      ) : null}
      <MediaThumbnailFrame
        alt={item.name}
        className="drive-tile__thumb"
        fallback={<DriveIcon item={item} />}
        src={item.preview_url}
      />
      <span className="drive-tile__header">
        <span className="drive-tile__copy">
          <strong title={item.name}>{item.name}</strong>
          <span className="text-caption" title={metaLabel}>
            {metaLabel}
          </span>
        </span>
        <span className="drive-tile__status">
          <StatusBadge status={item.status} size="sm" />
        </span>
      </span>
    </button>
  );
}

function DriveListRow({
  active,
  contextLabel,
  item,
  selectionMode,
  selected,
  onOpen,
  onToggleSelected,
}: {
  active: boolean;
  contextLabel: string;
  item: DriveVisualItem;
  selectionMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelected: () => void;
}) {
  const pressGesture = useDrivePressGesture(onToggleSelected);
  const metaLabel = getItemMetaLabel(item);

  return (
    <button
      className="drive-list-row"
      data-active={active ? "true" : undefined}
      data-folder={isFolderItem(item) ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      type="button"
      {...pressGesture.eventHandlers}
      onClick={() => {
        if (pressGesture.consumeSuppressedClick()) {
          return;
        }

        if (selectionMode) {
          onToggleSelected();
          return;
        }

        onOpen();
      }}
    >
      {selected ? (
        <span className="drive-list-row__check" aria-label="Dipilih">
          <Check size={13} aria-hidden="true" />
        </span>
      ) : null}
      <MediaThumbnailFrame
        alt={item.name}
        className="drive-list-row__thumb"
        fallback={<DriveIcon item={item} />}
        src={item.preview_url}
      />
      <span className="drive-list-row__copy">
        <strong title={item.name}>{item.name}</strong>
        <span title={contextLabel}>{contextLabel}</span>
      </span>
      <span className="drive-list-row__meta drive-list-row__meta--desktop">{metaLabel}</span>
      <span className="drive-list-row__meta drive-list-row__meta--desktop">{formatDate(item.drive_modified_at)}</span>
      <span className="drive-list-row__status">
        <StatusBadge status={item.status} size="sm" />
      </span>
    </button>
  );
}

function DrivePreviewContent({ item }: { item: DriveVisualItem }) {
  const [viewMode, setViewMode] = useState<"summary" | "detail">("summary");

  useEffect(() => {
    setViewMode("summary");
  }, [item.id]);

  const mediaSrc = viewMode === "detail" ? item.detail_url : item.preview_url;
  const mediaClassName = `drive-preview-sheet__media drive-preview-sheet__media--${viewMode}`;

  return (
    <>
      <MediaThumbnailFrame
        alt={item.name}
        className={mediaClassName}
        fallback={<DriveIcon item={item} />}
        loading={viewMode === "detail" ? "eager" : "lazy"}
        src={mediaSrc}
      />
      <div className="form-actions drive-preview-sheet__actions desktop-action-set">
        {item.detail_url ? (
          <NativeButton className="compact primary" type="button" onClick={() => setViewMode(viewMode === "detail" ? "summary" : "detail")}>
            {viewMode === "detail" ? <ChevronLeft size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            {viewMode === "detail" ? "Ringkas" : "Detail"}
          </NativeButton>
        ) : null}
        <NativeAnchorButton className="compact" href={item.drive_url} target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" />
          Buka link
        </NativeAnchorButton>
        <form action={saveDriveItem}>
          <input type="hidden" name="intent" value="archive" />
          <input type="hidden" name="id" value={item.id} />
          <DeleteActionButton confirmMessage={`Hapus item Drive "${item.name}"?`} />
        </form>
      </div>
      <div className="mobile-action-set drive-preview-sheet__mobile-actions">
        <NativeAnchorButton className="compact primary" href={item.drive_url} target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" />
          Buka link
        </NativeAnchorButton>
        <OverflowActionMenu>
          {item.detail_url ? (
            <NativeButton className="compact" type="button" onClick={() => setViewMode(viewMode === "detail" ? "summary" : "detail")}>
              {viewMode === "detail" ? <ChevronLeft size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
              {viewMode === "detail" ? "Ringkas" : "Detail"}
            </NativeButton>
          ) : null}
          <form action={saveDriveItem}>
            <input type="hidden" name="intent" value="archive" />
            <input type="hidden" name="id" value={item.id} />
            <DeleteActionButton confirmMessage={`Hapus item Drive "${item.name}"?`} />
          </form>
        </OverflowActionMenu>
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
    </>
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
      <DrivePreviewContent item={item} />
    </OperatorBottomSheet>
  );
}

function DrivePreviewDrawer({ item, onClose }: { item: DriveVisualItem; onClose: () => void }) {
  return (
    <aside className="drive-preview-drawer" aria-label="Detail Drive">
      <div className="drive-preview-drawer__header">
        <div className="operator-bottom-sheet__copy">
          <strong>{item.name}</strong>
          <span className="operator-bottom-sheet__subtitle">{item.drive_path}</span>
        </div>
        <NativeButton className="compact operator-bottom-sheet__close" type="button" aria-label="Tutup preview" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </NativeButton>
      </div>
      <div className="drive-preview-drawer__body">
        <DrivePreviewContent item={item} />
      </div>
    </aside>
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
  const targetLabel = uploadTarget ? `${uploadTarget.name} - ${uploadTarget.drive_path}` : "Hubungkan Drive dulu.";

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
          <NativeButton className="primary" type="submit" disabled={!uploadTarget}>
            <Upload size={16} aria-hidden="true" />
            Unggah
          </NativeButton>
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
          <NativeButton className="primary" type="submit" disabled={!uploadTarget}>
            <Link2 size={16} aria-hidden="true" />
            Tautkan
          </NativeButton>
        </form>
      )}
    </OperatorBottomSheet>
  );
}

function useIsDesktopDriveViewport() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_DRIVE_MEDIA_QUERY);
    const updateViewportState = () => setIsDesktop(media.matches);

    updateViewportState();
    media.addEventListener("change", updateViewportState);

    return () => media.removeEventListener("change", updateViewportState);
  }, []);

  return isDesktop;
}

function getRootFolderNode(uploadTarget: DriveVisualManagerProps["uploadTarget"]): DriveFolderNode | null {
  if (!uploadTarget) {
    return null;
  }

  return {
    id: uploadTarget.id,
    name: uploadTarget.name,
    drive_path: uploadTarget.drive_path,
    parent_id: null,
    parent_drive_item_id: null,
  };
}

function getCurrentFolder(
  currentFolderId: string | null,
  itemsById: Map<string, DriveVisualItem>,
  rootFolder: DriveFolderNode | null,
) {
  if (!currentFolderId) {
    return rootFolder;
  }

  if (rootFolder?.id === currentFolderId) {
    return rootFolder;
  }

  const item = itemsById.get(currentFolderId);
  return item && isFolderItem(item) ? item : rootFolder;
}

function resolveParentFolder(
  folder: DriveFolderNode,
  itemsById: Map<string, DriveVisualItem>,
  itemsByPath: Map<string, DriveVisualItem>,
  rootFolder: DriveFolderNode | null,
) {
  if (rootFolder?.id === folder.id) {
    return null;
  }

  if (folder.parent_id) {
    const parent = itemsById.get(folder.parent_id);

    if (parent && isFolderItem(parent)) {
      return parent;
    }
  }

  const parentPath = normalizeDrivePath(getParentDrivePath(folder.drive_path));
  const parentByPath = parentPath ? itemsByPath.get(parentPath) : null;

  if (parentByPath && isFolderItem(parentByPath)) {
    return parentByPath;
  }

  const rootPath = normalizeDrivePath(rootFolder?.drive_path);
  const folderPath = normalizeDrivePath(folder.drive_path);

  if (rootFolder && rootPath && folderPath.startsWith(`${rootPath}/`)) {
    return rootFolder;
  }

  return null;
}

function buildDriveBreadcrumb(
  currentFolder: DriveFolderNode | null,
  itemsById: Map<string, DriveVisualItem>,
  itemsByPath: Map<string, DriveVisualItem>,
  rootFolder: DriveFolderNode | null,
) {
  if (!currentFolder) {
    return rootFolder ? [rootFolder] : [];
  }

  const crumbs: DriveFolderNode[] = [];
  const visited = new Set<string>();
  let cursor: DriveFolderNode | null = currentFolder;

  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    crumbs.unshift(cursor);
    cursor = resolveParentFolder(cursor, itemsById, itemsByPath, rootFolder);
  }

  if (rootFolder && crumbs[0]?.id !== rootFolder.id) {
    crumbs.unshift(rootFolder);
  }

  return crumbs;
}

function getDirectChildren(items: DriveVisualItem[], currentFolder: DriveFolderNode | null) {
  if (!currentFolder) {
    return items.filter((item) => !item.parent_id).sort(sortDriveItems);
  }

  return items
    .filter((item) => {
      if (item.id === currentFolder.id) {
        return false;
      }

      if (item.parent_id === currentFolder.id) {
        return true;
      }

      return !item.parent_id && isDirectPathChild(item, currentFolder.drive_path);
    })
    .sort(sortDriveItems);
}

function DriveBreadcrumb({
  crumbs,
  onOpenFolder,
}: {
  crumbs: DriveFolderNode[];
  onOpenFolder: (folderId: string) => void;
}) {
  if (!crumbs.length) {
    return null;
  }

  return (
    <nav className="drive-breadcrumb" aria-label="Folder Drive">
      {crumbs.map((crumb, index) => {
        const isCurrent = index === crumbs.length - 1;

        return (
          <span className="drive-breadcrumb__segment" key={crumb.id}>
            {index ? <span className="drive-breadcrumb__separator">/</span> : null}
            <button
              className="drive-breadcrumb__button"
              data-current={isCurrent ? "true" : undefined}
              disabled={isCurrent}
              type="button"
              onClick={() => onOpenFolder(crumb.id)}
            >
              {index === 0 ? <Folder size={15} aria-hidden="true" /> : null}
              <span>{crumb.name}</span>
            </button>
          </span>
        );
      })}
    </nav>
  );
}

function DriveViewModeToggle({
  value,
  onChange,
}: {
  value: DriveViewMode;
  onChange: (value: DriveViewMode) => void;
}) {
  return (
    <div className="drive-view-toggle" role="group" aria-label="Mode tampilan Drive">
      <button
        aria-pressed={value === "grid"}
        className="drive-view-toggle__button"
        data-active={value === "grid" ? "true" : undefined}
        type="button"
        onClick={() => onChange("grid")}
      >
        <ImageIcon size={15} aria-hidden="true" />
        Grid
      </button>
      <button
        aria-pressed={value === "list"}
        className="drive-view-toggle__button"
        data-active={value === "list" ? "true" : undefined}
        type="button"
        onClick={() => onChange("list")}
      >
        <FileText size={15} aria-hidden="true" />
        List
      </button>
    </div>
  );
}

export function DriveVisualManager({ items, uploadTarget }: DriveVisualManagerProps) {
  const [query, setQuery] = useState("");
  const [fileDrawerOpen, setFileDrawerOpen] = useState(false);
  const [fileFormMode, setFileFormMode] = useState<DriveFileFormMode>("upload");
  const [viewMode, setViewMode] = useState<DriveViewMode>("grid");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(() => uploadTarget?.id ?? null);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const isDesktopDriveViewport = useIsDesktopDriveViewport();
  const rootFolder = useMemo(() => getRootFolderNode(uploadTarget), [uploadTarget]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const itemsByPath = useMemo(() => new Map(items.map((item) => [normalizeDrivePath(item.drive_path), item])), [items]);
  const currentFolder = useMemo(() => getCurrentFolder(currentFolderId, itemsById, rootFolder), [currentFolderId, itemsById, rootFolder]);
  const breadcrumb = useMemo(
    () => buildDriveBreadcrumb(currentFolder, itemsById, itemsByPath, rootFolder),
    [currentFolder, itemsById, itemsByPath, rootFolder],
  );
  const folderItems = useMemo(() => getDirectChildren(items, currentFolder), [items, currentFolder]);
  const searchActive = query.trim().length > 0;
  const filteredItems = useMemo(() => items.filter((item) => matchesQuery(item, query)).sort(sortDriveItems), [items, query]);
  const visibleItems = searchActive ? filteredItems : folderItems;
  const previewItem = previewItemId ? itemsById.get(previewItemId) ?? null : null;
  const resultsLabel = searchActive ? `${filteredItems.length} dari ${items.length} item` : `${visibleItems.length} item`;
  const selectionMode = selectedIds.size > 0;
  const activeUploadFolder = currentFolder ?? rootFolder;
  const activeUploadTarget = activeUploadFolder
    ? {
        id: activeUploadFolder.id,
        name: activeUploadFolder.name,
        drive_path: activeUploadFolder.drive_path,
      }
    : uploadTarget;
  const showDesktopPreview = Boolean(previewItem && isDesktopDriveViewport);

  useEffect(() => {
    setCurrentFolderId(uploadTarget?.id ?? null);
    setPreviewItemId(null);
    setSelectedIds(new Set());
  }, [uploadTarget?.id]);

  useEffect(() => {
    if (!currentFolderId || currentFolderId === rootFolder?.id || itemsById.has(currentFolderId)) {
      return;
    }

    setCurrentFolderId(rootFolder?.id ?? null);
    setPreviewItemId(null);
    setSelectedIds(new Set());
  }, [currentFolderId, itemsById, rootFolder?.id]);

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

  function openFolder(folderId: string) {
    setCurrentFolderId(folderId);
    setQuery("");
    setPreviewItemId(null);
    setSelectedIds(new Set());
  }

  function openDriveItem(item: DriveVisualItem) {
    if (isFolderItem(item)) {
      openFolder(item.id);
      return;
    }

    setPreviewItemId(item.id);
  }

  const emptyTitle = searchActive ? "Tidak ada item yang cocok." : items.length ? "Folder kosong." : "Belum ada item Drive.";
  const emptyDescription = searchActive ? "Coba kata kunci lain." : items.length ? "Belum ada item di folder ini." : "Hubungkan Drive dulu.";

  return (
    <section className="drive-manager stack" data-has-preview={showDesktopPreview ? "true" : undefined}>
      <div className="settings-list-toolbar drive-toolbar">
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
        <DriveViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      <DriveBreadcrumb crumbs={breadcrumb} onOpenFolder={openFolder} />

      <div className="settings-inline-summary drive-browser-summary">
        <span>{resultsLabel}</span>
        <div className="drive-summary-actions">
          {searchActive ? (
            <NativeButton className="compact" type="button" onClick={() => setQuery("")}>
              <X size={15} aria-hidden="true" />
              Reset
            </NativeButton>
          ) : null}
          <NativeButton className="compact primary" type="button" onClick={() => openFileDrawer()} disabled={!activeUploadTarget}>
            <Plus size={15} aria-hidden="true" />
            Tambah file
          </NativeButton>
        </div>
      </div>

      <div className="drive-page-grid" data-has-preview={showDesktopPreview ? "true" : undefined}>
        <div className="drive-page-grid__gallery stack">
          {selectedIds.size ? (
            <div className="muted-box section-card__actions">
              <strong>{selectedIds.size} dipilih</strong>
              <NativeButton className="compact" type="button" onClick={() => setSelectedIds(new Set())}>
                Bersihkan
              </NativeButton>
            </div>
          ) : null}

          {visibleItems.length ? (
            viewMode === "grid" ? (
              <div className="drive-visual-grid">
                {visibleItems.map((item) => (
                  <DriveTile
                    active={previewItemId === item.id}
                    contextLabel={searchActive ? getPathContextLabel(item, rootFolder?.drive_path) : undefined}
                    item={item}
                    key={item.id}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(item.id)}
                    onOpen={() => openDriveItem(item)}
                    onToggleSelected={() => toggleSelected(item.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="drive-list" role="list">
                {visibleItems.map((item) => (
                  <DriveListRow
                    active={previewItemId === item.id}
                    contextLabel={getPathContextLabel(item, rootFolder?.drive_path)}
                    item={item}
                    key={item.id}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(item.id)}
                    onOpen={() => openDriveItem(item)}
                    onToggleSelected={() => toggleSelected(item.id)}
                  />
                ))}
              </div>
            )
          ) : (
            <EmptyState
              icon={Folder}
              title={emptyTitle}
              description={emptyDescription}
              action={
                searchActive ? (
                  <NativeButton className="compact primary" type="button" onClick={() => setQuery("")}>
                    Reset pencarian
                  </NativeButton>
                ) : null
              }
            />
          )}
        </div>
        {showDesktopPreview && previewItem ? <DrivePreviewDrawer item={previewItem} onClose={() => setPreviewItemId(null)} /> : null}
      </div>

      <DriveFileDrawer
        mode={fileFormMode}
        open={fileDrawerOpen}
        uploadTarget={activeUploadTarget}
        onClose={() => setFileDrawerOpen(false)}
        onModeChange={setFileFormMode}
      />
      {previewItem && !isDesktopDriveViewport ? <DrivePreviewSheet item={previewItem} onClose={() => setPreviewItemId(null)} /> : null}
    </section>
  );
}
