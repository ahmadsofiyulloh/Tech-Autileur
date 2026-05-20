"use client";

import type { AiMediaSelectOption } from "@/lib/ai-media/mock-data";

type AiMediaOptionPickerProps = {
  label: string;
  options: AiMediaSelectOption[];
  value: string;
  onChange: (id: string) => void;
};

export function AiMediaOptionPicker({ label, options, value, onChange }: AiMediaOptionPickerProps) {
  return (
    <fieldset className="ai-media-option-picker">
      <legend className="ai-media-option-picker__legend">{label}</legend>
      <div className="ai-media-option-picker__options">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`ai-media-option-picker__btn${value === opt.id ? " is-selected" : ""}`}
            onClick={() => onChange(opt.id)}
            aria-pressed={value === opt.id}
          >
            <strong>{opt.label}</strong>
            {opt.description && <span>{opt.description}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
