"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton } from "@/components/ui/native-button";
import type { ShareGenerationRecord } from "@/lib/server/share-generations";
import { SHARE_ANGLE_LABELS, SHARE_PLATFORM_LABELS } from "@/lib/share/share-platform";

type ShareOutputTabProps = {
  generation: ShareGenerationRecord;
};

export function ShareOutputTab({ generation }: ShareOutputTabProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sharedIndex, setSharedIndex] = useState<number | null>(null);
  const variants = generation.output_json ?? [];

  function clearFeedback(setter: (value: number | null) => void) {
    window.setTimeout(() => setter(null), 2000);
  }

  async function copyCaption(caption: string, index: number) {
    await navigator.clipboard.writeText(caption);
    setCopiedIndex(index);
    clearFeedback(setCopiedIndex);
  }

  async function handleCopy(caption: string, index: number) {
    try {
      await copyCaption(caption, index);
    } catch {
      // Clipboard can be unavailable in restricted browser contexts.
    }
  }

  async function handleManualShare(caption: string, index: number) {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: caption, title: SHARE_PLATFORM_LABELS[generation.platform] });
      } else {
        await navigator.clipboard.writeText(caption);
      }

      setSharedIndex(index);
      clearFeedback(setSharedIndex);
    } catch {
      // The operator can cancel the native share sheet; keep the output visible.
    }
  }

  if (generation.status === "generating") {
    return (
      <div className="share-output-tab">
        <p className="helper-text">Caption sedang di-generate. Tunggu sebentar.</p>
      </div>
    );
  }

  if (generation.status === "error") {
    return (
      <div className="share-output-tab">
        <p className="error-box">{generation.error_message ?? "Terjadi error saat generate caption."}</p>
      </div>
    );
  }

  if (!variants.length) {
    return (
      <div className="share-output-tab">
        <p className="helper-text">Belum ada caption yang di-generate.</p>
      </div>
    );
  }

  return (
    <div className="share-output-tab">
      <ul className="share-output-list">
        {variants.map((variant, index) => {
          const angle = variant.angle ?? generation.angle;
          const platform = variant.platform ?? generation.platform;

          return (
            <li key={`${generation.id}-${index}`} className="share-output-item">
              <div className="share-output-item__header">
                <span className="share-output-item__label">Varian {index + 1}</span>
                <span className="share-output-item__badges">
                  <StatusBadge status={SHARE_ANGLE_LABELS[angle]} size="sm" tone="info" />
                  <StatusBadge status={SHARE_PLATFORM_LABELS[platform]} size="sm" tone="neutral" />
                </span>
              </div>
              <div className="share-output-item__caption">{variant.caption}</div>
              <div className="share-output-item__actions">
                <NativeButton
                  type="button"
                  className="compact tertiary"
                  onClick={() => handleCopy(variant.caption, index)}
                  aria-label={copiedIndex === index ? "Tersalin" : "Copy caption"}
                >
                  {copiedIndex === index ? (
                    <>
                      <Check size={14} aria-hidden="true" />
                      Tersalin
                    </>
                  ) : (
                    <>
                      <Copy size={14} aria-hidden="true" />
                      Copy
                    </>
                  )}
                </NativeButton>
                <NativeButton
                  type="button"
                  className="compact primary"
                  onClick={() => handleManualShare(variant.caption, index)}
                  aria-label={sharedIndex === index ? "Siap dibagikan" : "Manual Share"}
                >
                  {sharedIndex === index ? (
                    <>
                      <Check size={14} aria-hidden="true" />
                      Siap
                    </>
                  ) : (
                    <>
                      <Share2 size={14} aria-hidden="true" />
                      Manual Share
                    </>
                  )}
                </NativeButton>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
