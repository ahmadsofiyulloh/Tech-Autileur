"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SettingsBottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SettingsBottomSheet({
  open,
  onClose,
  title,
  eyebrow,
  description,
  actions,
  children,
  className,
}: SettingsBottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <>
      <button className="settings-sheet-backdrop" type="button" aria-label="Tutup panel" onClick={onClose} />
      <aside
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`settings-sheet stack${className ? ` ${className}` : ""}`.trim()}
        role="dialog"
      >
        <span className="settings-sheet__handle" aria-hidden="true" />
        <div className="settings-sheet__header">
          <div className="settings-sheet__copy stack-tight">
            {eyebrow ? <span className="subtle">{eyebrow}</span> : null}
            <strong id={titleId} className="settings-sheet__title">
              {title}
            </strong>
            {description ? (
              <p id={descriptionId} className="settings-sheet__description">
                {description}
              </p>
            ) : null}
          </div>
          <button ref={closeButtonRef} className="button compact settings-sheet__close" type="button" onClick={onClose} aria-label="Tutup panel">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {actions ? <div className="section-card__actions settings-sheet__actions">{actions}</div> : null}
        <div className="settings-sheet__body">{children}</div>
      </aside>
    </>,
    document.body,
  );
}
