"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { NativeButton } from "@/components/ui/native-button";

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
  const [dragOffset, setDragOffset] = useState(0);
  const dragOffsetRef = useRef(0);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartYRef = useRef(0);

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

  useEffect(() => {
    if (!open) {
      resetDrag();
    }
  }, [open]);

  function setSheetOffset(offset: number) {
    dragOffsetRef.current = offset;
    setDragOffset(offset);
  }

  function resetDrag() {
    dragPointerIdRef.current = null;
    dragStartYRef.current = 0;
    setSheetOffset(0);
  }

  function handleDragStart(event: ReactPointerEvent<HTMLSpanElement>) {
    if (event.button !== 0) {
      return;
    }

    dragPointerIdRef.current = event.pointerId;
    dragStartYRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDragMove(event: ReactPointerEvent<HTMLSpanElement>) {
    if (dragPointerIdRef.current !== event.pointerId) {
      return;
    }

    const offset = Math.max(0, event.clientY - dragStartYRef.current);
    setSheetOffset(Math.min(offset, 180));
  }

  function handleDragEnd(event: ReactPointerEvent<HTMLSpanElement>) {
    if (dragPointerIdRef.current !== event.pointerId) {
      return;
    }

    const shouldClose = dragOffsetRef.current > 72;
    resetDrag();

    if (shouldClose) {
      onClose();
    }
  }

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
        data-dragging={dragOffset > 0 ? "true" : undefined}
        role="dialog"
        style={dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined}
      >
        <span
          className="operator-bottom-sheet__handle"
          aria-hidden="true"
          onPointerCancel={resetDrag}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
        />
        <div className="operator-bottom-sheet__header">
          <div className="operator-bottom-sheet__copy">
            <strong>{title}</strong>
            {subtitle ? <span className="operator-bottom-sheet__subtitle">{subtitle}</span> : null}
          </div>
          <NativeButton className="compact operator-bottom-sheet__close" type="button" aria-label="Tutup" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </NativeButton>
        </div>
        <div className="operator-bottom-sheet__body">{children}</div>
      </aside>
    </>,
    document.body,
  );
}
