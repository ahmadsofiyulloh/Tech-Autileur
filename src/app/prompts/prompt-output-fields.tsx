"use client";

import { useMemo, useState } from "react";
import { CopyableReadOnlyField } from "@/components/operator/copyable-readonly-field";
import { StatusBadge } from "@/components/operator/status-badge";
import { PromptFieldStepper } from "@/components/operator/prompt-field-stepper";
import {
  buildIngredientsVideoPromptForCopy,
  buildStructuredI2VPromptForCopy,
  resolvePromptPackVideoMode,
  readPromptPackEditorPromptSet,
  type PromptPackEditorPromptSet,
  type PromptPackGenerationOptionsJson,
} from "@/lib/prompts/prompt-pack-contract";
import {
  PROMPT_CLIP_KEYS,
  PROMPT_CLIP_LABELS,
  PROMPT_TARGET_MARKETPLACE,
  type PromptClipKey,
} from "@/lib/prompts/validation";
import { resolveVideoModel } from "@/lib/prompts/video-model-config";
import { resolveVoLengthPreset } from "@/lib/prompts/vo-length-presets";
import { SHARE_ANGLE_LABELS } from "@/lib/share/share-platform";

const PROMPT_CLIP_SUBTITLES: Record<PromptClipKey, string> = {
  clip_1: "Frame awal & prompt video",
  clip_2: "Frame lanjutan & prompt video",
};

const INGREDIENTS_CLIP_SUBTITLES: Record<PromptClipKey, string> = {
  clip_1: "Ingredients video hook",
  clip_2: "Ingredients video detail",
};

type PromptPackOutputRecord = {
  angle?: unknown;
  i2i_prompts_json?: unknown;
  i2v_prompts_json?: unknown;
  output_variants_json?: unknown;
  personalization_json?: unknown;
  variant_count?: unknown;
};

type PromptPackOutputVariantRecord = {
  caption?: unknown;
  i2i_prompts?: unknown;
  i2v_prompts?: unknown;
  tags?: unknown;
  upload_copy?: unknown;
};

function readGenerationOptions(pack: PromptPackOutputRecord): PromptPackGenerationOptionsJson | undefined {
  const personalization = readRecord(pack.personalization_json);
  const options = readRecord(personalization.generation_options);

  if (!options || Object.keys(options).length === 0) {
    return undefined;
  }

  return {
    ...(typeof options.vo_enabled === "boolean" ? { vo_enabled: options.vo_enabled } : {}),
    ...(typeof options.vo_length_preset === "string" ? { vo_length_preset: resolveVoLengthPreset(options.vo_length_preset) } : {}),
    ...(typeof options.video_model === "string" ? { video_model: resolveVideoModel(options.video_model) } : {}),
    video_mode: resolvePromptPackVideoMode(options.video_mode),
  };
}

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStoredShopeeCaptionTags(pack: PromptPackOutputRecord) {
  const personalization = readRecord(pack.personalization_json);
  const uploadCopy = readRecord(personalization.upload_copy);

  return readString(uploadCopy.shopee_caption_tags);
}

function stringifyCopyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function readOutputVariants(pack: PromptPackOutputRecord) {
  if (!Array.isArray(pack.output_variants_json) || pack.output_variants_json.length === 0) {
    return [pack];
  }

  const variants = pack.output_variants_json
    .filter((variant): variant is PromptPackOutputVariantRecord => Boolean(variant) && typeof variant === "object" && !Array.isArray(variant))
    .map((variant) => ({
      ...pack,
      i2i_prompts_json: variant.i2i_prompts,
      i2v_prompts_json: variant.i2v_prompts,
      personalization_json: {
        ...readRecord(pack.personalization_json),
        caption: readString(variant.caption),
        tags: readString(variant.tags),
        upload_copy: readRecord(variant.upload_copy),
      },
    }));

  return variants.length ? variants : [pack];
}

