"use client";

import { useSearchParams } from "next/navigation";

export type DemoState = "idle" | "loading" | "error" | "empty" | "populated";

const VALID_STATES: DemoState[] = ["idle", "loading", "error", "empty", "populated"];

export function useAiMediaDemoState() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("demo");
  const state: DemoState = raw && VALID_STATES.includes(raw as DemoState) ? (raw as DemoState) : "populated";

  return {
    state,
    isLoading: state === "loading",
    isError: state === "error",
    isEmpty: state === "empty",
  };
}
