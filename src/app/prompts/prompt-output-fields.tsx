import { CopyableReadOnlyField } from "@/components/operator/copyable-readonly-field";
import { StatusBadge } from "@/components/operator/status-badge";
import { PromptFieldStepper } from "@/components/operator/prompt-field-stepper";
import {
  buildStructuredI2VPromptForCopy,
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
import { resolveVoLengthPreset, type VoLengthPresetKey } from "@/lib/prompts/vo-length-presets";

const PROMPT_CLIP_SUBTITLES: Record<PromptClipKey, string> = {
  clip_1: "Frame awal & prompt video",
  clip_2: "Frame lanjutan & prompt video",
};

type PromptPackOutputRecord = {
  i2i_prompts_json?: unknown;
  i2v_prompts_json?: unknown;
  personalization_json?: unknown;
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

export function PromptOutputFields({ pack }: { pack: PromptPackOutputRecord }) {
  const promptSet = readPromptPackEditorPromptSet(pack);
  const shopeeCaptionTags = readStoredShopeeCaptionTags(pack);
  const generationOptions = readGenerationOptions(pack);
  const videoModel = generationOptions?.video_model ? resolveVideoModel(generationOptions.video_model) : undefined;

  return (
    <div className="stack prompt-output-fields prompt-output-fields--prompt-pack">
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
          const fieldSteps = [
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
                  <span className="prompt-output-section__summary-subtitle">{PROMPT_CLIP_SUBTITLES[clipKey]}</span>
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
  );
}

export function readPromptOutputSet(pack: PromptPackOutputRecord) {
  return readPromptPackEditorPromptSet(pack);
}
