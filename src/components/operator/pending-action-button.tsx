"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { NativeButton } from "@/components/ui/native-button";

type PendingActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "formAction"> & {
  formAction?: ButtonHTMLAttributes<HTMLButtonElement>["formAction"] | ((formData: FormData) => void | Promise<void>);
  children: ReactNode;
  pendingLabel?: string;
  pendingOverride?: boolean;
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PendingActionButton({
  children,
  className,
  disabled,
  formAction,
  pendingLabel,
  pendingOverride,
  type = "submit",
  name,
  value,
  ...buttonProps
}: PendingActionButtonProps) {
  const { data, pending } = useFormStatus();
  const submitterName = typeof name === "string" ? name : "";
  const submitterValue = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const isMatchingSubmitter =
    pending &&
    (!submitterName || !submitterValue || (data?.get(submitterName) ?? null) === submitterValue);
  const isPending = pendingOverride ?? isMatchingSubmitter;
  const isDisabled = disabled || (pendingOverride === undefined ? pending : isPending);
  const normalizedClassName = className?.replace(/\bbutton\b/g, "").replace(/\s+/g, " ").trim();

  return (
    <NativeButton
      {...buttonProps}
      formAction={formAction}
      name={name}
      className={joinClassNames(normalizedClassName)}
      disabled={isDisabled}
      type={type}
      value={value}
    >
      {isPending ? <Loader2 size={16} aria-hidden="true" className="spin" /> : <CheckCircle2 size={16} aria-hidden="true" />}
      {isPending ? pendingLabel ?? "Memproses" : children}
    </NativeButton>
  );
}
