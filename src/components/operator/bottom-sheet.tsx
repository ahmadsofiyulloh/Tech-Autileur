"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

type OperatorBottomSheetProps = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function OperatorBottomSheet({ open, onClose, ariaLabel, title, subtitle, children, className }: OperatorBottomSheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <>
      <button
        aria-label="Tutup preview"
        className="operator-bottom-sheet__backdrop"
        type="button"
        onClick={onClose}
      />
      <aside
        aria-label={ariaLabel}
        aria-modal="true"
        className={`operator-bottom-sheet${className ? ` ${className}` : ""}`.trim()}
        role="dialog"
      >
        <span className="operator-bottom-sheet__handle" aria-hidden="true" />
        <div className="operator-bottom-sheet__header">
          <div className="operator-bottom-sheet__copy">
            <strong>{title}</strong>
            {subtitle ? <span className="operator-bottom-sheet__subtitle">{subtitle}</span> : null}
          </div>
          <button className="button compact operator-bottom-sheet__close" type="button" aria-label="Tutup" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="operator-bottom-sheet__body">{children}</div>
      </aside>
    </>,
    document.body,
  );
}
