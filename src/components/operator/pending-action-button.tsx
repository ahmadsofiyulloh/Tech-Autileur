"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useId } from "react";
import { CheckCircle2, FileUp, Loader2, Play, RefreshCcw, WandSparkles, type LucideIcon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useActivityFeedback, type ActivityKind } from "./activity-feedback-context";

type PendingActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  activityDescription?: string | null;
  activityKind?: ActivityKind;
  activityTitle: string;
  children: ReactNode;
  pendingLabel?: string;
  estimatedDurationMs?: number;
};

const activityIcons = {
  analysis: WandSparkles,
  "prompt-create": Play,
  "prompt-regenerate": RefreshCcw,
  "prompt-export": FileUp,
  generic: CheckCircle2,
} satisfies Record<ActivityKind, LucideIcon>;

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PendingActionButton({
  activityDescription = null,
  activityKind = "generic",
  activityTitle,
  children,
  className,
  disabled,
  estimatedDurationMs = 12000,
  pendingLabel,
  type = "submit",
  ...buttonProps
}: PendingActionButtonProps) {
  const { pending } = useFormStatus();
  const { registerActivity, clearActivity } = useActivityFeedback();
  const activityId = useId();
  const Icon = activityIcons[activityKind];

  useEffect(() => {
    if (!pending) {
      clearActivity(activityId);
      return;
    }

    registerActivity({
      id: activityId,
      title: activityTitle,
      description: activityDescription,
      kind: activityKind,
      startedAt: Date.now(),
      estimatedDurationMs,
    });
  }, [activityDescription, activityId, activityKind, activityTitle, clearActivity, estimatedDurationMs, pending, registerActivity]);

  useEffect(
    () => () => {
      clearActivity(activityId);
    },
    [activityId, clearActivity],
  );

  return (
    <button
      {...buttonProps}
      className={joinClassNames("button", className?.replace(/\bbutton\b/g, "").replace(/\s+/g, " ").trim())}
      disabled={disabled || pending}
      type={type}
    >
      {pending ? <Loader2 size={16} aria-hidden="true" className="spin" /> : Icon ? <Icon size={16} aria-hidden="true" /> : null}
      {pending ? pendingLabel ?? "Memproses" : children}
    </button>
  );
}
