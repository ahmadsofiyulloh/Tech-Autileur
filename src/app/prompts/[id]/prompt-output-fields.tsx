import { CopyButton } from "@/components/operator/copy-button";
import { StatusBadge } from "@/components/operator/status-badge";
import { readPromptPackEditorPromptSet, type PromptPackEditorPromptSet } from "@/lib/prompts/prompt-pack-contract";
import {
  PROMPT_CLIP_KEYS,
  PROMPT_CLIP_LABELS,
  PROMPT_TARGET_MARKETPLACE,
  type PromptClipKey,
} from "@/lib/prompts/validation";

type PromptPackOutputRecord = {
  i2i_prompts_json?: unknown;
  i2v_prompts_json?: unknown;
  personalization_json?: unknown;
};

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
  const trimmedValue = value.trim();

  return (
    <div className="prompt-readonly-field">
      <div className="prompt-readonly-field__header">
        <strong>{label}</strong>
        <CopyButton className="tertiary" disabled={!trimmedValue} label="Salin" text={trimmedValue} />
      </div>
      <pre className="prompt-readonly-field__body" data-empty={!trimmedValue ? "true" : undefined}>{trimmedValue || "Belum ada."}</pre>
    </div>
  );
}

export function PromptOutputFields({ pack }: { pack: PromptPackOutputRecord }) {
  const promptSet = readPromptPackEditorPromptSet(pack);

  return (
    <div className="stack">
      <section className="grid two-up" aria-label="Caption dan tags">
        <PromptReadOnlyField label="Caption" value={promptSet.caption} />
        <PromptReadOnlyField label="Tags" value={promptSet.tags} />
      </section>
      <div className="section-card__actions">
        <span className="subtle">Target Marketplace</span>
        <StatusBadge status={PROMPT_TARGET_MARKETPLACE} tone="info" />
      </div>
      <section className="prompt-output-grid" aria-label="Prompt per clip">
        {PROMPT_CLIP_KEYS.map((clipKey) => {
          const clip = promptSet.clips[clipKey];

          return (
            <details className="prompt-output-section" key={clipKey}>
              <summary>{PROMPT_CLIP_LABELS[clipKey]}</summary>
              <div className="prompt-output-section__body">
                <PromptReadOnlyField label="I2I First Frame" value={clip.i2i_first_frame} />
                <PromptReadOnlyField label="I2I Last Frame" value={clip.i2i_last_frame} />
                <PromptReadOnlyField label="I2V Prompt" value={clip.i2v_prompt} />
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
