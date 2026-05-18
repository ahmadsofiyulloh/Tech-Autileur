"use client";

import { FileJson, X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { NativeButton } from "@/components/ui/native-button";

type PanelPosition = {
  left: number;
  top: number;
};

type ControllerManifestPopoverProps = {
  children: ReactNode;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ControllerManifestPopover({ children }: ControllerManifestPopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !panelRef.current) {
      return;
    }

    const viewportPadding = 12;
    const triggerRect = buttonRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    const left = clamp(
      triggerRect.right - panelRect.width,
      viewportPadding,
      window.innerWidth - panelRect.width - viewportPadding,
    );
    const belowTop = triggerRect.bottom + 8;
    const aboveTop = triggerRect.top - panelRect.height - 8;
    const top =
      belowTop + panelRect.height <= window.innerHeight - viewportPadding
        ? belowTop
        : clamp(aboveTop, viewportPadding, window.innerHeight - panelRect.height - viewportPadding);

    setPosition({ left, top });
  }, [children, open]);

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

  const panelStyle: CSSProperties = position
    ? { left: position.left, top: position.top }
    : { left: 0, top: 0, visibility: "hidden" };
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
          setPosition(null);
          setOpen((current) => !current);
        }}
      >
        <FileJson size={15} aria-hidden="true" />
        Manifest
      </NativeButton>
      {portalTarget && open
        ? createPortal(
            <div
              aria-label="Manifest batch"
              className="controller-manifest-popover"
              id={panelId}
              ref={panelRef}
              role="dialog"
              style={panelStyle}
            >
              <div className="controller-manifest-popover__header">
                <strong>Manifest</strong>
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
            </div>,
            portalTarget,
          )
        : null}
    </>
  );
}
