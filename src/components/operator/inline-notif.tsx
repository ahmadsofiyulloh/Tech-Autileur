// src/components/operator/inline-notif.tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, AlertTriangle, CircleAlert } from "lucide-react";

export type InlineNotifType = "success" | "info" | "warning" | "error";

type InlineNotifProps = {
  type: InlineNotifType;
  message: string | ReactNode;
  notifKey?: string | number;
  onDismissed?: () => void;
};

const DISMISS_DURATIONS: Record<InlineNotifType, number | null> = {
  success: 5000,
  info: 6000,
  warning: 8000,
  error: null,
};

const ICONS: Record<InlineNotifType, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: CircleAlert,
};

const EXIT_ANIMATION_MS = 300;

export function InlineNotif({ type, message, notifKey, onDismissed }: InlineNotifProps) {
  const [dismissing, setDismissing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissedRef = useRef(onDismissed);

  useEffect(() => {
    onDismissedRef.current = onDismissed;
  }, [onDismissed]);

  useEffect(() => {
    setDismissing(false);

    // Clear any existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);

    const duration = DISMISS_DURATIONS[type];
    if (!duration) return;

    timerRef.current = setTimeout(() => {
      setDismissing(true);
      exitTimerRef.current = setTimeout(() => {
        onDismissedRef.current?.();
      }, EXIT_ANIMATION_MS);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [notifKey, type]);

  const Icon = ICONS[type];
  const isAssertive = type === "error" || type === "warning";

  return (
    <div
      className={`inline-notif inline-notif--${type}`}
      role={isAssertive ? "alert" : "status"}
      aria-live={isAssertive ? "assertive" : "polite"}
      aria-atomic="true"
      data-dismissing={dismissing ? "true" : undefined}
    >
      <span className="inline-notif__icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="inline-notif__message">{message}</span>
    </div>
  );
}
