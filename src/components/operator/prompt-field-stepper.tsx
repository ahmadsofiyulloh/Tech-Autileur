"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { CopyableReadOnlyField } from "@/components/operator/copyable-readonly-field";

export type PromptFieldStep = {
  id: string;
  label: string;
  value: string;
  emptyLabel?: string;
  summary?: string;
  copyLabel?: string;
};

type PromptFieldStepperProps = {
  ariaLabel?: string;
  className?: string;
  defaultExpandedStepId?: string;
  steps: PromptFieldStep[];
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function summarizeFieldValue(value: string, emptyLabel = "Belum ada.") {
  const trimmed = value.replace(/\s+/g, " ").trim();

  if (!trimmed) {
    return emptyLabel;
  }

  return trimmed.length > 64 ? `${trimmed.slice(0, 64).trimEnd()}...` : trimmed;
}

export function PromptFieldStepper({
  ariaLabel = "Field prompt",
  className,
  defaultExpandedStepId,
  steps,
}: PromptFieldStepperProps) {
  const [expandedStepId, setExpandedStepId] = useState(defaultExpandedStepId ?? steps[0]?.id ?? "");

  useEffect(() => {
    setExpandedStepId(defaultExpandedStepId ?? steps[0]?.id ?? "");
  }, [defaultExpandedStepId, steps]);

  return (
    <section className={joinClassNames("prompt-field-stepper", className)} aria-label={ariaLabel}>
      {steps.map((step, index) => {
        const expanded = expandedStepId === step.id;
        const summary = step.summary ?? summarizeFieldValue(step.value, step.emptyLabel);

        return (
          <section className="prompt-field-stepper__step" data-expanded={expanded ? "true" : "false"} key={step.id}>
            <button
              aria-controls={`${step.id}-field`}
              aria-expanded={expanded}
              className="prompt-field-stepper__header"
              type="button"
              onClick={() => setExpandedStepId(step.id)}
            >
              <span className="prompt-field-stepper__header-copy">
                <span className="prompt-field-stepper__index" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="prompt-field-stepper__labels">
                  <strong>{step.label}</strong>
                  <span>{summary}</span>
                </span>
              </span>
              <ChevronDown className="prompt-field-stepper__chevron" size={16} aria-hidden="true" />
            </button>

            <div className="prompt-field-stepper__body" id={`${step.id}-field`} hidden={!expanded}>
              <CopyableReadOnlyField
                className="prompt-field-stepper__field"
                copyLabel={step.copyLabel}
                emptyLabel={step.emptyLabel}
                label={step.label}
                value={step.value}
              />
            </div>
          </section>
        );
      })}
    </section>
  );
}
