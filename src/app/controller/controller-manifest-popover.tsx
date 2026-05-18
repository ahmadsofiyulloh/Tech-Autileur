"use client";

import { FileJson, X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NativeButton } from "@/components/ui/native-button";

type ControllerManifestPopoverProps = {
  children: ReactNode;
};

export function ControllerManifestPopover({ children }: ControllerManifestPopoverProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

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

  const portalTarget = typeof document === "undefined" ? null : document.body;

  return (
    <>
      <NativeButton
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="compact tertiary controller-manifest-popover__trigger"
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <FileJson size={15} aria-hidden="true" />
        Manifest
      </NativeButton>
      {portalTarget && open
        ? createPortal(
            <div className="controller-manifest-popover__backdrop">
              <div
                aria-label="Manifest batch"
                className="controller-manifest-popover"
                id={panelId}
                ref={panelRef}
                role="dialog"
              >
                <div className="controller-manifest-popover__header">
                  <span className="controller-manifest-popover__title">
                    <FileJson size={18} aria-hidden="true" />
                    <strong>Manifest</strong>
                  </span>
                  <NativeButton
                    aria-label="Tutup manifest"
                    className="compact tertiary controller-manifest-popover__close"
                    type="button"
                    onClick={() => setOpen(false)}
                  >
                    <X size={15} aria-hidden="true" />
                  </NativeButton>
                </div>
                <div className="controller-manifest-popover__body">{children}</div>
              </div>
            </div>,
            portalTarget,
          )
        : null}
    </>
  );
}
