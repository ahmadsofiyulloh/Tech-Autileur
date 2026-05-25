"use client";

import { type ComponentProps, useMemo, useState } from "react";
import { RefreshCcw, WandSparkles } from "lucide-react";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { RelationalPicker, type RelationalPickerOption } from "@/components/operator/relational-picker";
import { ToggleField } from "@/components/operator/toggle-field";
import {
  DEFAULT_PROMPT_PACK_VIDEO_MODE,
  type PromptPackVideoMode,
} from "@/lib/prompts/prompt-pack-contract";
import {
  SHARE_ANGLES,
  SHARE_ANGLE_LABELS,
  SHARE_VARIANT_COUNT_MAX,
  SHARE_VARIANT_COUNT_MIN,
  normalizeShareVariantCount,
  type ShareAngle,
} from "@/lib/share/share-platform";

type FormAction = NonNullable<ComponentProps<"form">["action"]>;

type PromptGenerateFormProps = {
  action: FormAction;
  affiliateProfileId?: string | null;
  angle?: ShareAngle | null;
  generationMode?: "gemini" | "mock";
  intakeSessionId?: string | null;
  mode: "create" | "regenerate";
  productId: string;
  promptPackId?: string | null;
  returnHref: string;
  sourceImageId?: string | null;
  variantCount?: number | null;
  videoMode?: PromptPackVideoMode | null;
  voEnabled?: boolean | null;
};

const VIDEO_MODE_OPTIONS: RelationalPickerOption[] = [
  {
    value: "frame_to_video",
    label: "Frame to Video",
    description: "Gunakan frame awal dan akhir untuk prompt video.",
  },
  {
    value: "ingredients_to_video",
    label: "Ingredients to Video",
    description: "Gunakan bahan visual produk sebagai input video.",
  },
];

export function PromptGenerateForm({
  action,
  affiliateProfileId,
  angle,
  generationMode = "gemini",
  intakeSessionId,
  mode,
  productId,
  promptPackId,
  returnHref,
  sourceImageId,
  variantCount,
  videoMode,
  voEnabled,
}: PromptGenerateFormProps) {
  const [selectedVariantCount, setSelectedVariantCount] = useState(normalizeShareVariantCount(variantCount ?? 1));
  const variantOptions = useMemo(
    () =>
      Array.from(
        { length: SHARE_VARIANT_COUNT_MAX - SHARE_VARIANT_COUNT_MIN + 1 },
        (_, index) => SHARE_VARIANT_COUNT_MIN + index,
      ),
    [],
  );
  const angleOptions = useMemo<RelationalPickerOption[]>(
    () =>
      SHARE_ANGLES.map((item) => ({
        value: item,
        label: SHARE_ANGLE_LABELS[item],
      })),
    [],
  );
  const defaultAngle = angle ?? "benefit_focused";
  const defaultVideoMode = videoMode ?? DEFAULT_PROMPT_PACK_VIDEO_MODE;
  const isRegenerate = mode === "regenerate";

  return (
    <form action={action} className="share-input-form prompt-generate-form">
      <input type="hidden" name="intent" value={isRegenerate ? "regenerate" : "create_generate"} />
      <input type="hidden" name="generation_mode" value={generationMode} />
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="return_to" value={returnHref} />
      <input type="hidden" name="variant_count" value={String(selectedVariantCount)} />
      <input type="hidden" name="video_model" value="veo-3.1" />
      <input type="hidden" name="vo_length_preset" value="medium" />
      {!isRegenerate ? <input type="hidden" name="status" value="DRAFT" /> : null}
      {promptPackId ? <input type="hidden" name="id" value={promptPackId} /> : null}
      {intakeSessionId ? <input type="hidden" name="intake_session_id" value={intakeSessionId} /> : null}
      {affiliateProfileId ? <input type="hidden" name="affiliate_profile_id" value={affiliateProfileId} /> : null}
      {sourceImageId ? <input type="hidden" name="source_product_image_id" value={sourceImageId} /> : null}

      <div className="share-input-grid">
        <RelationalPicker
          compact
          defaultValue={defaultAngle}
          label="Angle"
          name="angle"
          options={angleOptions}
          searchable={false}
        />

        <RelationalPicker
          compact
          defaultValue={defaultVideoMode}
          label="Mode video"
          name="video_mode"
          options={VIDEO_MODE_OPTIONS}
          searchable={false}
        />

        <ToggleField
          label="Voiceover"
          name="vo_enabled"
          defaultChecked={voEnabled ?? true}
        />

        <fieldset className="share-input-field share-input-variant">
          <legend>Jumlah varian</legend>
          <div className="share-input-variant__options" role="radiogroup" aria-label="Jumlah varian">
            {variantOptions.map((item) => {
              const selected = selectedVariantCount === item;
              return (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`share-input-variant__btn${selected ? " is-selected" : ""}`}
                  onClick={() => setSelectedVariantCount(item)}
                >
                  <strong>{item}</strong>
                </button>
              );
            })}
          </div>
        </fieldset>

        {isRegenerate ? (
          <label className="share-input-field share-input-field--wide" htmlFor="revision_instruction">
            <span>Instruksi Revisi</span>
            <textarea id="revision_instruction" name="revision_instruction" rows={3} />
          </label>
        ) : null}
      </div>

      <div className="share-input-form__footer">
        <PendingActionButton className="primary" pendingLabel={isRegenerate ? "Meregenerasi" : "Generate..."}>
          {isRegenerate ? <RefreshCcw size={16} aria-hidden="true" /> : <WandSparkles size={16} aria-hidden="true" />}
          {isRegenerate ? "Regenerate Prompt" : "Generate Prompt"}
        </PendingActionButton>
      </div>
    </form>
  );
}
