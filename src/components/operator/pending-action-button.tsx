"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useId } from "react";
import { CheckCircle2, FileUp, Loader2, Play, RefreshCcw, WandSparkles, type LucideIcon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useActivityFeedback, type ActivityKind } from "./activity-feedback-context";

type PendingActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "formAction"> & {
  formAction?: ButtonHTMLAttributes<HTMLButtonElement>["formAction"] | ((formData: FormData) => void | Promise<void>);
  activityDescription?: string | null;
  activityKind?: ActivityKind;
  activityTitle: string;
  children: ReactNode;
  pendingLabel?: string;
  estimatedDurationMs?: number;
  pendingOverride?: boolean;
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
  formAction,
  pendingLabel,
  pendingOverride,
  type = "submit",
  name,
  value,
  ...buttonProps
}: PendingActionButtonProps) {
  const { data, pending } = useFormStatus();
  const { registerActivity, clearActivity } = useActivityFeedback();
  const activityId = useId();
  const Icon = activityIcons[activityKind];
  const submitterName = typeof name === "string" ? name : "";
  const submitterValue = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const isMatchingSubmitter =
    pending &&
    (!submitterName || !submitterValue || (data?.get(submitterName) ?? null) === submitterValue);
  const isPending = pendingOverride ?? isMatchingSubmitter;
  const isDisabled = disabled || (pendingOverride === undefined ? pending : isPending);

  useEffect(() => {
    if (!isPending) {
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
  }, [activityDescription, activityId, activityKind, activityTitle, clearActivity, estimatedDurationMs, isPending, registerActivity]);

  useEffect(
    () => () => {
      clearActivity(activityId);
    },
    [activityId, clearActivity],
  );

  return (
    <button
      {...buttonProps}
      formAction={formAction}
      name={name}
      className={joinClassNames("button", className?.replace(/\bbutton\b/g, "").replace(/\s+/g, " ").trim())}
      disabled={isDisabled}
      type={type}
      value={value}
    >
      {isPending ? <Loader2 size={16} aria-hidden="true" className="spin" /> : Icon ? <Icon size={16} aria-hidden="true" /> : null}
      {isPending ? pendingLabel ?? "Memproses" : children}
    </button>
  );
}
