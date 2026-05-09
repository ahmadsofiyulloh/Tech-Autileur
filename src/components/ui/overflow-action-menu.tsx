"use client";

import { MoreHorizontal } from "lucide-react";
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

type OverflowActionMenuProps = {
  buttonClassName?: string;
  children: ReactNode;
  className?: string;
  label?: string;
};

type MenuPosition = {
  left: number;
  top: number;
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function OverflowActionMenu({
  buttonClassName,
  children,
  className,
  label = "Aksi lainnya",
}: OverflowActionMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) {
      return;
    }

    const viewportPadding = 8;
    const triggerRect = buttonRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const left = clamp(
      triggerRect.right - menuRect.width,
      viewportPadding,
      window.innerWidth - menuRect.width - viewportPadding,
    );
    const belowTop = triggerRect.bottom + 6;
    const aboveTop = triggerRect.top - menuRect.height - 6;
    const top =
      belowTop + menuRect.height <= window.innerHeight - viewportPadding
        ? belowTop
        : clamp(aboveTop, viewportPadding, window.innerHeight - menuRect.height - viewportPadding);

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

      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
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

  const menuStyle: CSSProperties = position
    ? { left: position.left, top: position.top }
    : { left: 0, top: 0, visibility: "hidden" };

  return (
    <span className={joinClassNames("overflow-action-menu", className)}>
      <NativeButton
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={joinClassNames("compact overflow-action-menu__trigger", buttonClassName)}
        ref={buttonRef}
        type="button"
        onClick={() => {
          setPosition(null);
          setOpen((current) => !current);
        }}
      >
        <MoreHorizontal size={17} aria-hidden="true" />
      </NativeButton>
      {mounted && open
        ? createPortal(
            <div
              className="overflow-action-menu__panel"
              id={menuId}
              ref={menuRef}
              role="menu"
              style={menuStyle}
              onClick={(event) => {
                const target = event.target;

                if (target instanceof Element && target.closest("a, button")) {
                  const button = target.closest("button");

                  if (button && (button.getAttribute("type") ?? "submit") === "submit") {
                    return;
                  }

                  setOpen(false);
                }
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