function clipFieldName(clipKey: PromptClipKey, field: "i2i_first_frame" | "i2i_last_frame" | "i2v_prompt") {
  return `${clipKey}_${field}`;
}

export function HiddenPromptSetFields({
  idPrefix,
  promptSet,
}: {
  idPrefix: string;
  promptSet: PromptPackEditorPromptSet;
}) {
  return (
    <>
      {PROMPT_CLIP_KEYS.map((clipKey) => {
        const clip = promptSet.clips[clipKey];

        return (
          <span key={clipKey}>
            <input
              name={clipFieldName(clipKey, "i2i_first_frame")}
              type="hidden"
              value={clip.i2i_first_frame}
              aria-hidden="true"
              data-field-owner={idPrefix}
            />
            <input
              name={clipFieldName(clipKey, "i2i_last_frame")}
              type="hidden"
              value={clip.i2i_last_frame}
              aria-hidden="true"
              data-field-owner={idPrefix}
            />
            <input
              name={clipFieldName(clipKey, "i2v_prompt")}
              type="hidden"
              value={clip.i2v_prompt}
              aria-hidden="true"
              data-field-owner={idPrefix}
            />
          </span>
        );
      })}
      <input name="caption" type="hidden" value={promptSet.caption} aria-hidden="true" data-field-owner={idPrefix} />
      <input name="tags" type="hidden" value={promptSet.tags} aria-hidden="true" data-field-owner={idPrefix} />
    </>
  );
}

export function PromptReadOnlyField({ label, value }: { label: string; value: string }) {
  return <CopyableReadOnlyField label={label} value={value} />;
}

function PromptOutputVariantFields({
  index,
  open,
  pack,
  total,
}: {
  index: number;
  open: boolean;
  pack: PromptPackOutputRecord;
  total: number;
}) {
  const promptSet = readPromptPackEditorPromptSet(pack);
  const shopeeCaptionTags = readStoredShopeeCaptionTags(pack);
  const generationOptions = readGenerationOptions(pack);
  const videoModel = generationOptions?.video_model ? resolveVideoModel(generationOptions.video_model) : undefined;
  const videoMode = resolvePromptPackVideoMode(generationOptions?.video_mode);
  const isIngredientsMode = videoMode === "ingredients_to_video";
  const angle = typeof pack.angle === "string" && pack.angle in SHARE_ANGLE_LABELS ? SHARE_ANGLE_LABELS[pack.angle as keyof typeof SHARE_ANGLE_LABELS] : null;

  return (
    <details className="prompt-output-section prompt-output-variant" open={open}>
      <summary>
        <span className="prompt-output-section__summary-copy">
          <strong className="prompt-output-section__summary-title">Varian {index + 1}</strong>
          <span className="prompt-output-section__summary-subtitle">
            {[angle, total > 1 ? `${total} varian` : null].filter(Boolean).join(" - ") || "Prompt pack"}
          </span>
        </span>
      </summary>
      <div className="prompt-output-section__body stack">
      <section className="grid two-up prompt-output-copy-grid" aria-label="Caption, tags, dan copy Shopee">
        <PromptReadOnlyField label="Caption" value={promptSet.caption} />
        <PromptReadOnlyField label="Tags" value={promptSet.tags} />
        <CopyableReadOnlyField label="Shopee Caption+Tags" value={shopeeCaptionTags} emptyLabel="Belum ada" />
      </section>
      <div className="section-card__actions">
        <span className="subtle">Target Marketplace</span>
        <StatusBadge status={PROMPT_TARGET_MARKETPLACE} tone="info" />
      </div>
      <section className="prompt-output-grid" aria-label="Prompt per clip">
        {PROMPT_CLIP_KEYS.map((clipKey) => {
          const clip = promptSet.clips[clipKey];
          const fieldSteps = isIngredientsMode
            ? [
                {
                  id: `${clipKey}-ingredients-video-prompt`,
                  label: "Ingredients Video Prompt",
                  value: stringifyCopyJson(buildIngredientsVideoPromptForCopy(clip.i2v_prompt_json)),
                  emptyLabel: "Belum ada prompt.",
                },
              ]
            : [
                {
                  id: `${clipKey}-first-frame-image`,
                  label: "First Frame Image",
                  value: clip.i2i_first_frame,
                  emptyLabel: "Belum ada prompt.",
                },
                {
                  id: `${clipKey}-i2v-prompt`,
                  label: "I2V Prompt",
                  value: stringifyCopyJson(buildStructuredI2VPromptForCopy(clip.i2v_prompt_json, videoModel)),
                  emptyLabel: "Belum ada prompt.",
                },
              ];

          return (
            <details className="prompt-output-section" key={clipKey} open={clipKey === PROMPT_CLIP_KEYS[0]}>
              <summary>
                <span className="prompt-output-section__summary-copy">
                  <strong className="prompt-output-section__summary-title">{PROMPT_CLIP_LABELS[clipKey]}</strong>
                  <span className="prompt-output-section__summary-subtitle">
                    {isIngredientsMode ? INGREDIENTS_CLIP_SUBTITLES[clipKey] : PROMPT_CLIP_SUBTITLES[clipKey]}
                  </span>
                </span>
              </summary>
              <div className="prompt-output-section__body">
                <PromptFieldStepper steps={fieldSteps} />
              </div>
            </details>
          );
        })}
      </section>
      </div>
    </details>
  );
}

