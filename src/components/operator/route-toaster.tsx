"use client";

import { AlertTriangle, CircleAlert, CircleCheck, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
const MOBILE_SHEET_DISMISS_DELAY_MS = 6000;
const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";
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

function MobileNotificationSheet({ feedback, onClose }: { feedback: RouteFeedback; onClose: () => void }) {
  const Icon = toastIcons[feedback.tone];

  return createPortal(
    <>
      <button
        aria-label="Tutup notifikasi"
        className="mobile-notification-sheet__backdrop"
        type="button"
        onClick={onClose}
      />
      <aside
        aria-atomic="true"
        aria-label="Notifikasi"
        aria-live={feedback.tone === "error" ? "assertive" : "polite"}
        aria-modal="true"
        className="mobile-notification-sheet"
        data-tone={feedback.tone}
        role="dialog"
      >
        <div className="mobile-notification-sheet__body">
          <button
            aria-label="Tutup notifikasi"
            className="mobile-notification-sheet__close"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" size={16} />
          </button>
          <span className="mobile-notification-sheet__icon" aria-hidden="true">
            <Icon size={38} strokeWidth={2.25} />
          </span>
          <strong className="mobile-notification-sheet__title">{feedback.title}</strong>
          <span className="mobile-notification-sheet__message">{feedback.message}</span>
        </div>
      </aside>
    </>,
    document.body,
  );
}

export function RouteToaster() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toasts, setToasts] = useState<RouteFeedback[]>([]);
  const [mobileNotification, setMobileNotification] = useState<RouteFeedback | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(null);
  const activeFeedbackKeys = useRef(new Set<string>());
  const dismissTimers = useRef(new Map<string, number>());
  const suppressToasts = pathname.startsWith("/login") || pathname.startsWith("/auth");

  function clearDismissTimer(id: string) {
    const timer = dismissTimers.current.get(id);

    if (timer) {
      window.clearTimeout(timer);
      dismissTimers.current.delete(id);
    }
  }

  function dismissFeedback(feedback: RouteFeedback) {
    activeFeedbackKeys.current.delete(feedback.key);
    clearDismissTimer(feedback.id);

    if (feedback.presentation === "sheet") {
      setMobileNotification((current) => (current?.id === feedback.id ? null : current));
      return;
    }

    setToasts((current) => current.filter((toast) => toast.id !== feedback.id));
  }

  function scheduleDismiss(feedback: RouteFeedback) {
    const delay = feedback.presentation === "sheet" ? MOBILE_SHEET_DISMISS_DELAY_MS : TOAST_DISMISS_DELAY_MS;
    const timer = window.setTimeout(() => {
      dismissFeedback(feedback);
    }, delay);

    dismissTimers.current.set(feedback.id, timer);
  }

  useEffect(() => {
    if (!window.matchMedia) {
      setIsMobileViewport(false);
      return;
    }

    const media = window.matchMedia(MOBILE_VIEWPORT_QUERY);

    function updateViewportState() {
      setIsMobileViewport(media.matches);
    }

    updateViewportState();
    media.addEventListener("change", updateViewportState);

    return () => media.removeEventListener("change", updateViewportState);
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of dismissTimers.current.values()) {
        window.clearTimeout(timer);
      }

      dismissTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!mobileNotification) {
      return;
    }

    const activeNotification = mobileNotification;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismissFeedback(activeNotification);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileNotification]);

  useEffect(() => {
    if (suppressToasts || isMobileViewport === null) {
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

    if (presentation === "sheet") {
      setMobileNotification((current) => {
        if (current) {
          activeFeedbackKeys.current.delete(current.key);
          clearDismissTimer(current.id);
        }

        return feedback;
      });
      scheduleDismiss(feedback);
      return;
    }

    setToasts((current) => {
      const next = [feedback, ...current];
      const trimmed = next.slice(0, 3);

      for (const removedToast of next.slice(3)) {
        activeFeedbackKeys.current.delete(removedToast.key);
        clearDismissTimer(removedToast.id);
      }

      return trimmed;
    });
    scheduleDismiss(feedback);
  }, [isMobileViewport, pathname, searchParams, suppressToasts]);

  if (suppressToasts || (!toasts.length && !mobileNotification)) {
    return null;
  }

  return (
    <>
      {toasts.length ? (
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
                  onClick={() => dismissFeedback(toast)}
                >
                  <X aria-hidden="true" size={15} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
      {mobileNotification ? (
        <MobileNotificationSheet feedback={mobileNotification} onClose={() => dismissFeedback(mobileNotification)} />
      ) : null}
    </>
  );
}
