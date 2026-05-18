"use client";

import { Children, useMemo, useState, type ReactNode } from "react";

export type ControllerWorkflowStepperStep = {
  id: string;
  number: number;
  title: string;
  count: number;
};

type ControllerWorkflowStepperProps = {
  steps: ControllerWorkflowStepperStep[];
  defaultActiveStepId: string;
  ariaLabel?: string;
  aside?: ReactNode;
  children: ReactNode;
};

function clampStepId(steps: ControllerWorkflowStepperStep[], requestedStepId: string) {
  return steps.some((step) => step.id === requestedStepId) ? requestedStepId : steps[0]?.id ?? "";
}

export function ControllerWorkflowStepper({
  ariaLabel = "Tahap produksi Flow",
  aside,
  children,
  defaultActiveStepId,
  steps,
}: ControllerWorkflowStepperProps) {
  const [activeStepId, setActiveStepId] = useState(() => clampStepId(steps, defaultActiveStepId));
  const panels = Children.toArray(children);
  const activeStep = useMemo(
    () => steps.find((step) => step.id === activeStepId) ?? steps[0] ?? null,
    [activeStepId, steps],
  );
  const activeIndex = activeStep ? Math.max(steps.findIndex((step) => step.id === activeStep.id), 0) : 0;

  return (
    <section className="controller-workflow-stepper">
      <ol className="controller-stepper-rail" aria-label={ariaLabel}>
        {steps.map((step) => {
          const isActive = step.id === activeStep?.id;
          const isEmpty = step.count === 0;

          return (
            <li
              className="controller-stepper-rail__item"
              data-active={isActive ? "true" : "false"}
              data-empty={isEmpty ? "true" : "false"}
              key={step.id}
            >
              <button
                aria-current={isActive ? "step" : undefined}
                aria-label={`${step.title}, ${isEmpty ? "kosong" : `${step.count} item`}`}
                className="controller-stepper-rail__button"
                type="button"
                onClick={() => setActiveStepId(step.id)}
              >
                <span className="controller-stepper-rail__index" aria-hidden="true">
                  {step.number}
                </span>
                <span className="controller-stepper-rail__copy">
                  <span className="controller-stepper-rail__label">{step.title}</span>
                  <span className="controller-stepper-rail__meta">{isEmpty ? "Kosong" : `${step.count} item`}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="controller-workflow-stepper__body">
        <div className="controller-stepper-panel">{panels[activeIndex] ?? null}</div>
        {aside ? <aside className="controller-workflow-stepper__aside">{aside}</aside> : null}
      </div>
    </section>
  );
}
