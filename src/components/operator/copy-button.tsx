"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { NativeButton } from "@/components/ui/native-button";

type CopyButtonProps = {
  text: string;
  label?: string;
  className?: string;
  disabled?: boolean;
};

export function CopyButton({ text, label = "Copy", className, disabled = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (disabled) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <NativeButton className={`compact ${className ?? ""}`.trim()} disabled={disabled} type="button" onClick={handleCopy}>
      {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      {copied ? "Tersalin" : label}
    </NativeButton>
  );
}
