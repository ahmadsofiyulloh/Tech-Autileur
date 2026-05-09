"use client";

import { Image as ImageIcon, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton } from "@/components/ui/native-button";

export type ImagePreviewSelectionState = {
  selected: boolean;
  fileName: string | null;
  previewUrl: string | null;
};

type ImagePreviewUploadCardProps = {
  label: string;
  name: string;
  previewUrl?: string | null;
  previewAlt?: string;
  emptyTitle?: string;
  removedTitle?: string;
  required?: boolean;
  disabled?: boolean;
  clearName?: string;
  className?: string;
  accept?: string;
  onSelectionChange?: (state: ImagePreviewSelectionState) => void;
  showStatusBadge?: boolean;
};

function resetInputValue(input: HTMLInputElement | null) {
  if (input) {
    input.value = "";
  }
}

export function ImagePreviewUploadCard({
  label,
  name,
  previewUrl,
  previewAlt,
  emptyTitle = "Unggah gambar",
  removedTitle,
  required = false,
  disabled = false,
  clearName,
  className,
  accept = "image/*",
  onSelectionChange,
  showStatusBadge = true,
}: ImagePreviewUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);

  const hasLocalSelection = Boolean(fileName) || Boolean(localPreviewUrl) || isPreparing;
  const hasRemotePreview = Boolean(previewUrl);
  const displayPreviewUrl = isRemoved ? null : localPreviewUrl ?? previewUrl ?? null;
  const previewLabel = isPreparing ? "Menyiapkan" : isRemoved ? "Dihapus" : displayPreviewUrl ? "Preview" : "Kosong";
  const previewTone = isPreparing ? "warning" : isRemoved ? "warning" : displayPreviewUrl ? "success" : "neutral";
  const frameAriaLabel = displayPreviewUrl ? `${label}. Ganti gambar` : undefined;
  const clearLabel = isRemoved ? "Pulihkan" : hasLocalSelection && hasRemotePreview ? "Batal" : "Hapus";
  const clearButtonAriaLabel = `${clearLabel} ${label}`;
  const showClearButton = !disabled && (hasLocalSelection || hasRemotePreview || isRemoved);
  const emptyStateTitle = isRemoved ? removedTitle ?? "Referensi dihapus" : emptyTitle;

  useEffect(() => {
    setError(null);
    setFileName(null);
    setLocalPreviewUrl(null);
    setIsPreparing(false);
    setIsRemoved(false);
    resetInputValue(inputRef.current);
  }, [previewUrl]);

  function notifySelection(nextState: ImagePreviewSelectionState) {
    onSelectionChange?.(nextState);
  }

  function clearLocalSelection(options?: { clearError?: boolean }) {
    if (options?.clearError ?? true) {
      setError(null);
    }
    setFileName(null);
    setLocalPreviewUrl(null);
    setIsPreparing(false);
    resetInputValue(inputRef.current);
    notifySelection({ selected: false, fileName: null, previewUrl: null });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      clearLocalSelection();
      return;
    }

    if (!file.type.startsWith("image/")) {
      clearLocalSelection({ clearError: false });
      setError("Pilih file gambar.");
      event.target.value = "";
      return;
    }

    setError(null);
    setFileName(file.name);
    setIsPreparing(true);
    setLocalPreviewUrl(null);
    notifySelection({ selected: true, fileName: file.name, previewUrl: null });
    setIsRemoved(false);

    const reader = new FileReader();

    reader.addEventListener("load", () => {
      const nextPreviewUrl = typeof reader.result === "string" ? reader.result : null;
      setLocalPreviewUrl(nextPreviewUrl);
      setIsPreparing(false);
      notifySelection({ selected: true, fileName: file.name, previewUrl: nextPreviewUrl });
    });
    reader.addEventListener("error", () => {
      clearLocalSelection({ clearError: false });
      setError("Tidak bisa menyiapkan pratinjau lokal.");
      event.target.value = "";
    });
    reader.readAsDataURL(file);
  }

  function handleFrameClick() {
    if (disabled || isPreparing) {
      return;
    }

    inputRef.current?.click();
  }

  function handleClearClick() {
    if (disabled || isPreparing) {
      return;
    }

    if (hasLocalSelection) {
      clearLocalSelection();
      return;
    }

    if (clearName) {
      setError(null);
      setFileName(null);
      setLocalPreviewUrl(null);
      setIsPreparing(false);
      setIsRemoved((current) => !current);
      resetInputValue(inputRef.current);
      notifySelection({ selected: false, fileName: null, previewUrl: null });
      return;
    }

    clearLocalSelection();
  }

  const ClearIcon = isRemoved ? RotateCcw : hasLocalSelection && hasRemotePreview ? X : Trash2;

  return (
    <section className={`image-preview-upload-card stack-tight${className ? ` ${className}` : ""}`} data-has-preview={displayPreviewUrl ? "true" : "false"} data-removed={isRemoved ? "true" : "false"}>
      <div className="image-preview-upload-card__header">
        <strong>{label}</strong>
        {showStatusBadge ? (
          <StatusBadge
            status={previewLabel}
            tone={previewTone as "neutral" | "info" | "success" | "warning" | "danger"}
          />
        ) : null}
      </div>

      <div className="image-preview-upload-card__frame-wrap">
        <button
          className="image-preview-upload-card__frame"
          aria-label={frameAriaLabel}
          disabled={disabled || isPreparing}
          type="button"
          onClick={handleFrameClick}
        >
          {isPreparing ? (
            <div className="image-preview-upload-card__empty" role="status">
              <Loader2 className="spin" size={32} aria-hidden="true" />
              <span>Menyiapkan pratinjau</span>
            </div>
          ) : displayPreviewUrl ? (
            <img alt={previewAlt ?? label} className="image-preview-upload-card__media" src={displayPreviewUrl} />
          ) : (
            <div className="image-preview-upload-card__empty">
              <ImageIcon size={28} aria-hidden="true" />
              <span>{emptyStateTitle}</span>
            </div>
          )}

          {displayPreviewUrl ? (
            <span className="image-preview-upload-card__trigger" aria-hidden="true">
              <RotateCcw size={15} aria-hidden="true" />
            </span>
          ) : null}
        </button>

        {showClearButton ? (
          <div className="image-preview-upload-card__actions">
            <NativeButton
              className="compact image-preview-upload-card__clear"
              disabled={disabled || isPreparing}
              aria-label={clearButtonAriaLabel}
              title={clearButtonAriaLabel}
              type="button"
              onClick={handleClearClick}
            >
              <ClearIcon size={14} aria-hidden="true" />
              <span className="image-preview-upload-card__action-label">{clearLabel}</span>
            </NativeButton>
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        accept={accept}
        className="image-preview-upload-card__input"
        disabled={disabled}
        name={name}
        required={required && !hasLocalSelection && !hasRemotePreview}
        type="file"
        onChange={handleFileChange}
      />

      {clearName ? (
        <input
          aria-hidden="true"
          className="image-preview-upload-card__clear-input"
          name={clearName}
          readOnly
          type="checkbox"
          value="true"
          checked={isRemoved}
        />
      ) : null}

      {error ? (
        <p className="error-box image-preview-upload-card__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