function summarizeVariantLabel(variant: PromptPackOutputRecord, index: number) {
  const promptSet = readPromptPackEditorPromptSet(variant);
  const caption = promptSet.caption.replace(/\s+/g, " ").trim();

  if (!caption) {
    return `Varian ${index + 1}`;
  }

  return caption.length > 48 ? `${caption.slice(0, 48).trimEnd()}...` : caption;
}

export function PromptOutputFields({ pack }: { pack: PromptPackOutputRecord }) {
  const variants = useMemo(() => readOutputVariants(pack), [pack]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const effectiveSelectedIndex = selectedIndex < variants.length ? selectedIndex : 0;
  const selectedVariant = variants[effectiveSelectedIndex] ?? variants[0] ?? pack;
  const tabPanelLabelProps = variants.length > 1
    ? { "aria-labelledby": `prompt-output-variant-tab-${effectiveSelectedIndex}` }
    : { "aria-label": "Output prompt" };

  return (
    <div className="stack prompt-output-fields prompt-output-fields--prompt-pack">
      {variants.length > 1 ? (
        <div className="content-filter-tabs content-filter-tabs--sub prompt-output-variant-tabs" role="tablist" aria-label="Varian output prompt">
          {variants.map((variant, index) => {
            const selected = effectiveSelectedIndex === index;

            return (
              <button
                aria-controls={`prompt-output-variant-panel-${index}`}
                aria-selected={selected}
                className="content-filter-tab"
                data-active={selected ? "true" : undefined}
                id={`prompt-output-variant-tab-${index}`}
                key={`prompt-output-variant-tab-${index}`}
                role="tab"
                type="button"
                onClick={() => setSelectedIndex(index)}
              >
                <span>Varian {index + 1}</span>
                <span className="sr-only">{summarizeVariantLabel(variant, index)}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div id={`prompt-output-variant-panel-${effectiveSelectedIndex}`} role="tabpanel" {...tabPanelLabelProps}>
        <PromptOutputVariantFields
          index={effectiveSelectedIndex}
          key={`prompt-output-variant-${effectiveSelectedIndex}`}
          open
          pack={selectedVariant}
          total={variants.length}
        />
      </div>
    </div>
  );
}

export function readPromptOutputSet(pack: PromptPackOutputRecord) {
  return readPromptPackEditorPromptSet(pack);
}
