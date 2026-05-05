"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type ActivityKind = "analysis" | "prompt-create" | "prompt-regenerate" | "prompt-export" | "generic";

export type ActivityFeedbackState = {
  id: string;
  title: string;
  description: string | null;
  kind: ActivityKind;
  startedAt: number;
  estimatedDurationMs: number;
};

type ActivityFeedbackContextValue = {
  activity: ActivityFeedbackState | null;
  registerActivity: (activity: ActivityFeedbackState) => void;
  clearActivity: (id: string) => void;
};

const noop = () => undefined;

const ActivityFeedbackContext = createContext<ActivityFeedbackContextValue>({
  activity: null,
  registerActivity: noop,
  clearActivity: noop,
});

export function ActivityFeedbackProvider({ children }: { children: ReactNode }) {
  const [activity, setActivity] = useState<ActivityFeedbackState | null>(null);

  const registerActivity = useCallback((nextActivity: ActivityFeedbackState) => {
    setActivity(nextActivity);
  }, []);

  const clearActivity = useCallback((id: string) => {
    setActivity((current) => (current?.id === id ? null : current));
  }, []);

  const value = useMemo(
    () => ({
      activity,
      registerActivity,
      clearActivity,
    }),
    [activity, clearActivity, registerActivity],
  );

  return <ActivityFeedbackContext.Provider value={value}>{children}</ActivityFeedbackContext.Provider>;
}

export function useActivityFeedback() {
  return useContext(ActivityFeedbackContext);
}
