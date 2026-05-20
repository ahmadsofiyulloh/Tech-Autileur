"use client";

import { AlertTriangle, CircleAlert, CircleCheck, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getGeminiTemporaryUnavailableRetryMessage,
  isGeminiTemporaryUnavailableMessage,
} from "@/lib/gemini/error-message";

type ToastTone = "success" | "error" | "warning" | "info";
type FeedbackPresentation = "toast" | "sheet";

type RouteFeedback = {
  id: string;
  key: string;
  message: string;
  presentation: FeedbackPresentation;
  title: string;
  tone: ToastTone;
};

const TOAST_DISMISS_DELAY_MS = 4200;
const SHEET_DISMISS_DELAY_MS = 6200;
const MAX_STACKED_FEEDBACK = 3;
const ROUTE_FEEDBACK_KEYS = ["error", "warning", "message"] as const;

const toastIcons = {
  success: CircleCheck,
  error: CircleAlert,
  warning: AlertTriangle,
  info: Info,
} satisfies Record<ToastTone, LucideIcon>;

function feedbackTitle(tone: ToastTone) {
  if (tone === "error") {
    return "Gagal";
  }

  if (tone === "warning") {
    return "Perhatian";
  }

  if (tone === "info") {
    return "Info";
  }

  return "Berhasil";
}

function isImportantFeedback(tone: ToastTone, message: string) {
  if (tone === "error" || tone === "warning") {
    return true;
  }

  return (
    message === "Akun Affiliate aktif diperbarui" ||
    message === "Google Drive connected" ||
    message === "Google Drive diputuskan." ||
    message === "Review saved" ||
    message.startsWith("Prompt pack dibuat") ||
    message.startsWith("Prompt pack generated") ||
    message.startsWith("Prompt pack regenerated") ||
    message.startsWith("Mock prompt pack output generated") ||
    message.startsWith("TXT Drive disimpan:")
  );
}

function shouldSuppressRouteFeedback(pathname: string, searchParams: ReturnType<typeof useSearchParams>, feedback: RouteFeedback) {
  return pathname === "/products/new" && searchParams.get("post_save") === "1" && feedback.message === "Produk disimpan";
}

function buildCleanRouteFeedbackHref(pathname: string, searchParams: ReturnType<typeof useSearchParams>) {
  const nextParams = new URLSearchParams(searchParams.toString());

  for (const key of ROUTE_FEEDBACK_KEYS) {
    nextParams.delete(key);
  }

  const query = nextParams.toString();
  const hash = typeof window === "undefined" ? "" : window.location.hash;

  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

function currentHref(pathname: string, searchParams: ReturnType<typeof useSearchParams>) {
  const query = searchParams.toString();
  const hash = typeof window === "undefined" ? "" : window.location.hash;

  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export function RouteToaster() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toasts, setToasts] = useState<RouteFeedback[]>([]);
  const activeFeedbackKeys = useRef(new Set<string>());
  const dismissTimers = useRef(new Map<string, number>());
  const toastsRef = useRef<RouteFeedback[]>([]);
  const suppressToasts = pathname.startsWith("/login") || pathname.startsWith("/auth");

  const clearDismissTimer = useCallback((id: string) => {
    const timer = dismissTimers.current.get(id);

    if (timer !== undefined) {
      window.clearTimeout(timer);
      dismissTimers.current.delete(id);
    }
  }, []);

  const dismissFeedback = useCallback((feedback: RouteFeedback) => {
    activeFeedbackKeys.current.delete(feedback.key);
    clearDismissTimer(feedback.id);
    setToasts((current) => current.filter((toast) => toast.id !== feedback.id));
  }, [clearDismissTimer]);

  const scheduleDismiss = useCallback((feedback: RouteFeedback) => {
    const delay = feedback.presentation === "sheet" ? SHEET_DISMISS_DELAY_MS : TOAST_DISMISS_DELAY_MS;
    const timer = window.setTimeout(() => {
      dismissFeedback(feedback);
    }, delay);

    dismissTimers.current.set(feedback.id, timer);
  }, [dismissFeedback]);

  useEffect(() => {
    const timers = dismissTimers.current;

    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }

      timers.clear();
    };
  }, []);

  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        const [latestFeedback] = toastsRef.current;

        if (latestFeedback) {
          dismissFeedback(latestFeedback);
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismissFeedback]);

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
    const presentation: FeedbackPresentation = isImportantFeedback(tone, toastMessage) ? "sheet" : "toast";
    const key = `${pathname}:${tone}:${toastMessage}`;
    const id = `${Date.now()}-${tone}`;
    const feedback: RouteFeedback = {
      id,
      key,
      message: toastMessage,
      presentation,
      title: feedbackTitle(tone),
      tone,
    };
    const cleanHref = buildCleanRouteFeedbackHref(pathname, searchParams);

    if (cleanHref !== currentHref(pathname, searchParams)) {
      window.history.replaceState(window.history.state, "", cleanHref);
    }

    if (shouldSuppressRouteFeedback(pathname, searchParams, feedback)) {
      return;
    }

    if (activeFeedbackKeys.current.has(key)) {
      return;
    }

    activeFeedbackKeys.current.add(key);

    setToasts((current) => {
      const next = [feedback, ...current];
      const trimmed = next.slice(0, MAX_STACKED_FEEDBACK);

      for (const removedToast of next.slice(MAX_STACKED_FEEDBACK)) {
        activeFeedbackKeys.current.delete(removedToast.key);
        clearDismissTimer(removedToast.id);
      }

      return trimmed;
    });
    scheduleDismiss(feedback);
  }, [clearDismissTimer, pathname, scheduleDismiss, searchParams, suppressToasts]);

  if (suppressToasts || !toasts.length) {
    return null;
  }

  return (
    <div aria-label="Notifikasi" className="toast-viewport">
      {toasts.map((toast) => {
        const Icon = toastIcons[toast.tone];
        const isAssertive = toast.tone === "error" || toast.tone === "warning";
        const role = isAssertive ? "alert" : "status";
        const iconSize = toast.presentation === "sheet" ? 22 : 18;

        return (
          <div
            aria-atomic="true"
            aria-live={isAssertive ? "assertive" : "polite"}
            className={toast.presentation === "sheet" ? "toast toast--sheet route-feedback-sheet" : "toast"}
            data-presentation={toast.presentation}
            data-tone={toast.tone}
            key={toast.id}
            role={role}
          >
            <span className="toast__icon" aria-hidden="true">
              <Icon size={iconSize} strokeWidth={2.25} />
            </span>
            <span className="toast__copy">
              {toast.presentation === "sheet" ? <strong className="toast__title">{toast.title}</strong> : null}
              <span className="toast__message">{toast.message}</span>
            </span>
            <button
              aria-label="Tutup notifikasi"
              className="toast__close"
              type="button"
              onClick={() => dismissFeedback(toast)}
            >
              <X aria-hidden="true" size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
