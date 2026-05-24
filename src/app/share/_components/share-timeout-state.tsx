"use client";

import { useRouter } from "next/navigation";

type Props = {
  onBackToForm: () => void;
};

export function ShareTimeoutState({ onBackToForm }: Props) {
  const router = useRouter();

  return (
    <div
      className="share-fallback-card share-fallback-fade-in"
      data-tone="warning"
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
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Proses lebih lama dari biasa
      </div>

      <p className="share-fallback-card__message">
        Caption mungkin masih diproses di background. Kamu bisa:
      </p>

      <div className="share-fallback-card__actions">
        <button
          type="button"
          className="share-fallback-card__action share-fallback-card__action--primary"
          onClick={() => router.refresh()}
        >
          Refresh
        </button>
        <button
          type="button"
          className="share-fallback-card__action"
          onClick={onBackToForm}
        >
          Kembali ke Form
        </button>
      </div>
    </div>
  );
}
