"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, Loader2, Lock } from "lucide-react";
import { StatusBadge } from "@/components/operator/status-badge";

export type IntakeStepperStepStatus = "active" | "completed" | "loading" | "pending" | "locked" | "error";
export type IntakeStepperBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export type IntakeStepperStep = {
  id: string;
  label: string;
  summary: string;
  status: IntakeStepperStepStatus;
  badgeLabel: string;
  badgeTone: IntakeStepperBadgeTone;
  panel: ReactNode;
};

type IntakeStepperProps = {
  steps: IntakeStepperStep[];
  defaultExpandedStepId: string;
  className?: string;
  ariaLabel?: string;
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getStepIcon(step: IntakeStepperStep, index: number) {
  if (step.status === "completed") {
    return <Check size={14} aria-hidden="true" />;
  }

  if (step.status === "loading") {
    return <Loader2 size={14} aria-hidden="true" className="spin" />;
  }

  if (step.status === "error") {
    return <AlertTriangle size={14} aria-hidden="true" />;
  }

  if (step.status === "locked") {
    return <Lock size={13} aria-hidden="true" />;
  }

  return <span aria-hidden="true">{index + 1}</span>;
}

export function IntakeStepper({ ariaLabel = "Tahapan intake", className, defaultExpandedStepId, steps }: IntakeStepperProps) {
  const [expandedStepId, setExpandedStepId] = useState(defaultExpandedStepId);

  useEffect(() => {
    setExpandedStepId(defaultExpandedStepId);
  }, [defaultExpandedStepId]);

  return (
    <section className={joinClassNames("intake-stepper", className)}>
      <ol className="intake-stepper__rail" aria-label={ariaLabel}>
        {steps.map((step, index) => (
          <li className="intake-stepper__rail-item" key={step.id}>
            <button
              aria-current={expandedStepId === step.id ? "step" : undefined}
              className="intake-stepper__rail-button"
              type="button"
              onClick={() => setExpandedStepId(step.id)}
            >
              <span className="intake-stepper__rail-dot" data-status={step.status}>
                {getStepIcon(step, index)}
              </span>
              <span className="intake-stepper__rail-copy">
                <strong>{step.label}</strong>
                <span>{step.summary}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="intake-stepper__stack">
        {steps.map((step, index) => {
          const expanded = expandedStepId === step.id;

          return (
            <section className="intake-stepper__step" data-expanded={expanded ? "true" : "false"} data-status={step.status} key={step.id}>
              <button
                aria-controls={`${step.id}-panel`}
                aria-expanded={expanded}
                className="intake-stepper__step-header"
                type="button"
                onClick={() => setExpandedStepId(step.id)}
              >
                <span className="intake-stepper__step-header-copy">
                  <span className="intake-stepper__step-dot" data-status={step.status}>
                    {getStepIcon(step, index)}
                  </span>
                  <span className="intake-stepper__step-copy">
                    <strong>{step.label}</strong>
                    <span>{step.summary}</span>
                  </span>
                </span>
                <span className="intake-stepper__step-meta">
                  <StatusBadge status={step.badgeLabel} tone={step.badgeTone} />
                  <ChevronDown className="intake-stepper__chevron" size={16} aria-hidden="true" />
                </span>
              </button>

              <div className="intake-stepper__step-body" id={`${step.id}-panel`} hidden={!expanded}>
                {step.panel}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
