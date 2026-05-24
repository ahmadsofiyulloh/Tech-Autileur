"use client";

import Link from "next/link";

type ErrorKind = "key_quota" | "timeout" | "parse" | "default";

type Props = {
  errorMessage: string | null;
  onRetry: () => void;
  onEditForm: () => void;
};

function classifyError(errorMessage: string | null): ErrorKind {
  if (!errorMessage) return "default";
  const msg = errorMessage.toLowerCase();
  if (msg.includes("key") || msg.includes("quota") || msg.includes("no key")) {
    return "key_quota";
  }
  if (msg.includes("timeout")) return "timeout";
  if (msg.includes("parse") || msg.includes("invalid") || msg.includes("json")) {
    return "parse";
  }
  return "default";
}

const ERROR_COPY: Record<ErrorKind, string> = {
  key_quota: "Tidak ada Gemini key tersedia atau kuota habis.",
  timeout: "Proses timeout. Gemini tidak merespons dalam waktu yang ditentukan.",
  parse: "Respons dari Gemini tidak valid. Coba lagi.",
  default: "Terjadi error saat generate caption.",
};

export function ShareErrorState({ errorMessage, onRetry, onEditForm }: Props) {
  const kind = classifyError(errorMessage);
  const message = ERROR_COPY[kind];

  return (
    <div
      className="share-fallback-card share-fallback-fade-in"
      data-tone="danger"
    >
      <div className="share-fallback-card__header">
        <svg
          className="share-fallback-card__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Gagal generate caption
      </div>

      <p className="share-fallback-card__message">{message}</p>

      <div className="share-fallback-card__actions">
        {kind === "key_quota" ? (
          <>
            <Link
              href="/settings"
              className="share-fallback-card__action share-fallback-card__action--primary"
            >
              Settings
            </Link>
            <button
              type="button"
              className="share-fallback-card__action"
              onClick={onRetry}
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="share-fallback-card__action share-fallback-card__action--primary"
              onClick={onRetry}
            >
              Retry
            </button>
            <button
              type="button"
              className="share-fallback-card__action"
              onClick={onEditForm}
            >
              Ubah & Coba Lagi
            </button>
          </>
        )}
      </div>

      {kind === "key_quota" && (
        <Link href="/settings" className="share-fallback-card__settings-link">
          → Kelola Gemini key di Settings
        </Link>
      )}
    </div>
  );
}
