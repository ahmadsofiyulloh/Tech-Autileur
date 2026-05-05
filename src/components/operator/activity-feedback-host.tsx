"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useActivityFeedback } from "./activity-feedback-context";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function computeEstimatedProgress(startedAt: number, estimatedDurationMs: number, kind: string, now: number) {
  const elapsed = Math.max(0, now - startedAt);
  const duration = Math.max(estimatedDurationMs, kind === "analysis" ? 14000 : 9000);
  const startFloor = kind === "analysis" ? 10 : 14;
  const cap = 92;
  const eased = 1 - Math.exp((-elapsed / duration) * 1.8);

  return clamp(Math.round(startFloor + eased * (cap - startFloor)), startFloor, cap);
}

export function ActivityFeedbackHost() {
  const { activity } = useActivityFeedback();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activity) {
      return;
    }

    setNow(Date.now());
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 350);

    return () => window.clearInterval(interval);
  }, [activity?.id, activity?.startedAt]);

  const progress = useMemo(() => {
    if (!activity) {
      return 0;
    }

    return computeEstimatedProgress(activity.startedAt, activity.estimatedDurationMs, activity.kind, now);
  }, [activity, now]);

  if (!activity) {
    return null;
  }

  return (
    <section
      className="activity-banner stack-tight"
      aria-atomic="true"
      aria-live="polite"
      role="status"
    >
      <div className="activity-banner__header">
        <div className="activity-banner__copy stack-tight">
          <strong>{activity.title}</strong>
          {activity.description ? <span className="subtle">{activity.description}</span> : null}
        </div>
        <span className="activity-banner__percent" aria-hidden="true">
          {progress}%
        </span>
      </div>
      <div className="activity-banner__bar" aria-hidden="true">
        <span style={{ "--activity-fill": `${progress}%` } as CSSProperties} />
      </div>
    </section>
  );
}
