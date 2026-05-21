"use client";

import type { AiMediaModelOption } from "@/lib/ai-media/tool-config";

type AiMediaModelCardProps = {
  options: AiMediaModelOption[];
  value: string;
  onChange: (id: string) => void;
};

export function AiMediaModelCards({ options, value, onChange }: AiMediaModelCardProps) {
  return (
    <div className="ai-media-model-cards">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            className={`ai-media-model-card${value === opt.id ? " is-selected" : ""}`}
            onClick={() => onChange(opt.id)}
            aria-pressed={value === opt.id}
          >
            <span className="ai-media-model-card__icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <span className="ai-media-model-card__copy">
              <strong>{opt.label}</strong>
              {opt.description && <span>{opt.description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
