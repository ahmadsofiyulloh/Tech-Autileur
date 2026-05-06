"use client";

import { AlertTriangle, CircleAlert, CircleCheck, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  getGeminiTemporaryUnavailableRetryMessage,
  isGeminiTemporaryUnavailableMessage,
} from "@/lib/gemini/error-message";

type ToastTone = "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

const toastIcons = {
  success: CircleCheck,
  error: CircleAlert,
  warning: AlertTriangle,
  info: Info,
} satisfies Record<ToastTone, LucideIcon>;

export function RouteToaster() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastToastKey = useRef("");
  const suppressToasts = pathname.startsWith("/login") || pathname.startsWith("/auth");

  useEffect(() => {
    if (suppressToasts) {
      return;
    }

    const error = searchParams.get("error")?.trim();
    const warning = searchParams.get("warning")?.trim();
    const message = searchParams.get("message")?.trim();
    const value = error || warning || message;

    if (!value) {
      return;
    }

    const retryableGeminiError = Boolean(error && isGeminiTemporaryUnavailableMessage(error));
    const tone: ToastTone = error ? (retryableGeminiError ? "warning" : "error") : warning ? "warning" : "success";
    const toastMessage = retryableGeminiError ? getGeminiTemporaryUnavailableRetryMessage() : value;
    const key = `${pathname}:${tone}:${toastMessage}`;

    if (lastToastKey.current === key) {
      return;
    }

    lastToastKey.current = key;
    const id = `${Date.now()}-${tone}`;
    setToasts((current) => [{ id, tone, message: toastMessage }, ...current].slice(0, 3));

    const timeout = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [pathname, searchParams, suppressToasts]);

  if (suppressToasts || !toasts.length) {
    return null;
  }

  return (
    <div className="toast-viewport">
      {toasts.map((toast) => {
        const Icon = toastIcons[toast.tone];
        const role = toast.tone === "error" ? "alert" : "status";

        return (
          <div
            className="toast"
            data-tone={toast.tone}
            key={toast.id}
            aria-atomic="true"
            aria-live={toast.tone === "error" ? "assertive" : "polite"}
            role={role}
          >
            <Icon aria-hidden="true" size={18} />
            <span>{toast.message}</span>
            <button
              aria-label="Tutup notifikasi"
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
