"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";

type DeleteActionButtonVariant = "iconOnly" | "iconLabel";

type DeleteActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmMessage?: string;
  label?: string;
  pendingLabel?: string;
  variant?: DeleteActionButtonVariant;
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function DeleteActionButton({
  "aria-label": ariaLabel,
  className,
  confirmMessage = "Hapus data ini?",
  disabled,
  label = "Hapus",
  onClick,
  pendingLabel = "Menghapus",
  title,
  type = "submit",
  variant = "iconLabel",
  ...buttonProps
}: DeleteActionButtonProps) {
  const { pending } = useFormStatus();
  const isSubmitButton = type === "submit";
  const isDisabled = disabled || (isSubmitButton && pending);
  const visibleLabel = pending && isSubmitButton ? pendingLabel : label;
  const iconOnly = variant === "iconOnly";

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (isDisabled) {
      event.preventDefault();
      return;
    }

    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
      return;
    }

    onClick?.(event);
  }

  return (
    <button
      {...buttonProps}
      aria-label={iconOnly ? ariaLabel ?? label : ariaLabel}
      className={joinClassNames("button compact destructive delete-action-button", iconOnly && "delete-action-button--icon-only", className)}
      disabled={isDisabled}
      title={title ?? (iconOnly ? label : undefined)}
      type={type}
      onClick={handleClick}
    >
      <Trash2 size={15} aria-hidden="true" />
      {iconOnly ? null : visibleLabel}
    </button>
  );
}
