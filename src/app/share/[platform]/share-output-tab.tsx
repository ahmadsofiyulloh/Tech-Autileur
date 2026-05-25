"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, Share2, ImageIcon } from "lucide-react";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton } from "@/components/ui/native-button";
import type { ShareGenerationRecord } from "@/lib/server/share-generations";
import {
  SHARE_ANGLE_LABELS,
  SHARE_PLATFORM_LABELS,
  evaluateCharStatus,
  type SharePlatform,
  type ShareCaptionVariantV2,
  buildShareOutputBlocks,
  hasImagePrompt,
} from "@/lib/share/share-platform";
import { ShareGeneratingState } from "@/app/share/_components/share-generating-state";
import { ShareErrorState } from "@/app/share/_components/share-error-state";
import { ShareTimeoutState } from "@/app/share/_components/share-timeout-state";
import { ShareOutputVersionBanner } from "./share-output-version-banner";
import { generateShareCaption } from "./actions";

type ShareOutputTabProps = {
  generation: ShareGenerationRecord;
  productId: string;
  affiliateUrl: string | null;
  latestGenerationId: string | null;
  isViewingOldVersion: boolean;
  platform: SharePlatform;
};

export function ShareOutputTab({
  generation,
  productId,
  affiliateUrl,
  latestGenerationId,
  isViewingOldVersion,
  platform,
}: ShareOutputTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sharedIndex, setSharedIndex] = useState<number | null>(null);
  const [showTimeout, setShowTimeout] = useState(false);
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

  function handleEditForm() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "generate");
    params.delete("version");
    router.push(`?${params.toString()}`);
  }

  async function handleRetry() {
    if (!affiliateUrl) {
      handleEditForm();
      return;
    }

    const formData = new FormData();
    formData.set("product_id", productId);
    formData.set("platform", generation.platform);
    formData.set("affiliate_url", affiliateUrl);
    formData.set("angle", generation.angle);
    formData.set("variant_count", String(generation.variant_count));
    if (generation.input_params) {
      formData.set("options_json", JSON.stringify(generation.input_params));
    }

    await generateShareCaption(formData);
  }

  // Suppress unused-variable lint for latestGenerationId; kept in props for future use.
  void latestGenerationId;

  if (generation.status === "generating") {
    if (showTimeout) {
      return (
        <div className="share-output-tab">
          <ShareTimeoutState onBackToForm={handleEditForm} />
        </div>
      );
    }

    return (
      <div className="share-output-tab">
        <ShareGeneratingState
          generationId={generation.id}
          variantCount={generation.variant_count}
          onResolved={(result) => {
            if (result.status === "generated" || result.status === "error") {
              router.refresh();
            }
          }}
          onTimeout={() => setShowTimeout(true)}
        />
      </div>
    );
  }

  if (generation.status === "error") {
    return (
      <div className="share-output-tab">
        <ShareErrorState
          errorMessage={generation.error_message}
          onRetry={handleRetry}
          onEditForm={handleEditForm}
        />
      </div>
    );
  }

  if (!variants.length) {
    return (
      <div className="share-output-tab">
        {isViewingOldVersion ? (
          <ShareOutputVersionBanner
            platform={platform}
            productId={productId}
            createdAt={generation.created_at}
          />
        ) : null}
        <p className="helper-text">Belum ada caption yang di-generate.</p>
      </div>
    );
  }

  return (
    <div className="share-output-tab">
      {isViewingOldVersion ? (
        <ShareOutputVersionBanner
          platform={platform}
          productId={productId}
          createdAt={generation.created_at}
        />
      ) : null}
      <ul className="share-output-list">
        {variants.map((rawVariant, index) => {
          const variant = rawVariant as unknown as ShareCaptionVariantV2;
          const angle = variant.angle ?? generation.angle;
          const variantPlatform = variant.platform ?? generation.platform;

          // SHARE-V1-007: Use buildShareOutputBlocks() — handles both V1 (variant.blocks)
          // and legacy (variant.caption + platform_specific_fields) variants.
          const blocks = buildShareOutputBlocks(variant, variantPlatform);
          const variantHasImagePrompt = hasImagePrompt(variant);
          const isPinterest = variantPlatform === "pinterest";

          // Index offsets for copy/share feedback tracking per variant.
          // Each block within a variant gets its own offset slot.
          const blockCopyOffset = (blockIndex: number) => index * 100 + blockIndex;
          const imagePromptCopyOffset = index * 100 + 90;
          const mustKeepCopyOffset = index * 100 + 91;
          const mustAvoidCopyOffset = index * 100 + 92;

          // Get the main caption block (for the Manual Share button).
          const mainCaptionBlock = blocks.find((b) => b.role === "main_caption");
          const shareableText = mainCaptionBlock?.content ?? variant.caption ?? "";

          return (
            <li key={`${generation.id}-${index}`} className="share-output-item">
              <div className="share-output-item__header">
                <span className="share-output-item__label">Varian {index + 1}</span>
                <span className="share-output-item__badges">
                  <StatusBadge status={SHARE_ANGLE_LABELS[angle]} size="sm" tone="info" />
                  <StatusBadge status={SHARE_PLATFORM_LABELS[variantPlatform]} size="sm" tone="neutral" />
                </span>
              </div>

              {/* Pinterest: image is required for a Pin */}
              {isPinterest ? (
                <div className="share-inline-note" data-tone="warning" role="note">
                  <ImageIcon size={14} aria-hidden="true" />
                  <span>Image wajib untuk Pin — siapkan visual sesuai prompt di bawah.</span>
                </div>
              ) : null}

              {/* Structured blocks (V1) or derived blocks (legacy) */}
              {blocks.map((block, blockIndex) => {
                const status = evaluateCharStatus(block.char_count, block.recommended_max_chars);
                const showWarning = status === "over" || Boolean(block.warning);
                const copyKey = blockCopyOffset(blockIndex);
                const isMainCaption = block.role === "main_caption";

                return (
                  <div key={`${block.role}-${blockIndex}`} className="share-output-block">
                    <div className="share-output-block__label">
                      {block.label}
                      <span className="share-output-block__count" data-status={status}>
                        {block.char_count} / {block.recommended_max_chars}
                      </span>
                    </div>
                    {showWarning ? (
                      <div className="share-output-block__warning" role="status">
                        {block.warning ??
                          `Melebihi batas rekomendasi (${block.recommended_max_chars} karakter). Edit sebelum di-share.`}
                      </div>
                    ) : null}
                    <div className="share-output-block__content">{block.content}</div>
                    <div className="share-output-block__actions">
                      <NativeButton
                        type="button"
                        className="compact tertiary"
                        onClick={() => handleCopy(block.content, copyKey)}
                        aria-label={copiedIndex === copyKey ? "Tersalin" : `Copy ${block.label}`}
                      >
                        {copiedIndex === copyKey ? (
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
                      {isMainCaption ? (
                        <NativeButton
                          type="button"
                          className="compact primary"
                          onClick={() => handleManualShare(shareableText, index)}
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
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {/* SHARE-V1-007: Image prompt block (i2i discipline) */}
              {variantHasImagePrompt ? (
                <div className="share-output-image-prompt" aria-label="Image prompt">
                  <div className="share-output-image-prompt__header">
                    <span className="share-output-image-prompt__title">
                      <ImageIcon size={14} aria-hidden="true" />
                      Image Prompt
                    </span>
                    <span className="share-output-image-prompt__ratio">
                      {variant.image_prompt.aspect_ratio}
                    </span>
                  </div>

                  <div className="share-output-image-prompt__field">
                    <span className="share-output-image-prompt__label">Prompt</span>
                    <p className="share-output-image-prompt__text">{variant.image_prompt.prompt_text}</p>
                    <div className="share-output-block__actions">
                      <NativeButton
                        type="button"
                        className="compact tertiary"
                        onClick={() => handleCopy(variant.image_prompt.prompt_text, imagePromptCopyOffset)}
                        aria-label={copiedIndex === imagePromptCopyOffset ? "Tersalin" : "Copy prompt"}
                      >
                        {copiedIndex === imagePromptCopyOffset ? (
                          <>
                            <Check size={14} aria-hidden="true" />
                            Tersalin
                          </>
                        ) : (
                          <>
                            <Copy size={14} aria-hidden="true" />
                            Copy Prompt
                          </>
                        )}
                      </NativeButton>
                    </div>
                  </div>

                  {variant.image_prompt.image_inputs.length > 0 ? (
                    <div className="share-output-image-prompt__field">
                      <span className="share-output-image-prompt__label">Foto referensi (i2i)</span>
                      <ul className="share-output-image-prompt__list">
                        {variant.image_prompt.image_inputs.map((input, i) => (
                          <li key={i}>{input}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {variant.image_prompt.must_keep.length > 0 ? (
                    <div className="share-output-image-prompt__field">
                      <span className="share-output-image-prompt__label" data-tone="keep">
                        Harus dipertahankan
                      </span>
                      <ul className="share-output-image-prompt__list" data-tone="keep">
                        {variant.image_prompt.must_keep.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                      <div className="share-output-block__actions">
                        <NativeButton
                          type="button"
                          className="compact tertiary"
                          onClick={() =>
                            handleCopy(variant.image_prompt.must_keep.join("\n"), mustKeepCopyOffset)
                          }
                          aria-label={copiedIndex === mustKeepCopyOffset ? "Tersalin" : "Copy must keep"}
                        >
                          {copiedIndex === mustKeepCopyOffset ? (
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
                      </div>
                    </div>
                  ) : null}

                  {variant.image_prompt.must_avoid.length > 0 ? (
                    <div className="share-output-image-prompt__field">
                      <span className="share-output-image-prompt__label" data-tone="avoid">
                        Hindari
                      </span>
                      <ul className="share-output-image-prompt__list" data-tone="avoid">
                        {variant.image_prompt.must_avoid.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                      <div className="share-output-block__actions">
                        <NativeButton
                          type="button"
                          className="compact tertiary"
                          onClick={() =>
                            handleCopy(variant.image_prompt.must_avoid.join("\n"), mustAvoidCopyOffset)
                          }
                          aria-label={copiedIndex === mustAvoidCopyOffset ? "Tersalin" : "Copy must avoid"}
                        >
                          {copiedIndex === mustAvoidCopyOffset ? (
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
                      </div>
                    </div>
                  ) : null}

                  {variant.image_prompt.upload_note ? (
                    <p className="share-output-image-prompt__note">
                      <strong>Catatan upload:</strong> {variant.image_prompt.upload_note}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
