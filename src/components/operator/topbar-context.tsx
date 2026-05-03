"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type TopbarOverrideValue = {
  title?: string;
  subtitle?: string | null;
};

type TopbarContextValue = {
  override: TopbarOverrideValue | null;
  setOverride: (value: TopbarOverrideValue | null) => void;
};

const TopbarContext = createContext<TopbarContextValue | null>(null);

export function TopbarProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<TopbarOverrideValue | null>(null);
  const setOverride = useCallback((value: TopbarOverrideValue | null) => {
    setOverrideState(value);
  }, []);
  const value = useMemo(() => ({ override, setOverride }), [override, setOverride]);

  return <TopbarContext.Provider value={value}>{children}</TopbarContext.Provider>;
}

export function useTopbar() {
  const context = useContext(TopbarContext);

  if (!context) {
    throw new Error("useTopbar must be used within TopbarProvider.");
  }

  return context;
}

export function TopbarOverride({ title, subtitle }: { title: string; subtitle?: string | null }) {
  const { setOverride } = useTopbar();

  useEffect(() => {
    setOverride({ title, subtitle: subtitle ?? null });

    return () => {
      setOverride(null);
    };
  }, [setOverride, subtitle, title]);

  return null;
}
