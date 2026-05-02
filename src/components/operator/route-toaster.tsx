"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ToastTone = "success" | "error" | "info";

type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

const toastIcons = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
} satisfies Record<ToastTone, LucideIcon>;

export function RouteToaster() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastToastKey = useRef("");

  useEffect(() => {
    const error = searchParams.get("error");
    const message = searchParams.get("message");
    const value = error ?? message;

    if (!value) {
      return;
    }

    const tone: ToastTone = error ? "error" : "success";
    const key = `${pathname}:${tone}:${value}`;

    if (lastToastKey.current === key) {
      return;
    }

    lastToastKey.current = key;
    const id = `${Date.now()}-${tone}`;
    setToasts((current) => [{ id, tone, message: value }, ...current].slice(0, 3));

    const timeout = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [pathname, searchParams]);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="toast-viewport" role="status" aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => {
        const Icon = toastIcons[toast.tone];

        return (
          <div className="toast" data-tone={toast.tone} key={toast.id}>
            <Icon aria-hidden="true" size={18} />
            <span>{toast.message}</span>
            <button
              aria-label="Dismiss notification"
              className="toast__close"
              type="button"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            >
              <X aria-hidden="true" size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
