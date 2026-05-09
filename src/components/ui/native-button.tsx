"use client";

import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

type NativeButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;
type NativeLinkButtonProps = React.ComponentPropsWithoutRef<typeof Link>;
type NativeAnchorButtonProps = React.AnchorHTMLAttributes<HTMLAnchorElement>;

function triggerNativeFeedback() {
  if (typeof window === "undefined" || typeof window.navigator.vibrate !== "function") {
    return;
  }

  try {
    window.navigator.vibrate(50);
  } catch {
    // Haptics are best-effort and must never block the original click.
  }
}

export const NativeButton = React.forwardRef<HTMLButtonElement, NativeButtonProps>(function NativeButton(
  { className, onClick, ...props },
  ref,
) {
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    triggerNativeFeedback();
    onClick?.(event);
  }

  return <button {...props} className={cn("button native-button", className)} ref={ref} onClick={handleClick} />;
});

export function NativeLinkButton({ className, onClick, ...props }: NativeLinkButtonProps) {
  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    triggerNativeFeedback();
    onClick?.(event);
  }

  return <Link {...props} className={cn("button native-button", className)} onClick={handleClick} />;
}

export const NativeAnchorButton = React.forwardRef<HTMLAnchorElement, NativeAnchorButtonProps>(function NativeAnchorButton(
  { className, onClick, ...props },
  ref,
) {
  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    triggerNativeFeedback();
    onClick?.(event);
  }

  return <a {...props} className={cn("button native-button", className)} ref={ref} onClick={handleClick} />;
});
